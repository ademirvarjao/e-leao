import {useState} from 'react';
import {Activity} from 'lucide-react';
import {checkFiscalService,friendly} from '../lib/client';
import type {FiscalService} from '../lib/rtc';
import {useSpace} from '../lib/workspace';

export function FiscalServiceCheck({service}:{service:FiscalService}) {
  const {session,auth}=useSpace();
  const [busy,setBusy]=useState(false), [message,setMessage]=useState('');
  async function check() {
    if(!session) {auth('login');return}
    setBusy(true);setMessage('');
    try {
      const v=await checkFiscalService(service);
      setMessage([service==='danfse'?'O gerador respondeu à verificação de prontidão.':'O serviço respondeu à consulta de versão.',v.appVersion && `Aplicação: ${v.appVersion}.`,v.dbVersion && `Base: ${v.dbVersion}.`].filter(Boolean).join(' '));
    } catch(e) {setMessage(friendly(e))} finally {setBusy(false)}
  }
  return <div className="rtc-service-check"><button type="button" className="textbtn" disabled={busy} onClick={check}><Activity size={16}/>{busy?'Verificando…':'Verificar conexão do serviço'}</button>
    <small>Não envia os dados do formulário. Usa uma consulta da cota quando há serviço configurado.</small>
    <div aria-live="polite">{message && <p>{message}</p>}</div></div>;
}
