import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRtcRequest,changeItem,FormProblem,newDraft,newItem} from '../src/lib/rtcForm';
import {scenarios} from '../src/lib/scenarios';

const get=(id:string)=>scenarios.find(s=>s.id===id)!;
const header={uf:'RJ',municipio:'3303906',_hour:'11:21',_zone:'-03:00'};
const nominal={'aliquotasNominais.cbs':'8,8','aliquotasNominais.ibsEstadual':'0,05','aliquotasNominais.ibsMunicipal':'0,05'};
test('cada cenário abre um formulário inicial sem exemplos e permite montar o item na vigência, sem inferir classificações paralelas',()=>{
  for(const s of scenarios){const d=newDraft(s),simple=s.family==='sn',engine=simple?'simple':'regular',item=d.items[0];
    assert.equal(d.header.tpDoc,s.documents.length===1?String(s.documents[0]):'');assert.throws(()=>buildRtcRequest(engine,s.from,d,s),FormProblem);
    assert.equal(item.baseCalculo,undefined);assert.equal(item['aliquotasNominais.cbs'],undefined);
    if(simple){assert.equal(item.cClassTrib,undefined);Object.assign(d.header,{tpDoc:String(s.documents[0]),CRT:'1'});Object.assign(item,{cClassTrib:'000001',baseCalculo:'150,95',valorImpostoSeletivo:'0'});}
    else {Object.assign(d.header,header);Object.assign(item,{baseCalculo:'150,95',...nominal});
      if(s.family==='is'){assert.equal(item.cClassTrib,undefined);Object.assign(item,{cClassTrib:'000001','impostoSeletivo.baseCalculo':'150,95','aliquotasNominais.impostoSeletivo.adRem':'1,25'})}
      if(!item._nomen)item._nomen='ncm';if(item._nomen==='ncm')item.ncm='27101259';if(item._nomen==='nbs')item.nbs='122011200';
      if(s.requiresRegular)item['tributacaoRegular.cClassTrib']='000001';if(s.cst==='620')Object.assign(item,{quantidade:'1,5',unidade:'LT'});
    }
    const p=buildRtcRequest(engine,s.from,d,s),first=(p.itens as any[])[0];assert.equal(first.numero,1);
    if(simple){assert.equal(p.data,s.from);assert.equal(p.tpDoc,d.header.tpDoc);assert.equal(first.cAtivSN,s.code);assert.equal(first.valorImpostoSeletivo,'0.00');assert.equal(first.baseCalculo,'150.95');assert.ok(!('pIBSSN' in first));}
    else {assert.equal(first.baseCalculo,150.95);assert.equal(first.cst,s.family==='is'?'000':s.cst);assert.equal(first.cClassTrib,s.family==='is'?'000001':s.code);assert.equal(!!first.aliquotasNominais,s.from>='2027-01-01');
      if(s.requiresRegular)assert.deepEqual(first.tributacaoRegular,{cClassTrib:'000001',cst:'000'});
      if(s.family==='is'){assert.equal(first.impostoSeletivo.cClassTrib,s.code);assert.deepEqual(first.aliquotasNominais.impostoSeletivo,{adRem:1.25});}
    }
    assert.doesNotMatch(JSON.stringify(p),/<informar|"_|:null/);
  }
});
test('valida município, documento, hora, centavos e campos condicionais antes de consultar; só serializa campos visíveis',()=>{
  const s=get('ibsCbs:410013'),date='2026-11-18',d=newDraft(s);Object.assign(d.header,header);Object.assign(d.items[0],{baseCalculo:'1200,50',ncm:'27101259',...nominal,'impostoSeletivo.baseCalculo':'45'});
  const submit=()=>buildRtcRequest('regular',date,d,s);
  assert.deepEqual(submit().itens,[{numero:1,cst:'410',cClassTrib:'410013',ncm:'27101259',baseCalculo:1200.50}]);
  for(const [key,bad] of [['municipio','0000000'],['tpDoc','91'],['_hour','25:64']]){const old=d.header[key];d.header[key]=bad;assert.throws(submit,FormProblem);d.header[key]=old}
  for(const [key,bad] of [['ncm','abc'],['baseCalculo','3,999'],['baseCalculo','-5'],['cClassTrib','000001']]){const old=d.items[0][key];d.items[0][key]=bad;assert.throws(submit,FormProblem);d.items[0][key]=old}
  assert.throws(()=>buildRtcRequest('regular','2025-01-01',d,s));assert.throws(()=>buildRtcRequest('simple',date,d,s));
  const second=changeItem(newItem(),'cClassTrib','620001');Object.assign(second,{baseCalculo:'39',_nomen:'ncm',ncm:'27101259'});d.items.push(second);assert.throws(submit,FormProblem);Object.assign(second,{quantidade:'1,3456',unidade:'LT'});assert.equal((submit().itens as any[])[1].quantidade,1.3456);
  const d2=newDraft();Object.assign(d2.header,header,{'gCompraGov.tpEnteGov':'1','gCompraGov.tpOperGov':'3'});Object.assign(d2.items[0],{cClassTrib:'000001',_nomen:'none',_base:'components','gComponentesBC.vProd':'890,90','gComponentesBC.vFrete':'0,03',baseCalculo:'1000000'});
  const p=buildRtcRequest('regular',date,d2);assert.deepEqual(p.gCompraGov,{tpEnteGov:1,tpOperGov:3});assert.deepEqual((p.itens as any[])[0],{numero:1,cClassTrib:'000001',cst:'000',gComponentesBC:{vProd:890.90,vFrete:0.03}});
});
test('base da NFS-e: documentos de ajuste, copropriedade e apuração do Simples não vazam para outra situação',()=>{
  const d=newDraft(),date='2027-01-10';Object.assign(d.header,{opSimpNac:'3',regApIBSCBSSN:'1',situacao:'salaoParceiro',vServ:'952,64',vDescIncond:'50,03',vPIS:'0'});
  d.adjustments.push({tpAjusteBC:'199',vAjusteAplic:'5'});assert.throws(()=>buildRtcRequest('base',date,d),/Descrição do ajuste/);d.adjustments[0].xTpAjusteBC='Ajuste informado';
  const p=buildRtcRequest('base',date,d);assert.equal(p.vServ,952.64);assert.equal(p.regApIBSCBSSN,1);assert.deepEqual(p.documentos,[{tpAjusteBC:'199',vAjusteAplic:5,xTpAjusteBC:'Ajuste informado'}]);
  Object.assign(d.header,{opSimpNac:'1',situacao:'locacao9903','locacao.pCopropriedade':'50','locacao.vTotOper':'800','locacao.vDescIncondTot':'0','locacao.somaAjustesLocImoveis':'20,03'});
  assert.deepEqual(buildRtcRequest('base',date,d),{anoFatoGerador:2027,opSimpNac:1,situacao:'locacao9903',vPIS:0,locacao:{pCopropriedade:50,vTotOper:800,vDescIncondTot:0,somaAjustesLocImoveis:20.03}});
});

test('exportação de combustíveis em 2027 não força nominais de IBS/CBS; incluir IS preserva a base e a classificação paralela',()=>{
  const s=get('ibsCbs:410013'),d=newDraft(s);Object.assign(d.header,header);Object.assign(d.items[0],{baseCalculo:'90',ncm:'27101259',...nominal});
  const submit=()=>buildRtcRequest('regular','2027-03-01',d,s);assert.equal((submit().itens as any[])[0].aliquotasNominais,undefined);
  d.items[0]=changeItem(changeItem(d.items[0],'_useIs','yes'),'impostoSeletivo.cClassTrib','000001');d.items[0]['impostoSeletivo.baseCalculo']='81';
  const i=(submit().itens as any[])[0];assert.equal(i.baseCalculo,90);assert.equal(i.ncm,'27101259');assert.equal(i.impostoSeletivo.cClassTrib,'000001');assert.equal(i.cClassTrib,'410013');
  const ordinary=get('ibsCbs:000001'),other=newDraft(ordinary);Object.assign(other.header,header);Object.assign(other.items[0],{baseCalculo:'10',_nomen:'ncm',ncm:'27101259'});assert.throws(()=>buildRtcRequest('regular','2027-03-01',other,ordinary),/CBS nominal/);
});
