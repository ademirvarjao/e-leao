import {portal,type Article} from './types';
import {lc214} from './legal';

// LC 214/2025, art. 1º, I and II. Use the same definitions in the library
// and in the assistant, including while account-specific FAQs are unavailable.
const ibs = 'IBS significa Imposto sobre Bens e Serviços, de competência compartilhada entre os estados, o Distrito Federal e os municípios.';
const cbs = 'CBS significa Contribuição Social sobre Bens e Serviços, de competência da União.';
function glossary(key:string, question:string, answer:string):Article {
  return {id:`glossario-${key}`, category:'Reforma tributária', question, answer, source:lc214, keywords:key};
}
export const glossaryGuides = {
  ibs:glossary('ibs','O que é o IBS?',`${ibs} É um tributo sobre o consumo (LC 214/2025, art. 1º, I).`),
  cbs:glossary('cbs','O que é a CBS?',`${cbs} É um tributo sobre o consumo (LC 214/2025, art. 1º, II).`),
  both:glossary('ibs-cbs','O que são IBS e CBS?',`${ibs} ${cbs} Ambos são tributos sobre o consumo, instituídos pelo art. 1º da LC 214/2025.`),
};
const questions=[
 ['Reforma tributária','Qual é a diferença entre IBS e CBS?',glossaryGuides.both.answer,lc214,'diferença tributos reforma significado cbs ibs imposto consumo'],
 ['Calculadora','Como fazer minha primeira simulação?','Abra a Calculadora RTC, selecione o regime e informe a base tributável já ajustada. Confira as alíquotas do seu cenário antes de calcular. Revise a memória e use Salvar simulação para incluí-la no histórico. A simulação salva não substitui a apuração oficial.','https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/dezembro/comunicado-conjunto','simular calcular calculadora primeira salvar cálculo'],
 ['Notas de serviço','Como emitir uma NFS-e?','Em Notas de serviço, prepare e salve um rascunho. Confira o tomador, a competência, o serviço e o valor. Conclua a emissão no ambiente autorizado. Para ME e EPP optantes pelo Simples, a Receita informa uso do Emissor Nacional a partir de 1º de novembro de 2026; confira as regras aplicáveis ao seu caso. Só a autorização no emissor gera a nota.',portal,'nota emitir emissão nfse nfs-e prefeitura certificado rascunho serviço'],
 ['Simples Nacional','O cálculo do Simples Nacional substitui o DAS?','Não. O motor RTC do Simples trata IBS e CBS por operação, com CRT, atividade, classificação e alíquotas efetivas. Não faz a apuração mensal do PGDAS-D. A estimativa rápida usa os percentuais efetivos que você informa; não escolhe anexo nem calcula fator R.','https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/simples-nacional-nfs-e-nacional-sera-obrigatoria-para-me-e-epp-a-partir-de-1o-de-novembro-de-2026','simples nacional das pgdas anexo fator r'],
 ['Notas de serviço','O que é o DANFSe?','É a representação auxiliar, em PDF, da NFS-e. O gerador da Receita recebe o XML de uma nota e monta o documento para leitura. Ele não assina uma DPS, não transmite a nota e não verifica sua autenticidade no portal. Use o XML autorizado fornecido pelo emissor.','https://www.gov.br/nfse/pt-br','danfse pdf xml impressão documento auxiliar'],
 ['Calculadora','Quando usar o Imposto Seletivo?','O IS tem hipóteses específicas de incidência. Não se aplica automaticamente a toda prestação de serviço. Na estimativa, inclua-o somente se tiver identificado a incidência, a base própria e a alíquota ad valorem. Para classificações e modalidades específicas, consulte o motor RTC e a legislação.','https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/dezembro/comunicado-conjunto','is seletivo incidência base ad valorem'],
 ['Reforma tributária','Posso usar qualquer alíquota a partir de 2027?','Não como alíquota oficial. Na versão analisada do motor regular, operações a partir de 2027 exigem alíquotas nominais informadas e o resultado é identificado como simulado. Antes de 2027 esse bloco não deve ser enviado. Verifique vigências, enquadramento e avisos antes de usar os números.','https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/dezembro/comunicado-conjunto','2026 2027 vigência alíquotas percentuais transição'],
 ['Calculadora','Por que um item não foi calculado?','No modo de observabilidade, uma resposta HTTP 200 pode conter itens inconsistentes, não implementados ou não calculados. Leia o estado e os erros de cada item. Totais parciais não representam o total da operação. Confira a classificação, o documento e a data antes de recalcular.','https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/simples-nacional-nfs-e-nacional-sera-obrigatoria-para-me-e-epp-a-partir-de-1o-de-novembro-de-2026','erro estado observabilidade resultado parcial calculado cst classificação'],
 ['Reforma tributária','Como funciona o ano de teste da CBS e do IBS?','No comunicado conjunto RFB/CGIBS atualizado em 28 de outubro de 2026, o ano de 2026 é tratado como teste. A dispensa de recolhimento descrita depende do cumprimento das obrigações acessórias aplicáveis; consulte o comunicado e as normas e notas técnicas atualizadas para sua operação.','https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/dezembro/comunicado-conjunto','2026 teste dispensa recolhimento obrigação acessória documento eletrônico'],
 ['Simples Nacional','Quando a ME ou EPP do Simples usa a NFS-e nacional?','Segundo a Receita, a Resolução CGSN 191/2026 determina o Emissor Nacional para ME e EPP optantes que prestem serviços sujeitos à NFS-e a partir de 1º de novembro de 2026. As regras de IBS e CBS indicadas pela Receita passam a produzir efeitos para optantes a partir de 2027 nas hipóteses previstas. Confira atualizações e enquadramento.','https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/simples-nacional-nfs-e-nacional-sera-obrigatoria-para-me-e-epp-a-partir-de-1o-de-novembro-de-2026','simples nacional nfse emissor me epp novembro 2026 2027'],
 ['Escrituração','Qual é a diferença entre ECD e ECF?','A ECD corresponde à escrituração contábil digital; a ECF reúne informações contábeis e fiscais, incluindo ajustes para apuração de IRPJ e CSLL. Obrigatoriedade, exceções, leiautes e prazos dependem do período e da situação da entidade. Consulte os manuais atualizados da Receita e o profissional responsável.','https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/download/sped','ecd ecf sped escrituração contábil fiscal irpj csll'],
 ['Contabilidade','Qual norma contábil devo consultar para pequenas empresas?','O CFC disponibiliza a relação de normas simplificadas, incluindo NBC TG 1000, 1001 e 1002. A escolha depende do enquadramento, exercício e demais critérios previstos na norma vigente; não se determina apenas pelo regime tributário. Confirme o texto atualizado com o profissional responsável.','https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/normas-simplificadas-para-pmes/','nbc tg 1000 1001 1002 norma contabilidade pequena empresa microentidade'],
 ['Societário','Onde conferir regras de registro de sociedade limitada?','Consulte o Manual de Registro de Sociedade Limitada do DREI e as orientações da Junta Comercial competente. Verifique a versão vigente, o contrato social e as exigências do caso antes de protocolar constituição ou alteração.','https://www.gov.br/empresas-e-negocios/pt-br/drei/legislacao/instrucoes-normativas/arquivos-instrucoes-normativas-em-vigor/anexo-iv-limitada_compilada.pdf','sociedade limitada ltda contrato social dre i junta comercial registro alteração'],
 ['Contabilidade','Onde consultar orientações do CRC do Rio de Janeiro?','O CRCRJ oferece informações sobre registro e fiscalização profissional e atendimento à classe contábil. Para outras unidades da Federação, consulte o respectivo conselho regional. Verifique sempre a vigência das normas nacionais do CFC.','https://www.crc.org.br/faq/perguntas-frequentes.asp','crcrj crc conselho regional registro profissional fiscalização rio janeiro']
];
export const articles:Article[]=questions.map(([category,question,answer,source,keywords],i)=>({id:`guia-${i+1}`,category,question,answer,source,keywords}));
export const normalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/nfs[\s-]*e/g,'nfse');
export const normalizeTax = (s:string) => normalize(s).replace(/\s+/g,' ')
  .replace(/\b([ic])\.\s*b\.\s*s\b\.?/g,'$1bs')
  .replace(/\bimposto sobre bens e servicos\b/g,'ibs')
  .replace(/\bcontribuicao (?:social )?sobre bens e servicos\b/g,'cbs')
  .replace(/\b(?:aliquotas?|percentua(?:l|is)|p[eo]rcentag(?:em|ens)|por cento)\b|%/g,' aliquota ').replace(/\s+/g,' ').trim();
