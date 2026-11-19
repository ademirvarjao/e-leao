#!/usr/bin/env python3
"""Export scenario and municipality metadata from the pinned Receita RTC Flyway sources (see docs/CENARIOS.md)."""
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path

REVISION = '150cccbe414d4a5edea703e4f7a424af5aa222c7'
SQL_SHA256 = '703add8fe9bfc4fa2ac592d429adc0497cfa36c720d2ab623698b8f6931ca4cb'
DEST = Path(__file__).resolve().parents[1] / 'src/data/rtc-catalog.json'


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
    db.close()
    if [len(rows) for rows in groups.values()] != [164, 29, 15]:
        raise ValueError('Cobertura diferente da revisão conferida.')
    for rows in groups.values():
        if len({r['code'] for r in rows}) != len(rows):
            raise ValueError('Código duplicado dentro da mesma família.')
    # One line per record keeps both provenance reviews and diffs small.
    def dump(obj):
        return json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    tables = [f'  "{key}": [\n    ' + ',\n    '.join(dump(r) for r in rows) + '\n  ]'
              for key, rows in groups.items()]
    catalog = '{\n  "version": "1.6.1",\n  "revision": "' + REVISION + '",\n  "documents": ' + dump(documents) + ',\n' + ',\n'.join(tables) + '\n}\n'

    return {DEST: catalog, DEST.with_name('rtc-municipios.json'): json.dumps(places, ensure_ascii=False, separators=(',', ':')) + '\n'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sql', type=Path, help='diretório flyway/sql da revisão ' + REVISION)
    parser.add_argument('--check', action='store_true', help='apenas verificar o JSON versionado')
    args = parser.parse_args()
    for dest, data in export(args.sql).items():
        if args.check:
            if dest.read_text(encoding='utf-8') != data:
                raise SystemExit(f'{dest.name} diverge da fonte.')
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(data, encoding='utf-8')
