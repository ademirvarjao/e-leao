import {LawLink} from '../components/LawLink';
import {svrs} from '../lib/legal';
import {useState} from 'react';
import {ArrowRight,BookOpen,ChevronDown,ExternalLink,Search,Sparkles} from 'lucide-react';
import OfficialUpdates from '../components/OfficialUpdates';
import {Empty,PageHeading,Tile} from '../components/ui';
import {useSpace} from '../lib/workspace';
import {matchesSearch,safeUrl} from '../lib/knowledge';
import {navigate} from '../components/nav';
function ScenarioSources() {
  return <details className="inset library-laws"><summary>Onde conferir as regras de um cenário?</summary>
    <p>Operação, local e base de IBS/CBS: <LawLink article="arts. 4º, 11 e 12"/>. Transição de 2026 a 2028: <LawLink article="arts. 343 a 348"/>.</p>
    <p>Confronte o código do documento com a <a href={svrs} target="_blank" rel="noreferrer">classificação tributária da SVRS</a> e com o artigo e o anexo indicados para seu item. Para o Simples, confira a receita, a faixa e o anexo na <LawLink simple article="art. 18"/>.</p>
  </details>;
}
export function LibraryPage(){const {knowledge}=useSpace(),[query,setQuery]=useState(''),[category,setCategory]=useState('Todas');const items=knowledge.filter(a=>(category==='Todas'||a.category===category)&&matchesSearch(query,[a.question,a.category,a.answer,a.keywords].join(' ')));return <><PageHeading kicker="INTELIGÊNCIA FISCAL" title="Base de conhecimento" desc="Respostas revisadas e fontes para consultar no seu dia a dia."/><ScenarioSources/><OfficialUpdates/><div className="panel library"><div className="filterbar"><label className="searchfield"><Search size={17}/><input aria-label="Pesquisar na base" placeholder="Pesquisar assunto ou palavra-chave…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Categoria do guia" value={category} onChange={e=>setCategory(e.target.value)}><option>Todas</option>{[...new Set(knowledge.map(a=>a.category))].sort().map(c=><option key={c}>{c}</option>)}</select>{(query||category!=='Todas')&&<button className="btn" onClick={()=>{setQuery('');setCategory('Todas')}}>Limpar filtros</button>}</div><header className="panel-head"><div><div className="eyebrow">GUIAS E RESPOSTAS</div><h2>Perguntas frequentes</h2></div><span className="count-badge">{items.length}</span></header>{items.length?items.map(a=><details className="faq" key={a.id}><summary><Tile icon={BookOpen} color="blue" size={16}/><span><small>{a.category}</small><b>{a.question}</b></span><ChevronDown size={17}/></summary><div><p>{a.answer}</p>{safeUrl(a.source)&&<a className="textbtn" href={safeUrl(a.source)} target="_blank" rel="noreferrer">Consultar fonte <ExternalLink size={14}/></a>}</div></details>):<Empty title="Nenhum guia encontrado" desc="Experimente outro termo ou categoria."/>}</div><section className="portal-card"><div className="block-title"><Tile icon={Sparkles} color="lavender"/><div><h2>Prefere fazer uma pergunta?</h2><p>O assistente consulta esta mesma base para orientar sua pesquisa.</p></div></div><button className="btn" onClick={()=>navigate('assistente')}>Abrir assistente <ArrowRight size={15}/></button></section></>}
