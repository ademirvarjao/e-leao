import type {Operation} from '../lib/types';
import {money, readableDate} from '../lib/fiscal';
import {LawLink} from './LawLink';
import {lc214} from '../lib/legal';

function TaxLine({tax, cents, base, rate, reference}: {tax:string; cents:number; base:number; rate:string; reference?:string}) {
  return <div className="memory-tax"><dt>{tax}</dt><dd><b>{money(cents)}</b>
    <span className="memory-formula">{money(base)} × {rate.replace('.',',')}%</span>
    <small>{reference ? <>Referência aplicada: <a href={lc214} target="_blank" rel="noreferrer">{reference}</a>.</> : 'Alíquota informada manualmente.'}</small>
  </dd></div>;
}
// Render the saved inputs and cent amounts, never today's catalog or a recomputation.
export function SimulationMemory({o}: {o: Operation}) {
  const d = o.details, hasIS = d.isRate !== undefined, simple = o.regime === 'Simples Nacional';
  const total = o.cbs_cents + o.ibs_cents + o.is_cents;
  return <section className="simulation-memory" aria-label="Memória de cálculo">
    <span className="minor-label">TOTAL DOS TRIBUTOS SIMULADOS</span><p className="big-figure">{money(total)}</p>
    <p className="memory-title">{o.title}</p><p className="fineprint">{o.regime} · {readableDate(o.on_date)}</p>
    <dl className="summary-list"><div><dt>Base ajustada de CBS e IBS</dt><dd>{money(o.base_cents)}</dd></div></dl>
    {d.divergencias && <p className="memory-difference"><b>Hipótese manual diferente da referência.</b> {d.divergencias} O cálculo usa os valores informados.</p>}
    <h3>Memória por tributo</h3>
    <dl className="memory-lines"><TaxLine tax="CBS" cents={o.cbs_cents} base={o.base_cents} rate={d.cbs} reference={d.refCbs}/>
      <TaxLine tax="IBS total" cents={o.ibs_cents} base={o.base_cents} rate={d.ibs} reference={d.refIbs}/>
      {hasIS ? <TaxLine tax="IS · base própria" cents={o.is_cents} base={Number(d.isBaseCents)} rate={d.isRate}/> : <div className="memory-tax"><dt>Imposto Seletivo</dt><dd><b>Não incluído</b><small>Isso não demonstra ausência de incidência.</small></dd></div>}
    </dl>
    <p className="fineprint">Total = CBS + IBS{hasIS ? ' + IS' : ''}. Cada valor é arredondado a centavos pelo critério meio par; não inclui créditos, compensações nem outros tributos. O IBS é estimado pelo percentual total, sem arredondamento separado por ente.</p>
    <details className="inset memory-assumptions" open><summary>Premissas e base legal</summary>
      {d.cenarioCodigo ? <><p><b>{d.cenarioCodigo}</b> · {d.classificacao}</p><p>{d.tratamento}. <LawLink article={d.artigo}/>.</p><p>Premissas confirmadas na simulação: {d.premissas}</p><p>Fonte da classificação: {d.catalogo}.</p></> : <p>Cenário personalizado. O enquadramento fiscal não foi verificado.</p>}
      <p>{simple ? <>Não é DAS nem apuração da receita mensal. <LawLink simple article="art. 18"/>.</> : <>A estimativa usa a base ajustada informada; não recompõe o preço da nota. Confira inclusões e exclusões na <LawLink article="art. 12"/>.</>}</p>
      {o.on_date.startsWith('2026-') && <p>{simple ? 'As alíquotas de teste não se aplicam aos optantes.' : 'O total simulado não considera a dispensa de recolhimento condicionada às obrigações acessórias.'} <LawLink article="art. 348"/>.</p>}
      {hasIS && <p>IS apenas ad valorem, sem parcela por unidade. <LawLink article="arts. 409 e 419"/>.</p>}
    </details>
  </section>;
}
