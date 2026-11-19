#!/usr/bin/env python3
"""Export public catalog and nomenclature data from the pinned Receita RTC Flyway sources (see docs/CENARIOS.md)."""
import argparse
import hashlib
import json
import re
import sqlite3
import tarfile
import tempfile
import urllib.request
from pathlib import Path

REVISION = '150cccbe414d4a5edea703e4f7a424af5aa222c7'
SQL_SHA256 = '703add8fe9bfc4fa2ac592d429adc0497cfa36c720d2ab623698b8f6931ca4cb'
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'src/data/rtc-catalog.json'
ASSETS = ROOT / 'public/rtc-referencias'
REPO = 'calculadora-rtc-regime-regular'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise ValueError('Redirecionamento inesperado da fonte RTC fixada.')


def download_sql(root):
    # Only copy SQL from the pinned public archive; export() verifies its digest before executing it.
    url = f'https://codeload.github.com/ReceitaFederal/{REPO}/tar.gz/{REVISION}'
    prefix = f'{REPO}-{REVISION}/flyway/sql/'
    opener = urllib.request.build_opener(NoRedirect())
    with opener.open(url, timeout=30) as response, tarfile.open(fileobj=response, mode='r|gz') as archive:
        size = 0
        for member in archive:
            if not member.isfile() or not member.name.startswith(prefix):
                continue
            name = member.name[len(prefix):]
            if not re.fullmatch(r'(criacao|manutencao)/[\w.-]+\.sql', name):
                continue
            size += member.size
            if size > 12_000_000:
                raise ValueError('SQL supera o limite da revisão.')
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':'))


def reference_files(db):
    version, date = db.execute('select VRBD_VERSAO_BASE_DADO, date(VRBD_DATA) from VERSAO_BASE_DADO order by VRBD_ID desc limit 1').fetchone()
    info = {'version': version, 'date': date, 'sha256': {}}
    assets = {}
    for kind in ('ncm', 'nbs'):
        # Keep parent descriptions (e.g. a leaf named "Outras") and original periods.
        rows = db.execute(f'select {kind}_cd, {kind}_descricao, {kind}_inicio_vigencia, {kind}_fim_vigencia from {kind} order by {kind}_cd')
        content = dump({code: [label, start, end] for code, label, start, end in rows}) + '\n'
        sha = hashlib.sha256(content.encode()).hexdigest()
        info['sha256'][kind] = sha
        assets[ASSETS / f'{kind}-{sha}.json'] = content
    return info, assets


