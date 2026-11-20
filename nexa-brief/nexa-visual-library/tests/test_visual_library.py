import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from visual_library import get_resource, load_catalog, read_svg, search_catalog


class VisualLibraryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = load_catalog()

    def test_search_and_pagination(self):
        page = search_catalog(self.catalog, query='servidor', provider='lucide', limit=1)
        self.assertGreaterEqual(page['total'], 1)
        self.assertEqual(page['items'][0]['id'], 'icon.lucide.server')
        self.assertEqual(search_catalog(self.catalog, query='servidor', provider='lucide', offset=page['total'])['items'], [])

    def test_read_local_svg_and_reject_bad_paths(self):
        self.assertIn('<svg', read_svg(self.catalog, 'brand.simple-icons.github'))
        self.assertIsNone(get_resource(self.catalog, '../../etc/passwd'))
        with self.assertRaises(ValueError):
            read_svg(self.catalog, '../../etc/passwd')
        row = {**get_resource(self.catalog, 'icon.lucide.server'), 'file': 'icons/../../etc/passwd.svg'}
        with self.assertRaises(ValueError):
            read_svg({**self.catalog, 'resources': [row]}, row['id'])


if __name__ == '__main__':
    unittest.main()
