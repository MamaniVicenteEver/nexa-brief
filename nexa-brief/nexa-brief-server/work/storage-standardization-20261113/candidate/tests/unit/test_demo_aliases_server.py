"""Isolated regression tests for principal-demo compatibility aliases."""
import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


HERE = Path(__file__).resolve().parents[2]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AliasTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.templates = root / 'templates'
        self.profile = root / 'profile'
        self.layout = types.SimpleNamespace(
            schema_version=3, root=self.profile,
            productions_dir=self.profile / 'productions', sandbox_dir=self.profile / 'sandbox',
            renders_dir=self.profile / 'renders',
        )
        self.mod = load('demo_test_templates', HERE / 'src/core/explainer/production_templates.py')
        fake_settings = types.ModuleType('src.config.settings')
        fake_settings.settings = types.SimpleNamespace(templates_dir=self.templates)
        fake_layout = types.ModuleType('src.config.profile_layout')
        fake_layout.layout_for_settings = lambda settings: self.layout
        self.modules = patch.dict(sys.modules, {
            'src.config.settings': fake_settings,
            'src.config.profile_layout': fake_layout,
            'src.core.explainer.production_templates': self.mod,
        })
        self.modules.start()
        self.addCleanup(self.modules.stop)
        self.paths = load('demo_test_paths', HERE / 'src/config/content_paths.py')
        self.add_demo('first', 'atlas', 'economias', aliases=['economias-old'],
                      old=['nodeatlas/economias-old'], origin=('nodeatlas', 'sandbox-old'))

    def add_demo(self, name, category, folder, aliases=(), old=(), origin=('x', 'y')):
        demo = self.templates / category / folder
        demo.mkdir(parents=True)
        (demo / 'manifest.json').write_text('{}')
        (demo / 'assets').mkdir()
        (demo / 'assets' / 'poster.jpg').write_text(name)
        definition = self.templates / '_tools' / 'design-definitions' / name
        definition.mkdir(parents=True)
        (definition / 'design.json').write_text(json.dumps({'production_template': {
            'demo': True, 'folder': f'{category}/{folder}', 'aliases': list(aliases),
            'legacy_production_folders': list(old), 'origin_folder': origin[0], 'project_id': origin[1],
        }}))
        return demo

    def test_old_registered_paths_resolve_to_public_demo_files(self):
        target = self.templates / 'atlas/economias/assets/poster.jpg'
        self.assertEqual(self.paths.resolve_content_key('productions/nodeatlas/economias-old/assets/poster.jpg'), target)
        self.assertEqual(self.paths.resolve_content_key('sandbox/nodeatlas/sandbox-old/assets/poster.jpg'), target)
        self.assertEqual(self.mod.shared_demo(self.templates, 'economias-old'), target.parents[1])

    def test_existing_profile_project_wins_over_alias(self):
        for namespace, name in [('productions', 'economias-old'), ('sandbox', 'sandbox-old')]:
            own = self.profile / namespace / 'nodeatlas' / name / 'assets'
            own.mkdir(parents=True)
            (own / 'poster.jpg').write_text('own')
            self.assertEqual(self.paths.resolve_content_key(f'{namespace}/nodeatlas/{name}/assets/poster.jpg'), own / 'poster.jpg')

    def test_dangling_project_symlink_is_rejected(self):
        parent = self.layout.productions_dir / 'nodeatlas'
        parent.mkdir(parents=True)
        (parent / 'economias-old').symlink_to(self.profile / 'missing')
        with self.assertRaises(ValueError):
            self.paths.resolve_content_key('productions/nodeatlas/economias-old/assets/poster.jpg')

    def test_private_and_traversal_keys_are_rejected(self):
        for namespace, name in [('productions', 'economias-old'), ('sandbox', 'sandbox-old')]:
            for tail in ['work/token.json', 'assets/accounts.json', 'assets/.env', 'assets/../../manifest.json', 'manifest.json']:
                with self.subTest(namespace=namespace, tail=tail):
                    key = f'{namespace}/nodeatlas/{name}/{tail}'
                    if tail in ('work/token.json', 'assets/accounts.json', 'manifest.json') and namespace == 'productions':
                        # Private old paths never alias into the shared demo.
                        result = self.paths.resolve_content_key(key)
                        self.assertTrue(result.is_relative_to(self.layout.productions_dir))
                    else:
                        with self.assertRaises(ValueError):
                            self.paths.resolve_content_key(key)

    def test_conflicting_aliases_never_select_an_arbitrary_demo(self):
        self.add_demo('second', 'news', 'second', aliases=['economias-old'],
                      old=['nodeatlas/economias-old'], origin=('nodeatlas', 'sandbox-old'))
        self.assertIsNone(self.mod.shared_demo(self.templates, 'economias-old'))
        old = self.paths.resolve_content_key('productions/nodeatlas/economias-old/assets/poster.jpg')
        sandbox = self.paths.resolve_content_key('sandbox/nodeatlas/sandbox-old/assets/poster.jpg')
        self.assertTrue(old.is_relative_to(self.layout.productions_dir))
        self.assertTrue(sandbox.is_relative_to(self.layout.sandbox_dir))

    def test_exact_name_wins_over_alias(self):
        actual = self.add_demo('second', 'news', 'economias-old')
        self.assertEqual(self.mod.shared_demo(self.templates, 'economias-old'), actual)


if __name__ == '__main__':
    unittest.main()