// Require all typed words, but not an exact phrase or a particular word order.
export function matchesSearch(query: string, text: string) {
  const haystack = normalize(text);
  return normalize(query).trim().split(/\s+/).every(word => haystack.includes(word));
}
const ignore = new Set('que uma como para sobre entre meus meu fazer qual quais dos das nos por sao o a de e os as um na no com ou tem esta voce eu minha posso usar do da ao em se nao minha quero preciso sobre este esse isso melhor'.split(' '));
export function searchTerms(s: string) {
  // Keep the DAS tax document distinct from the Portuguese preposition “das”.
  const input = /^das$/i.test(s.trim()) ? 'pgdas' : s.replace(/\bDAS\b/g,'pgdas').replace(/\bo das\b/gi,'pgdas');
  return [...new Set(normalizeTax(input).split(/[^a-z0-9]+/).filter(w => w && !ignore.has(w)))];
}
const isConsumptionTax = (term:string) => term==='ibs' || term==='cbs';
export const isRateTerm = (term:string) => term==='aliquota' || term==='taxa' || term==='taxas';
const isYear = (term:string) => /^(?:19|20)\d{2}$/.test(term);
const framing = new Set('me quem onde quando quanto quantos ajuda explique explicar significa significam significado definicao diferenca'.split(' '));
export function rank(query: string, items: Article[]) {
  const terms = searchTerms(query);
  const docs = items.map(a => ({a, title:searchTerms(a.question), tags:searchTerms(a.keywords), body:searchTerms(a.answer)}));
  const weight = (doc:typeof docs[number], term:string) => doc.title.includes(term) ? 5 : doc.tags.includes(term) ? 4 : doc.body.includes(term) ? 1 : 0;
  const scores = docs.map(() => 0);
  for (const term of terms) {
    const weights = docs.map(doc => weight(doc,term));
    const rarity = Math.log1p(docs.length / (1 + weights.filter(Boolean).length));
    weights.forEach((w,i) => {scores[i] += w * rarity});
  }
  // For a named tax, a document must cover the requested aspect, not just
  // repeat the same acronym. A year qualifies a rate request, not a definition.
  const subjects = terms.filter(isConsumptionTax);
  const rates = terms.filter(isRateTerm), years = terms.filter(isYear);
  const aspects = terms.filter(t => !isConsumptionTax(t) && !isYear(t) && !isRateTerm(t) && !framing.has(t));
  const qualified = subjects.length > 0 && subjects.length < terms.length;
  return docs.map((doc,i) => ({doc, score:scores[i]})).filter(({doc,score}) => {
    if (!score || !qualified) return score > 0;
    const has = (t:string) => weight(doc,t) > 0;
    return subjects.every(has) && (aspects.length ? aspects : rates).some(has)
      && (!rates.length || (rates.some(has) && years.every(has)));
  }).sort((a,b) => b.score-a.score).map(({doc}) => doc.a);
}
export const safeUrl=(value:string)=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:undefined}catch{return undefined}};
