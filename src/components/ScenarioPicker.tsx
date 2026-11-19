import {memo,useId,useMemo,useState} from 'react';
import {ListFilter,Search} from 'lucide-react';
import {matchesSearch} from '../lib/knowledge';
import {readableDate} from '../lib/fiscal';
import {catalogLabel,catalogSource,scenarioCode,scenarios,type Scenario} from '../lib/scenarios';

const filters = {all:'Todos',common:'Personalizado e usuais',ibsCbs:'IBS e CBS',is:'Imposto Seletivo',sn:'Simples Nacional'};
type Group = keyof typeof filters;
const options = [undefined,...scenarios].map(s=>{
  const group:Group = !s || s.id.startsWith('comum:')?'common':s.family;
  const name = s?.label ?? 'Cenário personalizado';
  const info = s ? scenarioCode(s) : 'Base e alíquotas informadas por você';
  return {s,id:s?.id ?? 'manual',group,name,info,search:`${name} ${info} ${filters[group]} ${s?.name??''} ${s?.group??''} ${s?.article??''}`};
});

export const ScenarioPicker = memo(function ScenarioPicker({selected,date,onPick}:{selected?:Scenario;date:string;onPick:(s?:Scenario)=>void}) {
  const id=useId(), [filter,setFilter]=useState(''), [group,setGroup]=useState<Group>('all');
  const [expanded,setExpanded]=useState(false);
  const rows=useMemo(()=>options.filter(o=>(group==='all'||o.group===group)&&matchesSearch(filter,o.search)),[filter,group]);
  return <section className="panel scenario-browser" aria-labelledby={id}>
    <header className="catalog-head"><div><span className="eyebrow">01 · CATÁLOGO DE OPERAÇÕES</span><h2 id={id}>Escolha o cenário</h2></div><span className="count-badge">{options.length} cenários</span></header>
    <p>Percorra a lista ou filtre pelo nome da operação. Ao escolher, os campos correspondentes aparecem logo abaixo.</p>
    <label className="searchfield catalog-search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="Filtrar cenários" placeholder="Buscar por nome, classificação ou artigo…" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
    <div className="catalog-filters" role="group" aria-label="Filtrar por família">{(Object.keys(filters) as Group[]).map(key=><button key={key} type="button" aria-pressed={key===group} onClick={()=>setGroup(key)}>{filters[key]}</button>)}</div>
    <div className="catalog-results"><span role="status">{rows.length ? `${rows.length} de ${options.length} cenários` : 'Nenhum cenário encontrado.'}</span><div className="actions">{rows.length>4&&<button type="button" className="textbtn" aria-controls={`${id}-lista`} aria-expanded={expanded} onClick={()=>setExpanded(on=>!on)}>{expanded?'Compactar lista':'Expandir lista completa'}</button>}{(filter||group!=='all')&&<button type="button" className="textbtn" onClick={()=>{setFilter('');setGroup('all')}}><ListFilter size={13}/> Limpar filtros</button>}</div></div>
    {rows.length>0&&<div id={`${id}-lista`} className={'catalog-grid'+(expanded?' expanded':'')} role="radiogroup" aria-label="Cenários disponíveis">{rows.map(({s,id:key,name,info})=>{
      const checked=(selected?.id??'manual')===key;
      const period=s&&date&&(date<s.from?`Vigente a partir de ${readableDate(s.from)}`:s.until&&date>s.until?`Vigente até ${readableDate(s.until)}`:'');
      return <label key={key} className={'catalog-option'+(checked?' selected':'')}><input type="radio" name={id} value={key} checked={checked} onChange={()=>onPick(s)}/><span><b>{name}</b><small>{info}</small>{period&&<small className="period-note">{period}</small>}</span></label>;
    })}</div>}
    <div className="catalog-foot"><span>Seleção: <strong>{selected?.label??'Cenário personalizado'}</strong></span><button type="button" className="textbtn" onClick={()=>document.getElementById('dados-cenario')?.focus()}>Ir para os dados da operação ↓</button><a href={catalogSource} target="_blank" rel="noreferrer">{catalogLabel}</a></div>
  </section>;
});
