import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lookupCode,readCode,referenceEdition} from '../src/lib/rtcReference';

test('nomenclaturas são referências datadas, não uma classificação ou resultado tributário',()=>{
  const rows={'01':['Animais vivos.','2022-04-01','9999-12-31'],'01012100':['-- Reprodutores de raça pura','2022-04-01','9999-12-31'],'59039000':['Outros','2022-04-01','2026-01-31']};
  const result=lookupCode(rows,'ncm','01012100','2026-11-18');assert.deepEqual(result?.parents.map(r=>r.code),['01']);assert.equal(result?.entry.code,'01012100');assert.equal(result?.inPeriod,true);
  assert.equal(lookupCode(rows,'ncm','59039000','2026-01-31')?.inPeriod,true);assert.equal(lookupCode(rows,'ncm','59039000','2026-02-01')?.inPeriod,false);
  assert.equal(lookupCode(rows,'ncm','99999999','2026-11-18'),null);assert.throws(()=>lookupCode(rows,'nbs','01012100','2026-11-18'));assert.throws(()=>lookupCode(rows,'ncm','01012100','2026-02-31'));
});

test('usa tabela da mesma origem com integridade; falha permite repetir e não confunde ausência da tabela com código inexistente',async t=>{
  let fail=true;const requests:string[]=[];
  const table={'101011100':['Serviços de construção de edificações residenciais de um e dois pavimentos','2026-01-01',null]};
  t.mock.method(globalThis,'fetch',async(url:string,init:RequestInit)=>{
    requests.push(url);assert.equal(init.credentials,'omit');assert.equal(init.mode,'same-origin');assert.equal(init.referrerPolicy,'no-referrer');assert.match(init.integrity!,/^sha256-/);
    return fail?new Response('indisponível',{status:503}):Response.json(table);
  });
  await assert.rejects(readCode('nbs','101011100','2026-11-18'));fail=false;
  assert.equal((await readCode('nbs','101011100','2026-11-18'))?.inPeriod,true);assert.equal((await readCode('nbs','101011100','2025-11-18'))?.inPeriod,false);
  assert.deepEqual(requests,Array(2).fill(`./rtc-referencias/nbs-${referenceEdition.sha256.nbs}.json`));
});
