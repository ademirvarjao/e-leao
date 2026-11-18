#!/usr/bin/env python3
"""Fetch a fixed list of official public news feeds; never download or execute code."""
import datetime as dt
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path

FEEDS = (
    ('rtc', 'Receita Federal · Reforma tributária', 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/noticias/RSS'),
    ('receita', 'Receita Federal · Últimas notícias', 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/ultimas-noticias/RSS'),
)
MAX_BYTES = 2_000_000

def safe_url(url):
    p = urllib.parse.urlsplit(url.strip())
    return p.scheme == 'https' and p.hostname == 'www.gov.br' and p.port in (None, 443) and not p.username and not p.password

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not safe_url(newurl):
            raise ValueError('Redirecionamento fora do domínio oficial permitido')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def clean(text, limit=300):
    text = re.sub(r'<[^>]*>', ' ', text or '')
    return ' '.join(unescape(text).split())[:limit]

def parse_feed(data):
    if len(data) > MAX_BYTES or re.search(br'<!\s*(DOCTYPE|ENTITY)', data, re.I):
        raise ValueError('Feed inválido ou maior que o limite')
    root = ET.fromstring(data)
    entries = root.findall('./channel/item')
    atom = '{http://www.w3.org/2005/Atom}'
    if not entries:
        entries = root.findall(atom+'entry')
    if not entries and root.tag not in ('rss', atom+'feed'):
        raise ValueError('Formato de feed desconhecido')
    items = []
    for entry in entries:
        title = clean(entry.findtext('title') or entry.findtext(atom+'title'), 250)
        link = entry.findtext('link') or ''
        if not link:
            for candidate in entry.findall(atom+'link'):
                if candidate.get('rel', 'alternate') == 'alternate':
                    link = candidate.get('href', '')
                    break
        link = link.strip()
        date = clean(entry.findtext('pubDate') or entry.findtext(atom+'published') or entry.findtext(atom+'updated'), 100)
        if title and safe_url(link):
            items.append({'title': title, 'url': link, 'date': date})
        if len(items) >= 20:
            break
    return items

def fetch(url):
    if not safe_url(url):
        raise ValueError('URL não permitida')
    opener = urllib.request.build_opener(SafeRedirect())
    request = urllib.request.Request(url, headers={'User-Agent': 'e-Leao/1.0 (official feed reader)', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'})
    with opener.open(request, timeout=20) as response:
        if not safe_url(response.geturl()):
            raise ValueError('URL final não permitida')
        return response.read(MAX_BYTES + 1)

def generate():
    result = {'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'feeds': []}
    for key, name, url in FEEDS:
        try:
            items = parse_feed(fetch(url))
            result['feeds'].append({'id': key, 'name': name, 'url': url, 'ok': True, 'items': items})
        except (OSError, ValueError, ET.ParseError, urllib.error.URLError):
            result['feeds'].append({'id': key, 'name': name, 'url': url, 'ok': False, 'items': []})
    return result

def main():
    output = Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/official-updates.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    result = generate()
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    for feed in result['feeds']:
        print(f"{feed['name']}: {'OK' if feed['ok'] else 'FALHA'} ({len(feed['items'])} itens)")
    if not all(f['ok'] for f in result['feeds']):
        print('Aviso: uma ou mais fontes não foram consultadas. O site indicará a falha.', file=sys.stderr)

if __name__ == '__main__':
    main()
