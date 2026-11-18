export type Page = 'visao-geral'|'calculadora'|'notas'|'historico'|'assistente'|'biblioteca'|'configuracoes'|'administracao'|'revisao';
export type Regime = 'Regime regular'|'Simples Nacional';
export type Operation = {id:string;owner_id?:string;kind:'simulation'|'invoice';title:string;on_date:string;regime:Regime;base_cents:number;cbs_cents:number;ibs_cents:number;is_cents:number;details:Record<string,string>;created_at:string};
export type Article = {id:string;category:string;question:string;answer:string;source:string;keywords:string};
export type Profile = {id:string;display_name:string;role:'admin'|'member';active:boolean;approval_status:'pending'|'approved'|'rejected';created_at:string};
export const portal='https://www.nfse.gov.br/EmissorNacional';
export const upstream={regular:'https://github.com/ReceitaFederal/calculadora-rtc-regime-regular/tree/150cccbe414d4a5edea703e4f7a424af5aa222c7',simple:'https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional/tree/c5b0f01c8351c3f0d0795cc617b29d233e9f98df',danfse:'https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse/tree/8d79e6b2f7fad6375340afcb51c85ed370c64a14'};
