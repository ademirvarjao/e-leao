// Public nomenclature only. The browser downloads a same-origin table, never sends the code/date of an operation.
import catalog from '../data/rtc-catalog.json';
import {validDate} from './fiscal';
export type Nomenclature='ncm'|'nbs';
export const referenceEdition=catalog.reference;
export type ReferenceEntry={code:string;label:string;from:string;until:string|null};
export type CodeReference={entry:ReferenceEntry;parents:ReferenceEntry[];inPeriod:boolean};
const cache:Partial<Record<Nomenclature,Promise<Record<string,unknown>>>>={};
export const completeCode=(kind:Nomenclature,code:string)=> (kind==='ncm'?/^\d{8}$/:/^\d{9}$/).test(code);
function entry(table:Record<string,unknown>,code:string):ReferenceEntry|undefined {
  if(!Object.hasOwn(table,code)) return;
  const row=table[code];
  if(!Array.isArray(row) || typeof row[0]!=='string' || typeof row[1]!=='string' || !validDate(row[1]) || (row[2]!==null && (typeof row[2]!=='string' || !validDate(row[2])))) throw Error('Tabela incompatível');
  return {code,label:row[0],from:row[1],until:row[2]};
}
const validOn=(row:ReferenceEntry,date:string)=>date>=row.from && (!row.until || date<=row.until);
export function lookupCode(table:Record<string,unknown>,kind:Nomenclature,code:string,date:string):CodeReference|null {
  if(!validDate(date) || !completeCode(kind,code)) throw Error('Informe um código e uma data válidos.');
  const leaf=entry(table,code);
  if(!leaf) return null;
  const parents:ReferenceEntry[]=[];
  for(let i=2;i<code.length;i++) {const parent=entry(table,code.slice(0,i)); if(parent && validOn(parent,date)) parents.push(parent)}
  return {entry:leaf,parents,inPeriod:validOn(leaf,date)};
}
async function loadTable(kind:Nomenclature):Promise<Record<string,unknown>> {
  const hash=referenceEdition.sha256[kind], url=`${import.meta.env?.BASE_URL??'./'}rtc-referencias/${kind}-${hash}.json`;
  const integrity='sha256-'+btoa(String.fromCharCode(...hash.match(/../g)!.map(pair=>parseInt(pair,16))));
  const res=await fetch(url,{integrity,credentials:'omit',mode:'same-origin',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
  if(!res.ok) throw Error('Tabela indisponível');
  const table:unknown=await res.json();
  if(!table || typeof table!=='object' || Array.isArray(table)) throw Error('Tabela incompatível');
  return table as Record<string,unknown>;
}
export async function readCode(kind:Nomenclature,code:string,date:string) {
  if(!validDate(date) || !completeCode(kind,code)) throw Error('Informe um código e uma data válidos.');
  const request=cache[kind]??=loadTable(kind).catch(e=>{delete cache[kind];throw e});
  return lookupCode(await request,kind,code,date);
}
