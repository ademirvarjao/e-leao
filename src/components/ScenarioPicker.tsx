import {useId, useMemo, useRef, useState} from 'react';
import {ListFilter} from 'lucide-react';
import {matchesSearch} from '../lib/knowledge';
import {catalogLabel, catalogSource, scenarioCode, scenarios, type Scenario} from '../lib/scenarios';

function display(s: Scenario, date: string) {
  const br = (iso:string) => iso.split('-').reverse().join('/');
  const period = date && date<s.from ? ` · a partir de ${br(s.from)}` : s.until && date>s.until ? ` · até ${br(s.until)}` : '';
  return `${s.code} · ${s.label}${period}`;
}
export function ScenarioPicker({selected, date, onPick}: {selected?: Scenario; date:string; onPick:(scenario?: Scenario) => void}) {
  const [filter,setFilter] = useState('');
  const groups = useMemo(() => {
    const result = new Map<string,Scenario[]>();
    for (const s of scenarios) {
      if (!matchesSearch(filter,`${s.label} ${s.name} ${s.group} ${scenarioCode(s)} ${s.article}`)) continue;
      if (!result.has(s.group)) result.set(s.group,[]);
      result.get(s.group)!.push(s);
    }
    return result;
  },[filter]);
  const rows = [...groups.values()].flat();
  const id = useId(), select = useRef<HTMLSelectElement>(null);
  return <div className="scenario-picker span-all">
    <label className="field" htmlFor={id}><span>Nome do cenário</span></label>
    <div className="scenario-filter"><ListFilter size={15} aria-hidden="true"/><input type="search" aria-label="Filtrar cenários" placeholder="Filtrar por operação ou código: educação, cesta básica, 620001…" value={filter} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();select.current?.focus()}}} onChange={e=>setFilter(e.target.value)}/></div>
    <div className="field"><select ref={select} id={id} value={selected?.id ?? 'manual'} onChange={e=>onPick(scenarios.find(s=>s.id===e.target.value))}>
      <option value="manual">Cenário personalizado · preenchimento manual</option>
      {selected && !rows.includes(selected) && <optgroup label="Seleção atual"><option value={selected.id}>{display(selected,date)}</option></optgroup>}
      {Array.from(groups,([group,items])=><optgroup label={group} key={group}>{items.map(s=><option value={s.id} key={s.id}>{display(s,date)}</option>)}</optgroup>)}
    </select></div>
    <small className="fineprint"><span role="status">{rows.length ? `${rows.length} opções${filter?' no filtro':''}` : 'Nenhuma opção no filtro. Tente outro termo.'}</span> · <a href={catalogSource} target="_blank" rel="noreferrer">{catalogLabel}</a> (18/11/2026). A seleção preserva a base para comparação e limpa as alíquotas. Confira a vigência e o enquadramento.</small>
  </div>;
}
