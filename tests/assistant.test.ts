import {test} from 'node:test';
import assert from 'node:assert/strict';
import {articles, matchesSearch, rank} from '../src/lib/knowledge';
import {checkedAnswer, guideContext, inferGuide, resolveQuestion, makePrompt, sameQuestion, type LocalModel} from '../src/lib/assistant';
import {rateReference, transitionGuide} from '../src/lib/rateReferences';
import {lc214} from '../src/lib/legal';
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
test('resposta direta aceita variações de escrita, mas não troca o período nem a fonte',()=>{
  const question='  Quais sao   as ALIQUOTAS de teste de IBS e CBS em 2026! ';
  assert.ok(sameQuestion(question,transitionGuide.question));
  assert.equal(sameQuestion(question.replace('2026','2027'),transitionGuide.question),false);
  assert.deepEqual(guideContext(question,articles),[transitionGuide]);
  const guide=articles.find(a=>a.id==='guia-5')!;
  assert.deepEqual(guideContext(guide.question,[{...guide,source:'http://example.test'},guide],transitionGuide),[guide]);
});
test('significado de IBS/CBS: resposta direta com nomes, competências e fonte, mesmo sem guias do banco',()=>{
  for(const question of ['o que é ibs e cbs?', 'O que SÃO a CBS e o IBS?', 'O que significam as siglas I.B.S. e C.B.S.?', 'IBS/CBS: o que são?', 'Me explica em palavras simples o que é IBS e CBS na reforma tributária', 'O que são os tributos IBS e CBS em 2026?', 'Não quero as alíquotas, quero saber o que é IBS e CBS.']){
    for(const knowledge of [[],articles,[...articles].reverse()]){
      const result=resolveQuestion(question,knowledge,transitionGuide);
      assert.equal(result.useModel,false,question);assert.equal(result.sources.length,1);
      const [guide]=result.sources;assert.equal(guide.source,lc214);assert.match(guide.answer,/Imposto sobre Bens e Serviços.*estados.*Distrito Federal.*municípios/);
      assert.match(guide.answer,/Contribuição Social sobre Bens e Serviços.*União/);assert.match(guide.answer,/tributos sobre o consumo/);assert.doesNotMatch(guide.answer,/alíquota|%|2026/i);
    }
  }
  const single=resolveQuestion('Qual o significado da sigla CBS?',articles).sources[0];assert.match(single.answer,/Contribuição Social/);assert.doesNotMatch(single.answer,/IBS/);
  const onlyIbs=resolveQuestion('Defina o IBS.',articles).sources[0];assert.match(onlyIbs.answer,/Imposto sobre Bens e Serviços/);assert.doesNotMatch(onlyIbs.answer,/CBS/);
  assert.deepEqual(guideContext('Pode resumir?',articles,single),[single]);
});
test('curadoria pertinente prevalece, sem fixar IDs do banco nem reaproveitar fontes inseguras',()=>{
  const custom={...articles[0],id:'conceitos-locais',question:'Qual o significado de CBS e IBS?',answer:'Conceitos revisados pelo espaço.'};
  assert.deepEqual(resolveQuestion('o que é ibs e cbs?',[...articles,custom]),{sources:[custom],useModel:false});
  assert.deepEqual(resolveQuestion('Qual a diferença entre a CBS e o IBS?',articles),{sources:[articles[0]],useModel:false});
  const repurposed={...articles[0],question:'Como apurar a CBS no meu cenário?'};
  const [guide]=guideContext('O que significa IBS e CBS?',[repurposed,{...custom,source:'http://example.test'}]);assert.equal(guide.source,lc214);assert.notEqual(guide.id,repurposed.id);
});
test('alíquotas, regimes e períodos não se confundem com uma definição; só a sigla não responde a uma pergunta específica',()=>{
  const [concept]=guideContext('o que é ibs e cbs?',articles);
  for(const question of ['Qual a alíquota de IBS e CBS em 2026?', 'Quais os percentuais de teste do IBS em 2026?', 'E as alíquotas em 2026?', 'Qual a porcentagem de IBS em 2026?', 'Qual a taxa da CBS em 2026?']){
    assert.equal(guideContext(question,articles,concept)[0],transitionGuide,question);
  }
  assert.deepEqual(guideContext('E em 2027?',articles,transitionGuide),[transitionGuide]);
  assert.equal(guideContext('Como ficam IBS e CBS no Simples Nacional?',articles)[0].category,'Simples Nacional');
  for(const q of ['Quanto é a alíquota de CBS no Simples?', 'Qual a alíquota de CBS em 2035?', 'Qual a alíquota de ISS na transição?', 'Qual a alíquota de CBS em 2028?', 'E em 2035?'])assert.ok(!guideContext(q,articles,transitionGuide).includes(transitionGuide),q);
  for(const q of ['Qual o prazo para ressarcimento de CBS?', 'O que é crédito presumido de IBS?', 'IBS e CBS em 2032?', 'Qual a alíquota de CBS em 2035?', 'O que é a alíquota zero do IBS?', 'Qual a alíquota reduzida da CBS sobre alimentos?']){
    assert.deepEqual(resolveQuestion(q,articles,concept),{sources:[],useModel:false},q);
  }
  const special={...articles[0],id:'outro-guia',question:'Em quais casos se aplica a alíquota zero de IBS?',keywords:'ibs alíquota zero'};
  assert.equal(guideContext('O que é alíquota zero de IBS?',[...articles,special])[0],special);
});
test('seleção sem correspondência literal aceita somente um guia existente no catálogo',async()=>{
  let output='1';const model:LocalModel={close:()=>{},complete:async prompt=>{assert.ok(!prompt[0].content.includes(transitionGuide.question));return output}};const signal=new AbortController().signal;
  assert.equal(await inferGuide(model,'second copy',[articles[4]],signal),articles[4]);
  for(output of ['0','300','https://example.com','1 e 2'])assert.equal(await inferGuide(model,'xyz',articles,signal),undefined);
});
test('feed parcial ou malformado não derruba a biblioteca',()=>{
  const feed={id:'a',url:'https://www.gov.br',name:'Receita',ok:false,items:[]};
  assert.ok(isFeedData({checkedAt:'2026-11-18T12:00:00Z',feeds:[feed]}));
  for(const f of [null,{...feed,items:null},{...feed,items:[null]}])assert.ok(!isFeedData({checkedAt:'2026-11-18',feeds:[f]}));
});
