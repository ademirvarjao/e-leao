import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {friendly} from '../src/lib/messages';
test('mensagens da interface não expõem detalhes técnicos de falhas',()=>{
 for(const error of [new Error('Supabase database connection to internal.example failed'),{message:'relation public.eleao_profiles does not exist'},new Error('secret=sk_private server stack trace'),{message:'permission denied for function eleao_request_access_pow'}]) {
  assert.equal(friendly(error),'Não foi possível concluir a operação. Tente novamente ou entre em contato com o administrador.');
 }
 assert.equal(friendly(new Error('Invalid login credentials')),'E-mail ou senha incorretos.');
 const critical='Senha alterada, mas sessões antigas não puderam ser revogadas. Contate o administrador imediatamente.';
 assert.equal(friendly(new Error(critical)),critical);
 assert.equal(friendly(new Error('Informe um número válido, sem separador de milhar.')),'Informe um número válido, sem separador de milhar.');
});
test('formulário de acesso e configurações não exibem implementação interna',async()=>{
 for(const path of ['../src/components/Auth.tsx','../src/pages/Settings.tsx']){
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(source,/Autenticação protegida pelo Supabase|Espaço pessoal no Supabase|permissões são verificadas no banco|versão analisada de cada componente/i);
 }
});
