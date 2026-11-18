import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('official_updates', pathlib.Path(__file__).parents[1] / 'scripts/official_updates.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class FeedTests(unittest.TestCase):
    def test_rss_filters_external_and_strips_markup(self):
        data = b'''<rss><channel><item><title>&lt;b&gt;Novidade&lt;/b&gt;</title><link>https://www.gov.br/receitafederal/noticia</link><pubDate>Mon</pubDate></item><item><title>Malicioso</title><link>https://evil.example/x</link></item></channel></rss>'''
        self.assertEqual(module.parse_feed(data), [{'title':'Novidade','url':'https://www.gov.br/receitafederal/noticia','date':'Mon'}])
    def test_atom_and_invalid_inputs(self):
        data = b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Noticias</title><link href="https://www.gov.br/a"/><updated>2026-11-18</updated></entry></feed>'
        self.assertEqual(module.parse_feed(data)[0]['date'], '2026-11-18')
        for bad in (b'<!DOCTYPE rss [<!ENTITY x "abc">]><rss/>', b'<html/>', b'x'*(module.MAX_BYTES+1)):
            with self.assertRaises(ValueError): module.parse_feed(bad)
        for url in ('https://www.gov.br.evil.test/x', 'http://www.gov.br/a','https://www.gov.br@evil.test/a'):
            self.assertFalse(module.safe_url(url))
    def test_partial_failure_is_visible(self):
        old = module.fetch
        try:
            def failed(_): raise OSError('offline')
            module.fetch = failed
            result = module.generate()
            self.assertTrue(all(not f['ok'] and not f['items'] for f in result['feeds']))
        finally:
            module.fetch = old

if __name__ == '__main__': unittest.main()
