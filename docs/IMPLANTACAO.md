# Configuração, contas e publicação

## O estado desta instalação

O e-Leão usa o projeto Supabase dedicado `zfmmcnuyegrjmeurbgbl` (região São Paulo), separado do Conversor. As três migrações e os oito guias foram instalados e a Edge Function `eleao-api` foi implantada com verificação JWT. O código e o workflow usam por padrão esse projeto; substituições locais `VITE_SUPABASE_*` devem apontar para o mesmo projeto. Nenhuma operação ou feedback existia na instalação anterior no momento da conferência. Contas Auth não são migradas automaticamente: o proprietário deve cadastrar-se novamente e confirmar o e-mail no projeto dedicado.

Auth do projeto dedicado usa `https://ademirvarjao.github.io/e-leao/` e permite redirects para esse caminho, previews Arena e Vite local. A confirmação de e-mail está ligada; SMTP personalizado não está configurado. Pages e as integrações externas ainda precisam ser verificadas na publicação. O projeto anterior e seus dados não foram removidos; o projeto Conversor não foi alterado nesta migração.

## Publicação do frontend (GitHub Pages)

1. O workflow usa os valores públicos padrão do projeto dedicado em `src/lib/client.ts`, sem variáveis de Actions que possam apontar acidentalmente para outro projeto. Não inclua chaves secretas no frontend.
2. Ative Pages com source **GitHub Actions** e autorize `GITHUB_TOKEN` a publicar Pages. O workflow executa `npm ci`, os testes, build e fallback SPA.
3. Habilite confirmação de e-mail e configure URL de produção, URLs de preview e os redirecionamentos de recuperação em **Supabase Auth → URL Configuration**. No caso de Pages, inclua a URL do host `ademirvarjao.github.io` e o caminho `/e-leao/`; aceite também o host `*.e2b.app` enquanto estiver em desenvolvimento. Não use um redirect wildcard aberto.
4. Confirme `auth.users` e **não** desative a verificação de e-mail para facilitar convites públicos. Configure SMTP de produção se o limite de e-mails do ambiente de desenvolvimento não for suficiente.

Local: `npm ci && npm test && npm run build`. Para demonstração, `npm run dev`. `vite.config.ts` usa base relativa para Pages e HashRouter pequeno para navegação SPA.

## Provisão segura da conta de administrador

**Proprietário: `ademirvarjao@gmail.com`.** O novo projeto tem Auth independente. Cadastre essa conta no e-Leão, confirme o e-mail e entre; a migração `20261118000300_eleao_owner_claim.sql` permite que apenas a própria conta autenticada com esse endereço verificado reivindique o perfil de administrador. A conta antiga não é automaticamente transportada. Nenhuma senha foi lida ou solicitada. A confirmação depende do serviço de e-mail configurado no projeto.

O script administrativo `npm run admin:invite -- --email ...` continua disponível para provisionamento operacional pelo próprio proprietário em uma máquina confiável, com credencial secreta efêmera fora do browser/Git. A promoção de outros membros continua deliberadamente ausente do dashboard.

## Gateway Edge e integração RTC/DANFSe/IA

Implante `supabase/functions/eleao-api/index.ts` no MESMO Supabase do frontend. Os valores padrão Supabase `SUPABASE_URL` e `SUPABASE_ANON_KEY` são fornecidos pelo runtime; exigir JWT e a Edge Function estão ligados apenas após deployment/configuração do gateway. Os clientes do browser não recebem `service_role`, certificados nem tokens upstream. Parâmetros de endpoint só são aceitos pelo servidor:

- `RTC_REGULAR_URL`: base HTTPS, upstream compatible com versão 1.6.1.
- `RTC_SIMPLE_URL`: base HTTPS, contrato SN versão 0.0.6.
- `RTC_BASE_URL`: base HTTPS, endpoint da base unificada da NFS-e.
- `RTC_DANFSE_URL`: **base HTTPS** do renderer Go; a função acrescenta `/api/danfse` e transmite `application/xml` com `stc` e `canhoto` em query, lendo a resposta PDF nativa.
- `RTC_API_TOKEN`, `DANFSE_API_TOKEN`: opcionais, segredo Bearer separado de cada motor apenas quando o host upstream exigir autenticação.
- `OPENAI_API_KEY`: opcional, segredo apenas no Edge runtime. `OPENAI_MODEL` opcional, padrão `gpt-4o-mini`.

Configure somente via secretos de Edge (ex.: `supabase secrets set RTC_REGULAR_URL=… RTC_SIMPLE_URL=… RTC_BASE_URL=… RTC_DANFSE_URL=…`; a sintaxe para cadastrar segredos depende da CLI usada). **Não configure URL de serviço público sem controlo de rede**, aplique auth, TLS, limite de taxa/egress e uma revisão de segurança aos motores que hospedar. Os endereços são allowlist do servidor, nunca escolhidos pelo browser. O gateway aplica cota por utilizador/dia; não grava o corpo ou XML, mas o upstream recebe esses dados. Configure os segredos necessários antes de disponibilizar estas funções. `assistant` envia somente a pergunta e um artigo curado à API externa; sem `OPENAI_API_KEY`, permanece a FAQ local.

**A emissão via API está bloqueada por desenho.** `action=emit` devolve HTTP 501. Para a ativar, é necessário construir e revisar integração SEFIN/ente autorizado, autenticação mútua, credenciamento, assinatura/verificação XMLDSig, certificado armazenado em cofre KMS/vault com consentimento e vínculo de titularidade, Idempotência, contingência/cancelamento/substituição, homologação e auditoria LGPD. Não troque o bloqueio pelo renderer DANFSe. Até essa integração certificada existir, acesse o emissor autorizado e importe o XML efetivamente autorizado para gerar a representação auxiliar.

## Migrações e verificações

Migrações em `supabase/migrations/` são só de domínio `eleao_*`, requerem revisão antes de reaplicar num projeto; confirme `public.eleao_*`, políticas, oito guias, grants e chaves antes de executar. Adapte primeiro o seed/editor se ele divergir dos guias já publicados. Não deixe clientes anon consultarem os artigos da base sem configurar política explícita. Execute `npm test`, `npm run build` e teste isolamento de uma segunda conta num ambiente de teste antes de promover dados reais.

As políticas da versão local estão cobertas por testes de integração PostgreSQL local (PGlite) na migração atual. Ainda devem ser validadas no projeto remoto com duas contas reais, sessão expirada, estado suspenso, convidado ainda não confirmado, recuperação e autorização de administrador. Edge Function, motores externos, renderização final DANFSe, SMTP, IA, cadastro e emissão oficial ainda não foram testados em produção.

## Privacidade e operação

O cliente envia tokens apenas ao Supabase/Edge Function, usa chave publicável e não insere certificados fiscais no histórico. As exportações são locais, o CSV neutraliza fórmulas, e comentários são privados/opt-in. Configure política de privacidade, encarregado/canal LGPD, retenção/descarte, backups, logs mínimos, alerta de abuso, limites de custo IA e política de incidentes antes de produção. Não rotule o painel gerencial como apuração contabilística do contribuinte. Atualize e teste cada versão upstream, catálogo, taxa e vigência antes de mudar qualquer taxonomia exibida.
