import Decimal from 'decimal.js';
import type {Operation} from './types';
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
export const money=(cents:number)=>currency.format(cents/100);
export const readableDate=(s:string)=>new Date(s.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR');
export const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
export function monthOffset(period:string,offset:number){const [y,m]=period.split('-').map(Number);const d=new Date(y,m-1+offset,15);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
export function monthName(period:string,short=false){const s=new Date(period+'-15T12:00:00').toLocaleDateString('pt-BR',short?{month:'short'}:{month:'long',year:'numeric'}).replace('.','');return s[0].toLocaleUpperCase('pt-BR')+s.slice(1)}
export function decimal(value:string,places=2,max=999999999){const v=value.trim().replace(',','.');if(!new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(v))throw Error('Informe um número válido, sem separador de milhar.');const d=new Decimal(v);if(d.gt(max))throw Error(`Valor acima do limite de ${max}.`);return d;}
const asCents=(n:Decimal)=>n.times(100).toDecimalPlaces(0,Decimal.ROUND_HALF_EVEN).toNumber();
export function estimate(base:string,cbs:string,ibs:string,isRate='0',isBase='0'){
 const b=decimal(base);if(b.lte(0))throw Error('A base de cálculo deve ser maior que zero.');
 const calc=(val:Decimal,rate:string)=>asCents(val.times(decimal(rate,4,100)).div(100));
 return {base_cents:asCents(b),cbs_cents:calc(b,cbs),ibs_cents:calc(b,ibs),is_cents:calc(decimal(isBase),isRate)};
}
export function totals(ops:Operation[],period:string){return ops.filter(o=>o.on_date.startsWith(period)).reduce((a,o)=>{if(o.kind==='simulation'){a.base+=o.base_cents;a.tax+=o.cbs_cents+o.ibs_cents+o.is_cents;a.cbs+=o.cbs_cents;a.ibs+=o.ibs_cents;a.is+=o.is_cents;a.sims++}else a.notes++;return a},{base:0,tax:0,cbs:0,ibs:0,is:0,sims:0,notes:0})}
export function compare(n:number,prev:number){return prev?100*(n-prev)/prev:null}
export function download(content:BlobPart,filename:string,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function exportCsv(ops:Operation[]){const cell=(v:string)=>'"'+(/^[\s]*[=+\-@\t\r]/.test(v)?"'":'')+v.replaceAll('"','""')+'"';const rows=[['Data','Operação','Tipo','Regime','Base / serviço (BRL)','CBS (BRL)','IBS (BRL)','IS (BRL)'],...ops.map(o=>[o.on_date,o.title,o.kind==='invoice'?'Rascunho de NFS-e':'Simulação',o.regime,...[o.base_cents,o.cbs_cents,o.ibs_cents,o.is_cents].map(v=>(v/100).toFixed(2).replace('.',','))])];return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n')}
