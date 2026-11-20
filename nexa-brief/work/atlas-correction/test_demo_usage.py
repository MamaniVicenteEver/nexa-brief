"""Isolated tests of registered demo usage and historical aggregate fallback."""
import asyncio
import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException


HERE = Path(__file__).parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def module(name, **kw):
    result = types.ModuleType(name)
    result.__dict__.update(kw)
    return result


class EmptyCollection:
    def list(self, *_args, **_kwargs):
        return []

    def first(self, *_args, **_kwargs):
        return None


class UsageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.templates = root/'templates'
        self.layout = types.SimpleNamespace(productions_dir=root/'profile/productions', sandbox_dir=root/'profile/sandbox')
        self.layout.productions_dir.mkdir(parents=True)
        self.layout.sandbox_dir.mkdir(parents=True)
        self.demo = self.templates/'nodeatlas'/'demo'
        self.demo.mkdir(parents=True)
        (self.demo/'manifest.json').write_text(json.dumps({'design':'atlas'}))
        (self.demo/'info.json').write_text('{}')
        definition = self.templates/'_tools/design-definitions/atlas/design.json'
        definition.parent.mkdir(parents=True)
        definition.write_text(json.dumps({'id':'atlas','production_template': {
            'demo':True,'folder':'nodeatlas/demo','origin_folder':'nodeatlas','project_id':'demo-old',
            'aliases':['demo-old'],'legacy_production_folders':['nodeatlas/demo-old'],
        }}))
        self.report = {
            'known_totals':{'input_tokens':82948,'cached_input_tokens':130803,'output_tokens':64053,'reasoning_tokens':46314},
            'unknown_calls':11,
            'by_provider':{
                'claude':{'calls':1,'known_calls':1,'unknown_calls':0,'input_tokens':81498,'cached_input_tokens':130803,'output_tokens':54595,'reasoning_tokens':46314},
                'gemini_tts':{'calls':1,'known_calls':1,'unknown_calls':0,'input_tokens':1450,'cached_input_tokens':0,'output_tokens':9458,'reasoning_tokens':0},
                'whisper':{'calls':1,'known_calls':0,'unknown_calls':1,'input_tokens':None,'cached_input_tokens':None,'output_tokens':None,'reasoning_tokens':None},
                'kit':{'calls':10,'known_calls':0,'unknown_calls':10,'input_tokens':None,'cached_input_tokens':None,'output_tokens':None,'reasoning_tokens':None},
            },
        }
        (self.demo/'usage-report.json').write_text(json.dumps(self.report))
        self.templates_module = load('usage_test_definitions', HERE/'production_templates.py')
        self.costs = load('usage_test_costs', HERE/'costs.py')
        self.costs._model_totals = lambda _item:{}
        self.costs._ledger_metric_events = lambda _item:[]
        settings = types.SimpleNamespace(templates_dir=self.templates)
        mods = {
            'src.config.settings':module('settings',settings=settings),
            'src.config.profile_layout':module('layout',layout_for_settings=lambda _:self.layout),
            'src.core.explainer.production_templates':self.templates_module,
            'src.core.data':module('data',collection=lambda _:EmptyCollection()),
            'src.core.explainer.usage_traces':module('traces',read_trace=lambda _:[]),
            'src.templates._tools.sandbox.costs':self.costs,
            'src.presentation.api.file_streaming':module('streaming',serve_file_with_range=lambda *_:None),
            'src.presentation.api.security':module('security',require_internal=lambda:None),
        }
        for name in ('src','src.config','src.core','src.core.explainer','src.templates','src.templates._tools',
                     'src.templates._tools.sandbox','src.presentation','src.presentation.api'):
            package = module(name)
            package.__path__ = []
            mods[name] = package
        mods['src.core'].content_catalog = module('content_catalog')
        mods['src.core'].content_registry = module('content_registry')
        self.patch = patch.dict(sys.modules, mods)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.router = load('usage_test_router', HERE/'content_router.py')

    def test_registered_historical_totals_partial_and_unknown_calls(self):
        result = self.costs._template_cost(self.demo, {})
        self.assertEqual(result['total_tokens'],277804)
        self.assertEqual(result['unmeasured_calls'],11)
        self.assertEqual(result['usage_status'],'partial')
        self.assertTrue(result['estimated'])
        self.assertEqual(result['usage_source'],'historical_report')

    def test_fallback_never_combines_with_backfill_events_or_ledger(self):
        backfill = self.costs._template_cost(self.demo, {'usage_backfill':{'by_model':[{'provider':'claude','input_tokens':3}]}})
        self.assertEqual(backfill['total_tokens'],3)
        self.assertIsNone(backfill['usage_source'])
        event = {'provider':'claude','input_tokens':7,'usage_known':True}
        current = self.costs._template_cost(self.demo, {}, extra_events=[event])
        self.assertEqual(current['total_tokens'],7)
        self.assertIsNone(current['usage_source'])
        ledger = self.demo/'work/usage.jsonl'
        ledger.parent.mkdir()
        ledger.write_text('{"provider":"kit"}\n')
        self.assertEqual(self.costs._template_cost(self.demo, {})['total_tokens'],0)

    def test_inconsistent_or_unregistered_report_is_ignored(self):
        self.report['unknown_calls'] = 10
        (self.demo/'usage-report.json').write_text(json.dumps(self.report))
        self.assertEqual(self.costs._template_cost(self.demo, {})['usage_status'],'unknown')
        other = self.templates/'nodeatlas'/'unregistered'
        other.mkdir()
        (other/'usage-report.json').write_text(json.dumps(self.report))
        self.assertEqual(self.costs._template_cost(other, {})['usage_status'],'unknown')

    def test_bundled_and_video_alias_resolve_only_registered_demo(self):
        for call in (self.router.content_usage('bundled','nodeatlas','demo'),
                     self.router.video_usage('demo'),self.router.video_usage('demo-old')):
            result = asyncio.run(call)
            self.assertEqual(result['content_key'],'bundled/nodeatlas/demo')
            self.assertEqual(result['total_tokens'],277804)
        with self.assertRaises(HTTPException) as error:
            asyncio.run(self.router.content_usage('bundled','nodeatlas','unregistered'))
        self.assertEqual(error.exception.status_code,404)

    def test_bundled_rejects_symlinks_and_video_id_collision(self):
        report = self.demo/'usage-report.json'
        report.unlink()
        report.symlink_to(self.demo/'manifest.json')
        with self.assertRaises(HTTPException) as error:
            asyncio.run(self.router.content_usage('bundled','nodeatlas','demo'))
        self.assertEqual(error.exception.status_code,404)
        report.unlink()
        (self.layout.productions_dir/'nodeatlas/demo').mkdir(parents=True)
        with self.assertRaises(HTTPException) as error:
            asyncio.run(self.router.video_usage('demo'))
        self.assertEqual(error.exception.status_code,409)

    def test_design_usage_includes_demo_once(self):
        result = asyncio.run(self.router.design_usage('atlas'))
        self.assertEqual(len(result['videos']),1)
        self.assertEqual(result['videos'][0]['total_tokens'],277804)


if __name__ == '__main__':
    unittest.main()
