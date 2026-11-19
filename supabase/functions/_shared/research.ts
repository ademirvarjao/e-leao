// Public wire contract for the browser and Edge. Queries contain *only* these
// canonical, public topics (plus a year), never arbitrary words from a chat.
export const taxNames={IBS:'Imposto sobre Bens e Serviços',CBS:'Contribuição Social sobre Bens e Serviços'} as const;
const topics:Record<string,string> = {
  IBS:'i b s|imposto sobre bens e servicos', CBS:'c b s|contribuicao social sobre bens e servicos|contribuicao sobre bens e servicos',
  'Imposto Seletivo':'', 'NFS-e':'nfse|nota fiscal de servico|nota fiscal de servicos', 'NF-e':'nfe|nota fiscal eletronica',
  DANFSe:'', 'nota fiscal':'notas fiscais', 'Simples Nacional':'simples nacional|pgdas|pgdas d', DAS:'documento de arrecadacao', MEI:'microempreendedor individual',
  'Imposto de Renda':'', IRPF:'dirpf|imposto de renda da pessoa fisica', IRPJ:'imposto de renda da pessoa juridica', CSLL:'', ICMS:'', ISS:'issqn', IPI:'', PIS:'', Cofins:'', ITR:'', IOF:'', INSS:'',
  'reforma tributária':'reforma do consumo', 'LC 214':'lei complementar 214|lei complementar n 214|lei complementar no 214', 'LC 123':'lei complementar 123|lei complementar n 123|lei complementar no 123', 'EC 132':'emenda constitucional 132|emenda constitucional n 132|emenda constitucional no 132',
  'crédito':'creditos|creditamento', 'crédito presumido':'creditos presumidos', 'ressarcimento':'ressarcir', 'restituição':'restituir', 'alíquota':'aliquotas|percentual|percentuais',
  'redução':'reduzida|reduzidas|reducoes', 'isenção':'isento|isencoes|isenta', 'regime regular':'regime geral',
  'transição':'ano de teste', 'obrigação acessória':'obrigacoes acessorias', 'emissão':'emitir|emissor', 'declaração':'declarar|declaracoes',
  'prazo':'prazos|vencimento', 'recolhimento':'recolher', 'apuração':'apurar', 'retenção':'retido|retencao na fonte',
  'produtor rural':'produtores rurais', 'cesta básica':'', 'medicamentos':'medicamento', 'exportação':'exportacoes', 'importação':'importacoes',
  'split payment':'pagamento segregado', 'documento fiscal':'documentos fiscais', 'classificação tributária':'cclasstrib',
  NCM:'', NBS:'', SPED:'', ECD:'', ECF:'', 'escrituração':'escrituracao fiscal', eSocial:'', 'calculadora RTC':'motor rtc',
};
const norm = (s:string) => ' '+s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' ';
const aliases = Object.entries(topics).map(([label,variants])=>({label,keys:[label,...variants.split('|').filter(Boolean)].map(norm)}));
const known=(s:string)=>Object.hasOwn(topics,s) || Object.values<string>(taxNames).includes(s);
const isYear = (s:string)=>/^20\d{2}$/.test(s);
function topicMatches(text:string) {
  // Lowercase "das" is a preposition. Only search the document when named.
  const hay=norm(text.replace(/\bDAS\b/g,'documento de arrecadacao').replace(/\b(das)\b/gi,''));
  return aliases.filter(a=>a.keys.some(k=>hay.includes(k))).map(a=>a.label);
}
export function publicTerms(question:string):string[] {
  const text=question.slice(0,1000), labels=topicMatches(text);
  const terms=labels.filter(t=>!(t==='crédito' && labels.includes('crédito presumido'))).slice(0,7);
  const year=text.match(/\b20\d{2}\b/)?.[0];
  return terms.length && year ? [...terms,year] : terms;
}
export function validTerms(value:unknown):value is string[] {
  return Array.isArray(value) && value.length>0 && value.length<=8 && new Set(value).size===value.length &&
    value.every(t=>typeof t==='string' && (known(t)||isYear(t))) && value.some(known) && value.filter(isYear).length<=1;
}
export const publishers = {receita:'Receita Federal', dou:'Diário Oficial da União', lexml:'LexML Brasil'} as const;
export type Provider = keyof typeof publishers;
export type WebHit = {provider:Provider; title:string; url:string; excerpt:string; date?:string};
export type Research = {checkedAt:string; hits:WebHit[]; unavailable:Provider[]};
const provider = (v:unknown):v is Provider => typeof v==='string' && Object.hasOwn(publishers,v);
const plain = (v:unknown,max:number):v is string => typeof v==='string' && !!v.trim() && v.length<=max && !/[<>\u0000-\u001f]/.test(v);
const douPrefix='https://www.in.gov.br/web/dou/-/';
export function douDocument(slug:unknown) {
  if(typeof slug!=='string' || slug.length>600)return;
  try{const id=decodeURIComponent(slug);if(/^[\p{L}\p{N}][\p{L}\p{N}._~-]*$/u.test(id))return douPrefix+encodeURIComponent(id)}catch{/* not a document identifier */}
}
export function officialUrl(source:Provider,url:string) {
  try {
    const u=new URL(url); if (u.protocol!=='https:' || u.username || u.password || u.port || u.search || u.hash || /%(?:2f|5c|00)/i.test(u.pathname)) return false;
    if(source==='receita') return u.hostname==='www.gov.br' && u.pathname.startsWith('/receitafederal/pt-br/');
    if(source==='dou') return u.href.startsWith(douPrefix) && u.href===douDocument(u.href.slice(douPrefix.length));
    return source==='lexml' && u.hostname==='www.lexml.gov.br' && /^\/urn\/urn:lex:br:federal:[\w.:;~-]+$/.test(u.pathname);
  }catch{return false}
}
export function validHit(value:unknown):value is WebHit {
  if(!value || typeof value!=='object') return false;
  const v=value as WebHit;
  return provider(v.provider) && plain(v.url,1500) && officialUrl(v.provider,v.url) && plain(v.title,220) && plain(v.excerpt,650) && (v.date===undefined || plain(v.date,80));
}
export function validResearch(value:unknown):value is Research {
  if(!value || typeof value!=='object') return false;
  const v=value as Research;
  return typeof v.checkedAt==='string' && Number.isFinite(Date.parse(v.checkedAt)) && Array.isArray(v.hits) && v.hits.length<=3 && v.hits.every(validHit)
    && Array.isArray(v.unavailable) && v.unavailable.length<3 && v.unavailable.every(provider) && new Set(v.unavailable).size===v.unavailable.length &&
    v.hits.every(h=>!v.unavailable.includes(h.provider)) && new Set(v.hits.map(h=>h.url)).size===v.hits.length;
}
// Do not mistake a matching acronym or the date of publication for evidence
// about a specific credit, rate or period. Favor relevant primary material.
export function selectHits(terms:string[],rows:WebHit[]) {
  const seen=new Set<string>(), years=terms.filter(isYear), wanted=terms.filter(t=>!isYear(t));
  const taxes=wanted.filter(t=>[...Object.values(taxNames),'IBS','CBS','IRPF','IRPJ','ICMS','ISS','IPI','MEI','Simples Nacional'].includes(t));
  const focus=wanted.filter(t=>!taxes.includes(t));
  return rows.filter(validHit).map(hit=>{
    const text=hit.title+' '+hit.excerpt;
    const matchedLabels=(s:string)=>[...topicMatches(s),...Object.values(taxNames).filter(name=>norm(s).includes(norm(name)))];
    const labels=matchedLabels(text),titles=matchedLabels(hit.title);
    const matched=wanted.filter(t=>labels.includes(t));
    const relevant=taxes.every(t=>labels.includes(t)) && (!focus.length || focus.some(t=>labels.includes(t))) &&
      matched.length>=Math.ceil(wanted.length*.6) && years.every(y=>norm(text).includes(` ${y} `));
    return {hit,score:relevant?matched.length*3+wanted.filter(t=>titles.includes(t)).length:0};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).filter(({hit})=>{
    if(seen.has(hit.url))return false;seen.add(hit.url);return true;
  }).slice(0,3).map(x=>x.hit);
}
