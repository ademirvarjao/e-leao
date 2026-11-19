import {ExternalLink,Globe2,LoaderCircle} from 'lucide-react';
import {publishers} from '../../supabase/functions/_shared/research';
import type {SearchState} from '../lib/webResearch';

export function ResearchSources({result,cited,excerptOnly}:{result:SearchState;cited?:number;excerptOnly:boolean}) {
  if(result.kind==='pending')return <div className="research-status" role="status"><LoaderCircle size={14} className="spin"/> Pesquisando em fontes oficiais…</div>;
  if(result.kind!=='found')return <div className="research-status" role="status">{result.message}</div>;
  const {hits,checkedAt,unavailable}=result.data;
  return <section className="research-result" aria-label="Pesquisa na internet"><div className="research-label"><Globe2 size={14}/><b>Pesquisa em fontes oficiais</b></div>
    <div className="research-time">{result.cached?'Consulta reutilizada':'Consulta realizada'} em <time dateTime={checkedAt}>{new Date(checkedAt).toLocaleString('pt-BR')}</time></div>
    {!hits.length && <div>Nenhum trecho pertinente encontrado nas fontes consultadas.</div>}
    {hits.map((h,i)=><div className="research-hit" key={h.url}>
      <span>{i===cited?(excerptOnly?'Origem do trecho':'Fonte da resposta'):'Resultado relacionado'} · {publishers[h.provider]}{h.date && <> · Data na fonte: {h.date}</>}</span>
      <a href={h.url} target="_blank" rel="noopener noreferrer">[{i+1}] {h.title} <ExternalLink size={12}/></a>
      <details><summary>Ver trecho {i+1}</summary><blockquote>{h.excerpt}</blockquote></details>
    </div>)}
    {!!unavailable.length && <div className="research-time">Consulta parcial. Sem resposta de: {unavailable.map(k=>publishers[k]).join(', ')}.</div>}
  </section>;
}
