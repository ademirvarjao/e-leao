import Decimal from 'decimal.js';
import type {SheetData} from 'write-excel-file/universal';
import {displayValue,type Report} from './reports';

export async function makeSpreadsheet(report:Report):Promise<Blob>{
  const {default:write}=await import('write-excel-file/universal');
  const heading=(value:string)=>({value,type:String,fontWeight:'bold' as const,backgroundColor:'#20334C',textColor:'#FFFFFF'});
  const rows:SheetData=[[heading('Seção'),heading('Campo'),heading('Valor')],['e-Leão',report.title,{type:String,value:report.summary,wrap:true}]];
  for(const section of report.sections)for(const [label,value,unit] of section.rows){
    // Explicit String type keeps classifications, titles beginning with '=' and
    // arbitrary motor messages literal. No formulas or external workbook links.
    rows.push([section.title,{value:label,type:String,wrap:true},typeof value==='number'?{type:Number,value:unit==='%'?new Decimal(value).div(100).toNumber():value,format:unit==='BRL'?'"R$" #,##0.00######':unit==='%'?'0.00####%':undefined}:{type:String,value,wrap:true}]);
  }
  return write(rows,{sheet:'Resultado',columns:[{width:29},{width:44},{width:74}],stickyRowsCount:1}).toBlob();
}
export async function makePdf(report:Report):Promise<Blob>{
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});pdf.setProperties({title:report.title,author:'e-Leão',subject:'Relatório informativo da calculadora'});
  const clean=(s:string)=>s.replace(/\u00a0/g,' ').replace(/−/g,'-').replace(/→/g,' para ').replace(/[\x00-\x08\x0b-\x1f]/g,'');
  let y=0;
  function page(){pdf.setFillColor('#20334C');pdf.rect(0,0,210,22,'F');pdf.setTextColor('#FFFFFF');pdf.setFont('helvetica','bold');pdf.setFontSize(13);pdf.text('e-Leão  |  '+report.title,15,14);y=32}
  function space(height:number){if(y+height>279){pdf.addPage();page()}}
  function font(bold:boolean,size:number){pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor('#20334C')}
  function paragraph(text:string){font(false,10);const lines=pdf.splitTextToSize(clean(text),180) as string[];for(const line of lines){space(5);font(false,10);pdf.text(line,15,y);y+=5}}
  page();paragraph(report.summary);
  for(const section of report.sections){space(18);y+=3;pdf.setFillColor('#ECF1F6');pdf.rect(15,y-4,180,8,'F');font(true,10);pdf.text(clean(section.title),18,y+1);y+=11;
    for(const row of section.rows){font(true,9);const left=pdf.splitTextToSize(clean(row[0]),65) as string[];font(false,10);const right=pdf.splitTextToSize(clean(displayValue(row)),108) as string[];
      for(let i=0;i<Math.max(left.length,right.length);i++){space(5);if(left[i]){font(true,9);pdf.text(left[i],16,y)}if(right[i]){font(false,10);pdf.text(right[i],85,y)}y+=5}
      y+=2;
    }
  }
  const count=pdf.getNumberOfPages();for(let i=1;i<=count;i++){pdf.setPage(i);font(false,8);pdf.text('e-Leão · Relatório informativo, sem valor de documento fiscal.',15,289);pdf.text(`${i} / ${count}`,195,289,{align:'right'})}
  return pdf.output('blob');
}
