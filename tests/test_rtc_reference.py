import hashlib
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('rtc_source', Path(__file__).resolve().parents[1] / 'scripts/import-rtc-catalog.py')
rtc = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(rtc)


class RtcReferenceTest(unittest.TestCase):
    def test_edition_periods_codes_and_asset_integrity(self):
        db = sqlite3.connect(':memory:')
        self.addCleanup(db.close)
        db.executescript('''
          create table VERSAO_BASE_DADO (VRBD_ID integer, VRBD_VERSAO_BASE_DADO text, VRBD_DATA text);
          insert into VERSAO_BASE_DADO values(1,'V0001','2025-01-01'),(59,'V0059','2026-09-30 00:00:00');
          create table ncm(ncm_cd text,ncm_descricao text,ncm_inicio_vigencia text,ncm_fim_vigencia text);
          insert into ncm values('01012100','Reprodutores','2022-04-01','9999-12-31');
          create table nbs(nbs_cd text,nbs_descricao text,nbs_inicio_vigencia text,nbs_fim_vigencia text);
          insert into nbs values('101011100','Serviços de construção','2026-01-01',null);
        ''')
        with tempfile.TemporaryDirectory() as root, patch.object(rtc, 'ASSETS', Path(root)), patch.object(rtc, 'DEST', Path(root) / 'catalog.json'):
            info, assets = rtc.reference_files(db)
            self.assertEqual((info['version'], info['date']), ('V0059', '2026-09-30'))
            rtc.DEST.write_text(json.dumps({'reference': info, 'revision': rtc.REVISION}))
            self.assertFalse(rtc.prepared())
            for file, data in assets.items():
                file.write_bytes(data.encode())
                self.assertIn(hashlib.sha256(data.encode()).hexdigest(), file.name)
            ncm = next(rtc.ASSETS.glob('ncm-*.json'))
            self.assertEqual(json.loads(ncm.read_bytes())['01012100'][2], '9999-12-31')
            self.assertTrue(rtc.prepared())
            ncm.write_text('{}')
            self.assertFalse(rtc.prepared())

    def test_unreviewed_migrations_rejected_before_sql_execution(self):
        with tempfile.TemporaryDirectory() as root:
            sql = Path(root) / 'criacao'
            sql.mkdir()
            for name in ('beforeMigrate.sql', 'afterMigrate.sql'):
                (sql / name).write_text('not SQL')
            with self.assertRaisesRegex(ValueError, 'rev.*fixada'):
                rtc.export(Path(root))
