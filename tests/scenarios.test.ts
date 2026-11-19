import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scenarioPacket, hasPlaceholders} from '../src/lib/scenarioPacket';
import {catalogSource, isInCatalogPeriod, scenarioCode, scenarios, suggestedRate} from '../src/lib/scenarios';
import {simulate} from '../src/lib/simulation';
import {referenceLabel, type Tax} from '../src/lib/rateReferences';

const get = (id:string) => scenarios.find(s=>s.id===id)!;
const regular = 'Regime regular', date = '2026-11-18';
const education = get('ibsCbs:200028');
test('catálogo integral da revisão, com famílias e vigências distintas',()=>{
  assert.deepEqual(['ibsCbs:','is:','sn:','comum:'].map(prefix=>scenarios.filter(s=>s.id.startsWith(prefix)).length),[164,29,15,5]);
  assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);
  for (const s of scenarios) {
    assert.ok(s.name && s.article && s.guidance && s.from);
    if (s.family!=='sn') {assert.match(s.code,/^\d{6}$/);assert.equal(s.code.slice(0,3),s.cst)}
    else assert.match(s.code,/^\d{2}$/);
  }
  const is = get('is:000001');assert.notEqual(is.name,get('ibsCbs:000001').name);
  assert.equal(isInCatalogPeriod(is,date),false);assert.equal(isInCatalogPeriod(is,'2027-01-01'),true);
  const retired = get('ibsCbs:220001');assert.equal(isInCatalogPeriod(retired,date),false);
  assert.equal(isInCatalogPeriod(education,'2026-02-30'),false);
  assert.match(scenarioCode(get('sn:09')),/^cAtivSN 09$/);assert.match(catalogSource,/150cccbe414d4a5edea703e4f7a424af5aa222c7/);
});
test('a referência depende da confirmação, da classificação, do regime e da data, não do rótulo',()=>{
  const ref = (tax:Tax,id:string,dt=date,ok=true) => suggestedRate(tax,regular,dt,get(id),ok);
  assert.equal(ref('CBS',education.id,date,false),undefined);assert.equal(ref('IBS',education.id,'2025-12-31'),undefined);
  assert.equal(ref('CBS',education.id)?.percent,'0,36');assert.equal(ref('IBS',education.id)?.percent,'0,04');
  assert.match(referenceLabel(ref('CBS',education.id)!),/346.*348, III, a.*129.*0,9% × \(1 − 60%\)/);
  assert.equal(ref('IBS',education.id,'2028-12-31')?.percent,'0,04');assert.equal(ref('CBS',education.id,'2027-01-01'),undefined);
  assert.equal(ref('IBS',education.id,'2029-01-01'),undefined);
  assert.equal(ref('CBS','ibsCbs:200052')?.percent,'0,63');assert.equal(ref('IBS','ibsCbs:200052')?.percent,'0,07');
  assert.equal(ref('CBS','ibsCbs:200003')?.percent,'0');assert.equal(ref('IBS','ibsCbs:200014')?.percent,'0');
  assert.equal(ref('CBS','ibsCbs:200003','2027-01-01')?.percent,'0');assert.equal(ref('CBS','ibsCbs:200003','2029-01-01'),undefined);
  assert.equal(ref('CBS','comum:venda')?.percent,'0,9');assert.equal(ref('IBS','comum:servico')?.percent,'0,1');
  for (const id of ['ibsCbs:410004','ibsCbs:515001','ibsCbs:550001','ibsCbs:620001','ibsCbs:200047','ibsCbs:200025','is:000001','sn:09']) assert.equal(ref('IBS',id,'2027-01-01'),undefined,id);
  assert.equal(suggestedRate('CBS','Simples Nacional',date,education,true),undefined);
});
test('memória preserva centavos, premissas, referências realmente aplicadas e limites do registro',()=>{
  const ref = suggestedRate('CBS',regular,date,education,true)!;
  const args = {title:education.label,scenario:education,confirmed:true,regime:regular,date,base:'1000',cbs:{value:ref.percent,reference:ref},ibs:{value:'0,04'}} as const;
  const o = simulate(args);
  assert.deepEqual([o.base_cents,o.cbs_cents,o.ibs_cents,o.is_cents],[100000,360,40,0]);
  assert.equal(o.details.cenarioId,education.id);assert.match(o.details.premissas,/NBS.*Anexo II/);
  assert.equal(o.details.refCbs,referenceLabel(ref));assert.equal(o.details.refIbs,undefined);assert.match(o.details.artigo,/129/);
  assert.ok(o.title.length<=140 && Buffer.byteLength(JSON.stringify(o.details))<24000);
  assert.ok(Object.values(o.details).every(v=>typeof v==='string'));
  const changed=simulate({...args,cbs:{value:'1',reference:ref}});assert.equal(changed.details.refCbs,undefined);assert.match(changed.details.divergencias,/CBS: 1% informado, referência do cenário 0,36%/);
  for (const patch of [{confirmed:false},{scenario:get('ibsCbs:620001')},{date:'2025-01-01'},{regime:'Simples Nacional' as const},{date:'2026-02-30'},{is:{base:'40',rate:'10'}}]) assert.throws(()=>simulate({...args,...patch}));
});
test('modelos RTC não inventam localização, classificação paralela nem alíquotas e respeitam os contratos',()=>{
  const packet = (id:string,d:string) => scenarioPacket(get(id),d)!;
  const a = packet('ibsCbs:620001',date);assert.equal(a.engine,'regular');
  const op = JSON.parse(JSON.stringify(a.operation));assert.equal(op.itens[0].cClassTrib,'620001');assert.equal(op.itens[0].cst,'620');assert.ok(hasPlaceholders(op.itens[0].quantidade));
  const susp=JSON.parse(JSON.stringify(packet('ibsCbs:550001',date).operation));assert.ok(hasPlaceholders(susp.itens[0].tributacaoRegular.cClassTrib));
  assert.ok(!('aliquotasNominais' in op.itens[0]));assert.match(op.dhFatoGerador,/2026-11-18T/);assert.ok(hasPlaceholders(JSON.stringify(op)));
  const b = JSON.parse(JSON.stringify(packet('is:000003','2027-05-06').operation));assert.match(b.itens[0].cClassTrib,/<informar/);
  assert.equal(b.itens[0].impostoSeletivo.cClassTrib,'000003');assert.match(b.itens[0].aliquotasNominais.cbs,/<informar/);assert.match(b.itens[0].aliquotasNominais.impostoSeletivo.adRem,/<informar/);
  const c = packet('sn:09','2027-01-01');assert.equal(c.engine,'simple');
  const sn = JSON.parse(JSON.stringify(c.operation));assert.equal(sn.data,'2027-01-01');assert.equal(sn.tpDoc,'91');assert.equal(sn.itens[0].cAtivSN,'09');assert.match(sn.itens[0].pIBSSN,/<informar/);assert.ok(!('aliquotasNominais' in sn.itens[0]));
  assert.equal(scenarioPacket(get('sn:09'),date),undefined);assert.equal(scenarioPacket(get('is:000003'),date),undefined);
});

test('cada modelo só preenche o documento quando o vínculo é único',()=>{
  for (const s of scenarios) {
    const p = JSON.parse(JSON.stringify(scenarioPacket(s,s.from)!.operation));
    if(s.documents.length===1) assert.equal(p.tpDoc,s.family==='sn'?String(s.documents[0]):s.documents[0]);
    else if(s.family==='sn') assert.ok(hasPlaceholders(p.tpDoc)); else assert.equal(p.tpDoc,undefined);
  }
});
