# Configuração, contas e publicação

## O estado desta instalação

As tabelas exclusivas `eleao_*` e os oito guias editoriais foram instalados no projeto Supabase `byqhiewzkbqvvmldnwky`. A conferência pós-instalação identificou as cinco tabelas com RLS ligado; oito artigos e zero perfis pessoais/operações no momento da verificação. O esquema `conversor_*`, as definições de autenticação de outros produtos e chaves privadas não fazem parte do e-Leão. Os valores de demonstração apresentados anonimamente são do navegador, não registros da base.

O build estático fica em GitHub Pages quando a branch `main` receber a action deste repositório; `workflow_dispatch` também permite executá-la manualmente. A configuração auth Supabase foi consultada: cadastro por e-mail está habilitado, o autoconfirm continua **desligado** e o `site_url` original `https://ademirvarjao.github.io/conversor/` foi preservado. O allowlist recebeu os redirects do novo app `/e-leao/**`, preview Arena `https://*-*.e2b.app/**` e Vite local 5173, sem remover caminhos existentes do Conversor. O SMTP personalizado não está configurado; o e-mail de confirmação/recuperação depende do serviço de e-mail atualmente contratado no projeto e pode estar sujeito aos limites do remetente padrão. Não se alteraram os dados `conversor_*`. A verificação anterior do site Pages não teve permissão para o ativar a partir deste ambiente, portanto ainda não se afirma que `github.com/ademirvarjao/e-leao` está publicado. Verifique **Settings → Pages → Build and deployment → GitHub Actions** no repositório e a permissão para Pages/Actions do owner. Depois execute a action **Build and deploy e-Leão** e verifique a URL do ambiente `github-pages` no run.

## Publicação do frontend (GitHub Pages)

1. Em **Settings → Secrets and variables → Actions → Variables**, confira/adicione `VITE_SUPABASE_URL` (URL do projeto) e `VITE_SUPABASE_PUBLISHABLE_KEY` (chave `sb_publishable_...`; legacy `anon` só quando necessário). São valores públicos de frontend, não credenciais de administração.
2. Ative Pages com source **GitHub Actions** e autorize `GITHUB_TOKEN` a publicar Pages. O workflow executa `npm ci`, os testes, build e fallback SPA.
3. Habilite confirmação de e-mail e configure URL de produção, URLs de preview e os redirecionamentos de recuperação em **Supabase Auth → URL Configuration**. No caso de Pages, inclua a URL do host `ademirvarjao.github.io` e o caminho `/e-leao/`; aceite também o host `*.e2b.app` enquanto estiver em desenvolvimento. Não use um redirect wildcard aberto.
4. Confirme `auth.users` e **não** desative a verificação de e-mail para facilitar convites públicos. Configure SMTP de produção se o limite de e-mails do ambiente de desenvolvimento não for suficiente.

Local: `npm ci && npm test && npm run build`. Para demonstração, `npm run dev`. `vite.config.ts` usa base relativa para Pages e HashRouter pequeno para navegação SPA.

## Provisão segura da conta de administrador

**Conta indicada pelo proprietário: `ademirvarjao@gmail.com`.** Ela ainda não constava em `auth.users` na consulta ao Supabase. Instalei a migração específica `20261118000300_eleao_owner_claim.sql`: depois de criar essa conta no app e confirmar o e-mail, o fluxo verifica o endereço confirmado no próprio Supabase Auth e promove apenas a própria identidade a administradora. É um RPC autenticado, de alvo único, sem trigger global e sem senha/chave privilegiada no navegador. Uma conta com outro e-mail não consegue usar esse caminho.

Fluxo para você: abra o app, escolha **Criar conta**, use `ademirvarjao@gmail.com`, crie a senha e confirme o link enviado pelo Supabase; depois volte ao app e entre. O perfil administrativo será provisionado automaticamente na sessão confirmada. **Nenhuma conta foi criada ou promovida durante a verificação**, pois o endereço ainda não aparecia no Auth e uma senha não foi fornecida. O SMTP atual não está personalizado; a entrega depende do serviço de e-mail habilitado no projeto.

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
