import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {articles} from '../src/lib/knowledge';import {reviewItems} from '../src/lib/review';
test('guias oficiais e roteiro possuem fontes seguras sem GitHub',()=>{assert.equal(articles.length,14);for(const item of [...articles,...reviewItems]){const url=new URL(item.source);assert.equal(url.protocol,'https:');assert.notEqual(url.hostname,'github.com')}});
test('migração de guias atualiza originais e preserva curadoria personalizada',async()=>{const db=new PGlite();try{await db.exec(`create table public.eleao_articles(id text primary key, category text,question text,answer text,source text,keywords text)`);await db.exec(await readFile(new URL('../supabase/migrations/20261118000200_eleao_guides.sql',import.meta.url),'utf8'));await db.exec("update public.eleao_articles set answer='Resposta personalizada para preservar', source='https://www.gov.br/' where id='guia-2'");const migration=await readFile(new URL('../supabase/migrations/20261118000500_official_guides.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);const r=await db.query<{id:string;answer:string;source:string}>('select id,answer,source from public.eleao_articles order by id');assert.equal(r.rows.length,14);assert.equal(r.rows.find(x=>x.id==='guia-2')?.answer,'Resposta personalizada para preservar');assert.equal(r.rows.find(x=>x.id==='guia-2')?.source,'https://www.gov.br/');for(const row of r.rows)assert.notEqual(new URL(row.source).hostname,'github.com');assert.match(r.rows.find(x=>x.id==='guia-3')!.answer,/novembro de 2026/)}finally{await db.close()}});

test('a comparação de IBS/CBS usa a mesma definição no banco e no exemplo; a migração não altera a curadoria',async()=>{
  const db=new PGlite();
  const apply=async(name:string)=>db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
  const row=async()=>(await db.query('select * from public.eleao_articles where id=\'guia-1\'')).rows[0];
  const align=()=>apply('20261118001400_ibs_cbs_definition');
  try{
    await db.exec('create table public.eleao_articles(id text primary key, category text, question text, answer text, source text, keywords text)');
    await apply('20261118000200_eleao_guides');await apply('20261118000500_official_guides');
    await db.exec('begin');await align();await align();
    assert.deepEqual(await row(),articles[0]);assert.match(articles[0].answer,/Contribuição Social sobre Bens e Serviços/);
    await db.exec('rollback');
    for(const edit of ["answer='Texto da curadoria'", "source='https://example.test/fonte'", "question='Outra pergunta'"]){
      await db.exec(`begin; update public.eleao_articles set ${edit} where id='guia-1'`);
      const edited=await row();await align();assert.deepEqual(await row(),edited);await db.exec('rollback');
    }
    await db.exec("delete from public.eleao_articles where id='guia-1'");await align();assert.equal(await row(),undefined);
  }finally{await db.close()}
});
