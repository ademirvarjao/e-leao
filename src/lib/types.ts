export type Page = 'visao-geral'|'calculadora'|'notas'|'historico'|'assistente'|'biblioteca'|'configuracoes'|'administracao'|'revisao';
export type Regime = 'Regime regular'|'Simples Nacional';
export type Operation = {id:string;owner_id?:string;kind:'simulation'|'invoice';title:string;on_date:string;regime:Regime;base_cents:number;cbs_cents:number;ibs_cents:number;is_cents:number;details:Record<string,string>;created_at:string};
export type Article = {id:string;category:string;question:string;answer:string;source:string;keywords:string};
export type Profile = {id:string;display_name:string;role:'admin'|'member';active:boolean;approval_status:'pending'|'approved'|'rejected';created_at:string};
export const portal='https://www.nfse.gov.br/EmissorNacional';
