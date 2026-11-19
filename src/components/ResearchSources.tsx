import {ExternalLink,Globe2,LoaderCircle} from 'lucide-react';
import {publishers,type WebHit} from '../../supabase/functions/_shared/research';
import type {SearchState} from '../lib/webResearch';

function Citation({hit,index,label}:{hit:WebHit;index:number;label:string}) {
  return <div className="research-hit">
    <span>{label} · {publishers[hit.provider]}{hit.date && <> · Data na fonte: {hit.date}</>}</span>
    <a href={hit.url} target="_blank" rel="noopener noreferrer">[{index+1}] {hit.title} <ExternalLink size={12}/></a>
    <details><summary>Ver trecho {index+1}</summary><blockquote>{hit.excerpt}</blockquote></details>
  </div>;
}
export function ResearchSources({result,cited,excerptOnly}:{result:SearchState;cited?:number;excerptOnly:boolean}) {
  if(result.kind==='pending')return <div className="research-status" role="status"><LoaderCircle size={14} className="spin"/> Consultando fontes oficiais…</div>;
  if(result.kind!=='found')return <div className="research-status" role="status">{result.message}</div>;
  const {hits,checkedAt,unavailable}=result.data;
  const related=hits.map((hit,index)=>({hit,index})).filter(row=>row.index!==cited);
  return <section className="research-result" aria-label="Fontes oficiais consultadas"><div className="research-label"><Globe2 size={14}/><b>Fontes oficiais consultadas</b></div>
    {cited!==undefined && hits[cited] && <Citation hit={hits[cited]} index={cited} label={excerptOnly?'Origem do trecho':'Fonte da resposta'}/>}
    {related.length>0 && <details><summary>Resultados relacionados ({related.length})</summary>
      {related.map(row=><Citation key={row.hit.url} {...row} label="Resultado relacionado"/>)}
    </details>}
    {!hits.length && <div>Nenhum trecho pertinente encontrado nas fontes consultadas.</div>}
    <div className="research-time">{result.cached?'Consulta reutilizada':'Consulta realizada'} em <time dateTime={checkedAt}>{new Date(checkedAt).toLocaleString('pt-BR')}</time></div>
    {!!unavailable.length && <div className="research-time">Consulta parcial. Sem resposta de: {unavailable.map(k=>publishers[k]).join(', ')}.</div>}
  </section>;
}
