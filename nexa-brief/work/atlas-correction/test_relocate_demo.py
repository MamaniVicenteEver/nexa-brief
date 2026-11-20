"""Relocation rollback tests using only temporary filesystem and fake records."""
import asyncio
import copy
import importlib.util
import json
import re
import sys
import tempfile
import types
import unittest
from contextlib import AbstractAsyncContextManager, nullcontext
from pathlib import Path
from unittest.mock import patch


class Lock(AbstractAsyncContextManager):
    def __init__(self, *_args):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False


class Store:
    def __init__(self, key):
        self.key = key
        self.records = {}
        self.after_upsert = None

    def get(self, ident):
        return copy.deepcopy(self.records.get(ident))

    def list(self):
        return list(copy.deepcopy(self.records).values())

    async def upsert(self, record, match):
        self.records[record[self.key]] = copy.deepcopy(record)
        if self.after_upsert:
            hook, self.after_upsert = self.after_upsert, None
            hook()

    async def delete(self, ident):
        self.records.pop(ident, None)


class Docs:
    def __init__(self):
        self.records = {}

    def delete(self, ident):
        self.records.pop(ident, None)

    def get(self, ident):
        return copy.deepcopy(self.records.get(ident))


def fake_module(name, **values):
    module = types.ModuleType(name)
    module.__dict__.update(values)
    return module


class RelocationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.templates, profile = root / 'templates', root / 'profile'
        self.layout = types.SimpleNamespace(schema_version=3, productions_dir=profile/'productions', runtime_dir=profile/'runtime')
        self.source = self.layout.productions_dir/'atlas'/'demo-old'
        self.target = self.templates/'atlas'/'demo'
        self.source.mkdir(parents=True)
        self.target.parent.mkdir(parents=True)
        self.definition = self.templates/'_tools/design-definitions/design/design.json'
        self.niches = root/'niches.json'
        self.before = {'video_id':'demo-old','production_id':'p1',
                       'details':{'folder_key':'productions/atlas/demo-old', 'title':'keep'},
                       'resources':[], 'logs':[]}
        self.records = {'demo-old':copy.deepcopy(self.before)}
        self.details = Docs()
        self.details.records['demo-old'] = copy.deepcopy(self.before['details'])
        self.showcase, self.video_collection = Store('id'), Store('video_id')
        self.showcase.records['design'] = {'id':'design','category_path':'old','title':'preserve'}
        self.original_showcase = copy.deepcopy(self.showcase.records)
        self.stores = {'showcase_designs':self.showcase,'content_videos':self.video_collection,
                       'editorial_preparations':Store('id')}
        self.video_collection.records['demo-old'] = {'video_id':'demo-old','production_id':'p1'}
        self.args = types.SimpleNamespace(folder='atlas',old_id='demo-old',new_id='demo',
                                          design_id='design',category='cat',apply=True,recover=False)
        self.write_json(self.source/'manifest.json', {'demo':True,'design':'design','category':'cat','video_id':'demo-old'})
        self.write_json(self.source/'info.json', {'engine':'engine'})
        self.write_json(self.source/'work/production/preparation.json', {'draft':{'note':'preserve'}})
        self.poster = self.source/'assets/thumbnails/poster.jpg'
        self.poster.parent.mkdir(parents=True)
        self.poster.write_bytes(b'original poster')
        self.write_json(self.definition, {'engine_id':'engine','category_path':'old'})
        self.write_json(self.niches, {'categories':{'cat':{'folder':'atlas','designs':[], 'shared_designs':[]},
                                                    'old':{'folder':'other','designs':['design'], 'shared_designs':[]}}})
        self.initial_files = self.snapshot(self.source)
        self.initial_definition = json.loads(self.definition.read_text())
        self.initial_niches = json.loads(self.niches.read_text())
        self.fail_upsert_id = None
        self.fail_write_path = None

        async def upsert_video(video_id, production_id, details):
            await self.video_collection.upsert({'video_id':video_id, 'production_id':production_id}, match=['video_id'])
            self.details.records[video_id] = copy.deepcopy(details)
            self.records[video_id] = {'video_id':video_id,'production_id':production_id,
                                      'details':copy.deepcopy(details),'resources':[],'logs':[]}
            if self.fail_upsert_id == video_id:
                self.fail_upsert_id = None
                raise RuntimeError('injected registry failure')

        def get_video(video_id):
            return copy.deepcopy(self.records.get(video_id))

        def write(path, value):
            self.write_json(path, value)
            if self.fail_write_path == path:
                self.fail_write_path = None
                raise RuntimeError('injected write failure')

        def fingerprint(path):
            return self.snapshot(path)

        class Production:
            showcase = types.SimpleNamespace(_definition=lambda _id: ({}, {'entries':[{'label':'one','summary':'ok'}]}))

        modules = {
            'src.adapters.data.file_locks':fake_module('locks', AsyncFileLock=Lock),
            'src.adapters.showcase.filesystem':fake_module('filesystem', _write=write),
            'src.adapters.showcase.production':fake_module('production', FilesystemDesignProduction=Production,
                fingerprint=fingerprint, rewrite_references=lambda *_: None),
            'src.adapters.showcase.technical_review':fake_module('review', review_files=lambda *_: {
                'issues':[],'warnings':[],'files_checked':1,'resources_checked':1}),
            'src.config.profile_layout':fake_module('layout', layout_for_settings=lambda _:self.layout),
            'src.config.settings':fake_module('settings', settings=types.SimpleNamespace(templates_dir=self.templates,niches_path=self.niches)),
            'src.core.content_registry':fake_module('registry', get_video=get_video, upsert_video=upsert_video),
            'src.core.data':fake_module('data', collection=lambda name:self.stores[name], coordination=Lock, documents=lambda _:self.details),
            'src.core.explainer.production_templates':fake_module('templates', ID=re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}\Z')),
            'src.core.explainer.catalog':fake_module('catalog', list_videos=lambda:[]),
            'src.core.category_creation':fake_module('creation', _config_lock=lambda _:nullcontext(), _write_config_atomically=self.write_json),
            'src.core.categories':fake_module('categories', reload_categories=lambda:None),
        }
        for name in ('src','src.adapters','src.adapters.data','src.adapters.showcase','src.config','src.core','src.core.explainer'):
            package = fake_module(name)
            package.__path__ = []
            modules[name] = package
        self.module_patch = patch.dict(sys.modules, modules)
        self.module_patch.start()
        self.addCleanup(self.module_patch.stop)
        spec = importlib.util.spec_from_file_location('relocate_test', Path(__file__).parent/'relocate_demo.py')
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    @staticmethod
    def write_json(path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, sort_keys=True))

    @staticmethod
    def snapshot(directory):
        return {str(path.relative_to(directory)):path.read_bytes() for path in directory.rglob('*') if path.is_file()}

    def assert_rolled_back(self):
        self.assertTrue(self.source.is_dir())
        self.assertFalse(self.target.exists())
        self.assertEqual(self.snapshot(self.source), self.initial_files)
        self.assertEqual(json.loads(self.definition.read_text()), self.initial_definition)
        self.assertEqual(json.loads(self.niches.read_text()), self.initial_niches)
        self.assertEqual(self.showcase.records, self.original_showcase)
        self.assertEqual(self.video_collection.records, {'demo-old':{'video_id':'demo-old','production_id':'p1'}})
        self.assertEqual(self.details.records, {'demo-old':self.before['details']})
        journal = self.layout.runtime_dir/'design-production-corrections/design.json'
        self.assertEqual(json.loads(journal.read_text())['state'], 'rolled_back')

    def test_failure_after_folder_move_restores_files_and_records(self):
        self.fail_write_path = self.target/'info.json'
        with self.assertRaisesRegex(RuntimeError, 'injected write'):
            asyncio.run(self.module.run(self.args))
        self.assert_rolled_back()

    def test_failure_after_showcase_update_restores_categories_and_showcase(self):
        self.showcase.after_upsert = lambda: (_ for _ in ()).throw(RuntimeError('injected showcase failure'))
        with self.assertRaisesRegex(RuntimeError, 'injected showcase'):
            asyncio.run(self.module.run(self.args))
        self.assert_rolled_back()

    def test_failure_after_original_registry_update_removes_new_record_and_restores_old(self):
        self.fail_upsert_id = 'demo-old'
        with self.assertRaisesRegex(RuntimeError, 'injected registry'):
            asyncio.run(self.module.run(self.args))
        self.assert_rolled_back()

    def test_recover_interrupted_transaction(self):
        real_rollback = self.module.rollback

        async def interruption(*_args):
            raise RuntimeError('injected rollback interruption')

        self.module.rollback = interruption
        self.fail_write_path = self.target/'info.json'
        with self.assertRaisesRegex(RuntimeError, 'rollback interruption'):
            asyncio.run(self.module.run(self.args))
        self.assertTrue(self.target.exists())
        self.assertFalse(self.source.exists())
        self.module.rollback = real_rollback
        self.args.apply = False
        self.args.recover = True
        asyncio.run(self.module.run(self.args))
        self.assert_rolled_back()

    def test_success_moves_and_updates_references(self):
        asyncio.run(self.module.run(self.args))
        self.assertFalse(self.source.exists())
        self.assertTrue(self.target.is_dir())
        self.assertEqual((self.target/'assets/thumbnails/poster.jpg').read_bytes(), b'original poster')
        self.assertEqual(json.loads((self.target/'manifest.json').read_text())['video_id'], 'demo')
        self.assertEqual(self.details.records['demo']['folder_key'], 'bundled/atlas/demo')
        self.assertEqual(self.details.records['demo-old']['folder_key'], 'bundled/atlas/demo')
        self.assertEqual(self.showcase.records['design']['category_path'], 'cat')
        config = json.loads(self.niches.read_text())['categories']
        self.assertIn('design', config['cat']['designs'])
        self.assertIn('design', config['old']['shared_designs'])

    def test_dry_run_never_moves_or_updates_records(self):
        self.args.apply = False
        asyncio.run(self.module.run(self.args))
        self.assertEqual(self.snapshot(self.source), self.initial_files)
        self.assertFalse(self.target.exists())
        self.assertEqual(self.showcase.records, self.original_showcase)
        self.assertEqual(json.loads(self.niches.read_text()), self.initial_niches)


if __name__ == '__main__':
    unittest.main()