def export(root):
    files = [root/'criacao/beforeMigrate.sql', *sorted((root/'criacao').glob('B*.sql')),
             *sorted((root/'manutencao').glob('V*.sql')), root/'criacao/afterMigrate.sql']
    digest = hashlib.sha256()
    for f in files:
        digest.update(f.name.encode() + b'\0' + f.read_bytes() + b'\0')
    if digest.hexdigest() != SQL_SHA256:
        raise ValueError('Migrações diferentes da revisão fixada; revise a origem antes de importar.')

    db = sqlite3.connect(':memory:')
    db.row_factory = sqlite3.Row
    for f in files:
        sql = f.read_text(encoding='utf-8-sig')
        # Deferred foreign keys must survive until the end of each migration. Scripts
        # explicitly switching foreign_keys need autocommit for that PRAGMA to work.
        tx = f.name.startswith('V') and 'PRAGMA foreign_keys = OFF' not in sql
        db.executescript('BEGIN;\n' + sql + '\nCOMMIT;' if tx else sql)
    if db.execute('pragma foreign_key_check').fetchone():
        raise ValueError('Catálogo inconsistente.')
    groups = {'ibsCbs': [], 'is': [], 'sn': []}
    for r in db.execute('''
        select case when exists (select 1 from TRIBUTO_SITUACAO_TRIBUTARIA join TRIBUTO
                  on TBTO_ID=TRST_TBTO_ID where TRST_SITR_ID=SITR_ID and TBTO_SIGLA='IS')
                  then 'is' else 'ibsCbs' end family,
               CLTR_ID id, CLTR_CD code, CLTR_DESCRICAO name, SITR_CD cst, SITR_DESCRICAO category, SITR_IND_GIBSCBS nominalGroup,
               TRTR_DESCRICAO rtcTreatment, TRTR_IN_EXIGE_GRUPO_DESONERACAO requiresRegular,
               FDLG_TEXTO_CURTO article, CLTR_NOMENCLATURA nomenclature,
               CLTR_INICIO_VIGENCIA 'from', CLTR_FIM_VIGENCIA until
        from CLASSIFICACAO_TRIBUTARIA join SITUACAO_TRIBUTARIA on SITR_ID=CLTR_SITR_ID
        join TRATAMENTO_CLASSIFICACAO on TRCL_CLTR_ID=CLTR_ID
        join TRATAMENTO_TRIBUTARIO on TRTR_ID=TRCL_TRTR_ID
        join FUNDAMENTACAO_CLASSIFICACAO on FDCL_CLTR_ID=CLTR_ID
        join FUNDAMENTACAO_LEGAL on FDLG_ID=FDCL_FDLG_ID order by family, code
    '''):
        row = dict(r)
        if row.pop('nominalGroup') and row['family'] == 'ibsCbs':
            row['nominalGroup'] = True
        if row.pop('requiresRegular'):
            row['requiresRegular'] = True
        row['documents'] = [d[0] for d in db.execute('''
            select TPDF_TIPO from TIPO_DFE_CLASSIFICACAO join TIPO_DFE on TPDF_ID=TDCL_TPDF_ID
            where TDCL_CLTR_ID=? and TDCL_INICIO_VIGENCIA <= ? and TDCL_FIM_VIGENCIA is ? order by TPDF_TIPO
        ''', (row.pop('id'), row['from'], row['until']))]
        groups[row.pop('family')].append(row)
    for r in db.execute('''
        select ATSN_ID id, ATSN_CATIVSN code, ATSN_DESCRICAO name, ATSN_ROTULO annex,
               ATSN_INICIO_VIGENCIA 'from', ATSN_FIM_VIGENCIA until
        from ATIVIDADE_SIMPLES_NACIONAL order by code
    '''):
        row = dict(r)
        row['documents'] = [d[0] for d in db.execute('''
            select TPDF_TIPO from TIPO_DFE_ATIVIDADE_SIMPLES_NACIONAL join TIPO_DFE on TPDF_ID=TDAS_TPDF_ID
            join TIPO_DFE_CALCULO_SIMPLES_NACIONAL on TDCS_TPDF_ID=TPDF_ID
            where TDAS_ATSN_ID=? and TDAS_INICIO_VIGENCIA <= ? and TDAS_FIM_VIGENCIA is ?
            and TDCS_INICIO_VIGENCIA <= ? and TDCS_FIM_VIGENCIA is ? order by TPDF_TIPO
        ''', (row.pop('id'), row['from'], row['until'], row['from'], row['until']))]
        groups['sn'].append(row)
    documents = dict(db.execute('select cast(TPDF_TIPO as text), TPDF_SIGLA from TIPO_DFE order by TPDF_TIPO'))
    places = {}
    for uf, code, name in db.execute('select UF_SIGLA, MUNI_CD, MUNI_NOME from MUNICIPIO join UF on UF_CD=MUNI_UF_CD order by UF_SIGLA, MUNI_CD'):
        places.setdefault(uf, {})[str(code)] = name
    reference, assets = reference_files(db)
    db.close()
    if [len(rows) for rows in groups.values()] != [164, 29, 15]:
        raise ValueError('Cobertura diferente da revisão conferida.')
    for rows in groups.values():
        if len({r['code'] for r in rows}) != len(rows):
            raise ValueError('Código duplicado dentro da mesma família.')
    # One line per record keeps both provenance reviews and diffs small.
    tables = [f'  "{key}": [\n    ' + ',\n    '.join(dump(r) for r in rows) + '\n  ]'
              for key, rows in groups.items()]
    catalog = '{\n  "version": "1.6.1",\n  "revision": "' + REVISION + '",\n  "reference": ' + dump(reference) + ',\n  "documents": ' + dump(documents) + ',\n' + ',\n'.join(tables) + '\n}\n'

    return {DEST: catalog, DEST.with_name('rtc-municipios.json'): dump(places) + '\n'}, assets


def prepared():
    catalog = json.loads(DEST.read_text(encoding='utf-8'))
    if catalog['revision'] != REVISION:
        return False
    for kind in ('ncm', 'nbs'):
        sha = catalog['reference']['sha256'][kind]
        if not re.fullmatch('[0-9a-f]{64}', sha):
            return False
        path = ASSETS / f'{kind}-{sha}.json'
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != sha:
            return False
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sql', type=Path, nargs='?', help='flyway/sql da revisão fixada (sem rede); se omitido, usar GitHub da Receita')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='conferir arquivos versionados, sem escrevê-los')
    mode.add_argument('--prepare', action='store_true', help='preparar somente as tabelas públicas da interface, sem alterar o catálogo versionado')
    args = parser.parse_args()
    if args.prepare and not args.sql and prepared():
        print('Referências NCM/NBS já conferidas (cache local da revisão fixada).')
        return
    with tempfile.TemporaryDirectory() as temp:
        root = args.sql or Path(temp)
        if not args.sql:
            print('Lendo a revisão pública da Receita Federal no GitHub:', REVISION, flush=True)
            download_sql(root)
        versioned, assets = export(root)
    for dest, data in versioned.items():
        if args.check or args.prepare:
            if dest.read_text(encoding='utf-8') != data:
                raise SystemExit(f'{dest.name} diverge da fonte; publicação interrompida.')
        else:
            dest.write_text(data, encoding='utf-8')
    if not args.check:
        for dest, data in assets.items():
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data.encode())
    print('Catálogo, municípios e tabelas NCM/NBS conferidos com a base pública RTC.')


if __name__ == '__main__':
    main()
