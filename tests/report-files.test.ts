import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {makePdf,makeSpreadsheet} from '../src/lib/reportFiles';
import {disclaimer,rtcReport,simulationReport} from '../src/lib/reports';
import {simulate} from '../src/lib/simulation';

const simulation=simulate({title:'=1+1 & tributos',regime:'Regime regular',date:'2026-11-18',base:'1250.50',confirmed:false,cbs:{value:'0,9'},ibs:{value:'0,1'},is:{base:'1234.56',rate:'10'}});
test('arquivos PDF e XLSX reais: centavos e percentuais numéricos, texto literal e sem fórmulas',async()=>{
  const report=simulationReport(simulation),pdf=Buffer.from(await (await makePdf(report)).arrayBuffer());
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.match(pdf.toString('latin1'),/%%EOF\s*$/);
  const book=await makeSpreadsheet(report);assert.equal(book.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const parse=spawnSync('python3',['-c',`import sys,zipfile,io,json,xml.etree.ElementTree as E
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None
ns={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
ws=E.fromstring(z.read('xl/worksheets/sheet1.xml')); assert ws.find('.//x:f',ns) is None
strings=[''.join(s.itertext()) for s in E.fromstring(z.read('xl/sharedStrings.xml'))]
rows=[]
for row in ws.findall('.//x:row',ns):
 cells=[]
 for c in row.findall('x:c',ns):
  v=c.findtext('x:v',namespaces=ns); cells.append(strings[int(v)] if c.get('t')=='s' else float(v))
 rows.append(cells)
print(json.dumps(rows))`],{input:Buffer.from(await book.arrayBuffer()),encoding:'utf8'});
  assert.equal(parse.status,0,parse.stderr);const rows=JSON.parse(parse.stdout) as (string|number)[][];
  const val=(section:string,label:string)=>rows.find(([s,l])=>s===section&&l===label)?.[2];
  assert.equal(val('Simulação','Cenário'),'=1+1 & tributos');assert.equal(val('Simulação','Total simulado'),(simulation.cbs_cents+simulation.ibs_cents+simulation.is_cents)/100);
  assert.equal(val('IS · base própria','Base de cálculo'),1234.56);assert.equal(val('IS · base própria','Valor simulado'),123.46);assert.equal(val('CBS','Alíquota'),0.009);
  assert.ok(rows.some(r=>r.includes(disclaimer)));
});
test('snapshot preserva fontes, avisos, erros e códigos; registro antigo não ganha premissas atuais',()=>{
  const old=simulationReport({...simulation,details:{origem:'Registro anterior'}});assert.doesNotMatch(JSON.stringify(old),/Arredondamento|Informada manualmente|LC 214/);
  const report=rtcReport({status:200,warning:'6',body:{objetos:[{nObj:1,estadoItem:'CALCULO_SIMULADO',tribCalc:{IBSCBS:{cClassTrib:'000001',vCBS:'7.22'}}},{nObj:2,estadoItem:'NAO_CALCULADO',erros:[{detail:'Revise o documento'}]}],total:{totalTributos:7.22}}},'regular','2027-01-01','Venda',{itens:[{cClassTrib:'000001'}]});
  assert.match(report.summary,/Resultado parcial.*dados simulados/);const rows=report.sections.flatMap(s=>s.rows);
  assert.ok(rows.some(([,v,u])=>v===7.22&&u==='BRL'));assert.ok(rows.some(([,v])=>v==='000001'));assert.ok(rows.some(([,v])=>v==='Revise o documento'));
  const base=rtcReport({status:200,warning:null,body:{baseRG:0,baseSN:null,erros:[{mensagem:'Base inconsistente'}]}},'base','2027-01-01','NFS-e',{});
  assert.match(base.summary,/Há erros/);assert.deepEqual(base.sections[1].rows.slice(0,2),[['Base do regime regular',0,'BRL'],['Base do Simples Nacional','Não informado']]);
});
