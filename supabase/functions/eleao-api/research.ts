import {DOMParser, type Element} from '@xmldom/xmldom';
import {douDocument, selectHits, type Research, type WebHit, type Provider} from '../_shared/research.ts';

// Search public indexes, not URLs supplied by a user, model or search result.
const receitaFeed='https://www.gov.br/receitafederal/pt-br/assuntos/noticias/ultimas-noticias/RSS';
const gazette='https://www.in.gov.br/consulta/-/buscar/dou';
const catalog='https://www.lexml.gov.br/busca/SRU';
function clean(s:unknown,limit:number) {
  if(typeof s!=='string')return '';
  const text=s.slice(0,8000).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&')
    .replace(/[<>\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  return text.length>limit?text.slice(0,limit-1).trimEnd()+'…':text;
}
function xml(body:string) {
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(body)) throw Error('xml');
  return new DOMParser({onError(level){if(level!=='warning')throw Error('xml')}}).parseFromString(body,'application/xml');
}
const field=(el:Element,name:string) => el.getElementsByTagNameNS('*',name).item(0)?.textContent?.trim() || '';
export function readReceita(body:string):WebHit[] {
  const doc=xml(body), atom=doc.documentElement?.localName==='feed';
  if(!['rss','RDF','feed'].includes(doc.documentElement?.localName||''))throw Error('feed');
  return Array.from(doc.getElementsByTagNameNS('*',atom?'entry':'item')).slice(0,30).map(el=>{
    const url=atom?Array.from(el.getElementsByTagNameNS('*','link')).find(v=>['','alternate'].includes(v.getAttribute('rel')||''))?.getAttribute('href'):field(el,'link');
    return {provider:'receita',url:url||'',title:clean(field(el,'title'),220),excerpt:clean(field(el,'description')||field(el,'summary')||field(el,'content'),650),
      date:clean(field(el,'pubDate')||field(el,'date')||field(el,'published')||field(el,'updated'),80)||undefined};
  });
}
export function readDou(body:string):WebHit[] {
  // Public portlet contract also consumed by gestaogovbr/Ro-dou. Parse only
  // its JSON payload; scripts, result HTML and result URLs are never executed.
  const json=body.match(/<script\b[^>]*\bid=["']_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params["'][^>]*>([\s\S]*?)<\/script\s*>/i)?.[1];
  if(!json)throw Error('dou');
  const {jsonArray}=JSON.parse(json);
  if(!Array.isArray(jsonArray))throw Error('dou');
  return jsonArray.slice(0,20).flatMap(v=>{
    const url=douDocument(v?.urlTitle);
    return url?[{provider:'dou',url,title:clean(v.title,220),excerpt:clean(v.content||v.abstract,650),date:clean(v.pubDate,80)||undefined}]:[];
  });
}
export function readLexml(body:string):WebHit[] {
  const doc=xml(body);
  if(doc.documentElement?.localName!=='searchRetrieveResponse' || doc.getElementsByTagNameNS('*','diagnostic').length)throw Error('sru');
  const rows:WebHit[]=[];
  for(const el of Array.from(doc.getElementsByTagNameNS('*','recordData')).slice(0,12)){
    const urn=field(el,'urn');
    if(!/^urn:lex:br:federal:[\w.:;~-]+$/.test(urn) || !/^Legislaç[ãa]o/i.test(field(el,'facet-tipoDocumento')))continue;
    rows.push({provider:'lexml',url:`https://www.lexml.gov.br/urn/${urn}`,title:clean(field(el,'title'),220),excerpt:clean(field(el,'description'),650),date:clean(field(el,'date'),80)||undefined});
  }
  return rows;
}
// A law's own number is commonly in the title, not its ementa. Resolve these
// public identifiers through the index; still require a returned record and
// relevant content before attributing anything to it.
export function lexmlQuery(terms:string[]) {
  const acts:Record<string,string>={'LC 214':'lei.complementar:2025-01-16;214','LC 123':'lei.complementar:2006-12-14;123','EC 132':'emenda.constitucional:2023-12-20;132'};
  const act=terms.find(t=>Object.hasOwn(acts,t));
  return act?`urn = "urn:lex:br:federal:${acts[act]}"`:`dc.description all "${terms.filter(t=>!/^20\d{2}$/.test(t)).join(' ')}"`;
}
export async function research(terms:string[],signal:AbortSignal,bytes:(r:Response,limit:number)=>Promise<Uint8Array>):Promise<Research> {
  const dou=new URL(gazette), lexml=new URL(catalog), query=terms.join(' ');
  const today=new Date().toISOString().slice(0,10).split('-').reverse().join('-');
  dou.search=new URLSearchParams({q:query,s:'do1',exactDate:'personalizado',publishFrom:'01-01-2000',publishTo:today,sortType:'0',delta:'20'}).toString();
  lexml.search=new URLSearchParams({operation:'searchRetrieve',version:'1.1',recordSchema:'dc',maximumRecords:'10',query:lexmlQuery(terms)}).toString();
  const providers:{provider:Provider;url:URL;accept:string;parse:(s:string)=>WebHit[];limit:number}[]=[
    {provider:'receita',url:new URL(receitaFeed),accept:'application/rss+xml, application/xml, text/xml',parse:readReceita,limit:512_000},
    {provider:'dou',url:dou,accept:'text/html',parse:readDou,limit:1_500_000},
    {provider:'lexml',url:lexml,accept:'application/xml, text/xml',parse:readLexml,limit:512_000},
  ];
  const results=await Promise.allSettled(providers.map(async p=>{
    const res=await fetch(p.url,{method:'GET',headers:{accept:p.accept,'user-agent':'e-Leao/1.0 (consulta fiscal publica)'},credentials:'omit',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(5500)])});
    if(!res.ok){await res.body?.cancel();throw Error('offline')}
    return p.parse(new TextDecoder().decode(await bytes(res,p.limit)));
  }));
  const rows:WebHit[]=[],unavailable:Provider[]=[];
  results.forEach((r,i)=>{if(r.status==='fulfilled')rows.push(...r.value);else unavailable.push(providers[i].provider)});
  if(unavailable.length===providers.length)throw Error('offline');
  return {checkedAt:new Date().toISOString(),hits:selectHits(terms,rows),unavailable};
}
