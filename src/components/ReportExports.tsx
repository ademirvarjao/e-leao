import {useState} from 'react';
import {FileText,Sheet} from 'lucide-react';
import {download} from '../lib/fiscal';
import {displayValue,type Report,type ReportSection} from '../lib/reports';

export function ReportSectionView({section}:{section:ReportSection}){
  return <dl className="report-rows">{section.rows.map((row,i)=><div key={i}><dt>{row[0]}</dt><dd>{displayValue(row)}</dd></div>)}</dl>;
}
export function ReportExports({report,original}:{report:Report;original:unknown}){
  const [busy,setBusy]=useState(''),[error,setError]=useState('');
  async function save(format:'pdf'|'xlsx'){
    if(busy)return;setBusy(format);setError('');
    try {const {makePdf,makeSpreadsheet}=await import('../lib/reportFiles');const blob=await (format==='pdf'?makePdf:makeSpreadsheet)(report);download(blob,`${report.filename}.${format}`,blob.type)}
    catch{setError('Não foi possível gerar o arquivo. Tente exportar novamente.')}
    finally{setBusy('')}
  }
  return <div className="report-exports"><span className="minor-label">EXPORTAR RESULTADO</span><div className="actions"><button type="button" className="btn" disabled={!!busy} onClick={()=>save('pdf')}><FileText size={16}/>{busy==='pdf'?'Gerando PDF…':'Baixar PDF'}</button><button type="button" className="btn" disabled={!!busy} onClick={()=>save('xlsx')}><Sheet size={16}/>{busy==='xlsx'?'Gerando Excel…':'Baixar Excel (.xlsx)'}</button></div>
    <button type="button" className="textbtn" onClick={()=>download(JSON.stringify(original,null,2),report.filename+'.json')}>Dados originais (.json)</button>{error&&<p role="alert">{error}</p>}
  </div>;
}
