import {test} from 'node:test';
import assert from 'node:assert/strict';
import {articles, matchesSearch, rank} from '../src/lib/knowledge';
import {checkedAnswer, guideContext, inferGuide, makePrompt, type LocalModel} from '../src/lib/assistant';
import {rateReference, transitionGuide} from '../src/lib/rateReferences';
import {isFeedData} from '../src/components/OfficialUpdates';

test('referências têm tributo, regime, vigência e base legal explícitos',()=>{
  const ref=(tax:'CBS'|'IBS',date:string)=>rateReference(tax,'Regime regular',date);
  assert.equal(ref('CBS','2026-01-01')?.percent,'0,9');assert.equal(ref('IBS','2026-12-31')?.article,'343');
  assert.equal(ref('IBS','2027-01-01')?.article,'344');assert.equal(ref('IBS','2028-12-31')?.percent,'0,1');
  assert.equal(ref('CBS','2027-01-01'),undefined);assert.equal(rateReference('CBS','Simples Nacional','2026-06-01'),undefined);
  for(const date of ['2025-12-31','2029-01-01','','2026-02-30','x'])assert.equal(ref('IBS',date),undefined);
});
test('a pesquisa encontra termos não contíguos, respostas e a sigla DAS; os guias mantêm as fontes',()=>{
  assert.ok(matchesSearch(' serviço  consultoria ','Consultoria de serviços'));assert.equal(rank('DAS',articles)[0].id,'guia-4');
  assert.equal(guideContext(transitionGuide.question,articles)[0].id,transitionGuide.id);
  const guide=articles.find(x=>x.id==='guia-5')!;
  assert.equal(guideContext('Pode resumir?',articles,guide)[0],guide);
  assert.equal(guideContext('zyxwv',[{...guide,question:'zyxwv',source:'javascript:confirm()'}]).length,0);
  const messages=makePrompt('  exemplo ',[guide]);assert.equal(messages[1].content,'exemplo');assert.ok(messages[0].content.includes(guide.answer));
  assert.equal(checkedAnswer(' Alíquota de 91%. ',[transitionGuide]),null);assert.equal(checkedAnswer('A CBS é de 0,1% em 2026.',[transitionGuide]),null);
  assert.equal(checkedAnswer(transitionGuide.answer,[transitionGuide]),transitionGuide.answer);
  assert.match(makePrompt('Pode resumir?',[guide],guide.question)[1].content,/anterior: O que é o DANFSe/);
  assert.doesNotMatch(makePrompt('Pode explicar a CBS?',[guide],guide.question)[1].content,/DANFSe/);
  assert.equal(checkedAnswer('   ',[guide]),null);assert.equal(checkedAnswer('<think>rascunho</think>Um documento auxiliar.',[guide]),'Um documento auxiliar.');
});
test('seleção sem correspondência literal aceita somente um guia existente no catálogo',async()=>{
  let output='2';const model:LocalModel={close:()=>{},complete:async()=>output};const signal=new AbortController().signal;
  assert.equal(await inferGuide(model,'second copy',[articles[4]],signal),articles[4]);
  for(output of ['0','300','https://example.com','1 e 2'])assert.equal(await inferGuide(model,'xyz',articles,signal),undefined);
});
test('feed parcial ou malformado não derruba a biblioteca',()=>{
  const feed={id:'a',url:'https://www.gov.br',name:'Receita',ok:false,items:[]};
  assert.ok(isFeedData({checkedAt:'2026-11-18T12:00:00Z',feeds:[feed]}));
  for(const f of [null,{...feed,items:null},{...feed,items:[null]}])assert.ok(!isFeedData({checkedAt:'2026-11-18',feeds:[f]}));
});
