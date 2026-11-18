# Configuração, contas e publicação

## O estado desta instalação

O e-Leão usa o projeto Supabase dedicado `zfmmcnuyegrjmeurbgbl` (região São Paulo), separado do Conversor. As migrações iniciais, as migrações de aprovação, de convites e de guias oficiais foram aplicadas; as Edge Functions `eleao-api` e `eleao-invite` foram implantadas. O código e o workflow usam por padrão esse projeto; substituições locais `VITE_SUPABASE_*` devem apontar para o mesmo projeto. Nenhuma operação ou feedback existia na instalação anterior no momento da conferência. Contas Auth não são migradas automaticamente entre projetos; a conta do proprietário já existe e está ativa no projeto dedicado.

Auth do projeto dedicado usa `https://ademirvarjao.github.io/e-leao/` e permite redirects para esse caminho, previews Arena e Vite local. O SMTP do Auth aponta para o Resend, mas seu domínio ainda não foi verificado; o cadastro direto está desativado. Pages e as integrações externas ainda precisam ser verificadas na publicação. O projeto anterior e seus dados não foram removidos; o projeto Conversor não foi alterado nesta migração.

## Publicação do frontend (GitHub Pages)

1. O workflow usa os valores públicos padrão do projeto dedicado em `src/lib/client.ts`, sem variáveis de Actions que possam apontar acidentalmente para outro projeto. Não inclua chaves secretas no frontend.
2. Ative Pages com source **GitHub Actions** e autorize `GITHUB_TOKEN` a publicar Pages. O workflow executa `npm ci`, os testes, build e fallback SPA.
3. Habilite confirmação de e-mail e configure URL de produção, URLs de preview e os redirecionamentos de recuperação em **Supabase Auth → URL Configuration**. No caso de Pages, inclua a URL do host `ademirvarjao.github.io` e o caminho `/e-leao/`; aceite também o host `*.e2b.app` enquanto estiver em desenvolvimento. Não use um redirect wildcard aberto.
4. Confirme `auth.users` e **não** desative a verificação de e-mail para facilitar convites públicos. Configure SMTP de produção se o limite de e-mails do ambiente de desenvolvimento não for suficiente.

Local: `npm ci && npm test && npm run build`. Para desenvolvimento, `npm run dev`; o painel não tem acesso anônimo. `vite.config.ts` usa base relativa para Pages e HashRouter pequeno para navegação SPA.

## Provisão segura da conta de administrador

**Proprietário: `ademirvarjao@gmail.com`.** O novo projeto tem Auth independente. A conta está confirmada e ativa; a migração `20261118000300_eleao_owner_claim.sql` permite que apenas a própria conta autenticada com esse endereço verificado reivindique o perfil de administrador. A conta antiga não é automaticamente transportada. Nenhuma senha foi lida ou solicitada. A confirmação depende do serviço de e-mail configurado no projeto.

O script administrativo `npm run admin:invite -- --email ...` continua disponível para provisionamento operacional pelo próprio proprietário em uma máquina confiável, com credencial secreta efêmera fora do browser/Git. A promoção de outros membros continua deliberadamente ausente do dashboard.

## Gateway Edge e integração RTC/DANFSe

Implante `supabase/functions/eleao-api/index.ts` no MESMO Supabase do frontend. Os valores padrão Supabase `SUPABASE_URL` e `SUPABASE_ANON_KEY` são fornecidos pelo runtime; exigir JWT e a Edge Function estão ligados apenas após deployment/configuração do gateway. Os clientes do browser não recebem `service_role`, certificados nem tokens upstream. Parâmetros de endpoint só são aceitos pelo servidor:

- `RTC_REGULAR_URL`: base HTTPS, upstream compatible com versão 1.6.1.
- `RTC_SIMPLE_URL`: base HTTPS, contrato SN versão 0.0.6.
- `RTC_BASE_URL`: base HTTPS, endpoint da base unificada da NFS-e.
- `RTC_DANFSE_URL`: **base HTTPS** do renderer Go; a função acrescenta `/api/danfse` e transmite `application/xml` com `stc` e `canhoto` em query, lendo a resposta PDF nativa.
- `RTC_API_TOKEN`, `DANFSE_API_TOKEN`: opcionais, segredo Bearer separado de cada motor apenas quando o host upstream exigir autenticação.

Configure somente via secretos de Edge (ex.: `supabase secrets set RTC_REGULAR_URL=… RTC_SIMPLE_URL=… RTC_BASE_URL=… RTC_DANFSE_URL=…`; a sintaxe para cadastrar segredos depende da CLI usada). **Não configure URL de serviço público sem controlo de rede**, aplique auth, TLS, limite de taxa/egress e uma revisão de segurança aos motores que hospedar. Os endereços são allowlist do servidor, nunca escolhidos pelo browser. O gateway aplica cota por utilizador/dia; não grava o corpo ou XML, mas o upstream recebe esses dados. Configure os segredos necessários antes de disponibilizar estas funções. O novo frontend não chama a ação `assistant`. Para descontinuar o endpoint pago de clientes antigos e expor o cabeçalho de simulação ao navegador, republique `eleao-api` a partir desta versão. A IA nova não depende dessa publicação nem de migração SQL.

**A emissão via API está bloqueada por desenho.** `action=emit` devolve HTTP 501. Para a ativar, é necessário construir e revisar integração SEFIN/ente autorizado, autenticação mútua, credenciamento, assinatura/verificação XMLDSig, certificado armazenado em cofre KMS/vault com consentimento e vínculo de titularidade, Idempotência, contingência/cancelamento/substituição, homologação e auditoria LGPD. Não troque o bloqueio pelo renderer DANFSe. Até essa integração certificada existir, acesse o emissor autorizado e importe o XML efetivamente autorizado para gerar a representação auxiliar.

## Assistente generativo local

No workspace autenticado, **Assistente fiscal → Ativar IA neste dispositivo** inicia o download sob consentimento. O motor [wllama](https://github.com/ngxson/wllama) executa llama.cpp em Web Worker na CPU, inclusive em Pages sem WebGPU ou isolamento entre origens. O JS e os WASMs (inclusive a versão de compatibilidade) vêm do próprio build. Os pesos não entram no Git nem no bundle: [Qwen3-0.6B, Q4_K_M, revisão fixa](https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/tree/50968a4468ef4233ed78cd7c3de230dd1d61a56b), modelo-base [Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B), licença Apache-2.0. São 396.705.472 bytes de pesos, além do runtime e da memória de inferência. Os avisos de licença do [wllama](../public/licenses/wllama-MIT.txt) e do [llama.cpp](../public/licenses/llama-cpp-MIT.txt) acompanham os arquivos estáticos. A inferência não usa cota do gateway, cartão nem conta de provedor de IA; há consumo local de dados, memória e CPU.

É necessário HTTPS (ou loopback de desenvolvimento), navegador recente com WebAssembly, Worker e armazenamento privado da origem. Na primeira ativação há acesso ao Hugging Face e ao seu CDN **apenas para os pesos/metadados**. O provedor do download pode ver o IP, não a pergunta ou os guias. Armazenamento limitado, janela privada, rede bloqueada e dispositivos com pouca memória podem impedir o carregamento. A consulta textual é identificada como tal e continua disponível. Desativar a IA ou sair da tela libera o motor; **Modelo e armazenamento → Apagar apenas o modelo em cache** remove os pesos sem limpar a conta. O navegador também pode descartar o cache.

O contexto usa os guias disponíveis à conta e a referência legal da calculadora. Se a pesquisa textual não basta, o modelo pode selecionar um guia de um catálogo limitado. Fontes exibidas vêm da aplicação, não de URLs geradas. A resposta é educativa, pode errar e não faz consultas legais em tempo real. Conversas não ficam no histórico; votar num guia do banco envia apenas a avaliação desse artigo. Em respostas com percentuais numéricos, a interface exige frases do texto revisado em vez de aceitar um número só porque ele também aparece no guia. Essa verificação não garante a correção de toda afirmação. Falhas, cancelamento ou texto que não passa pela validação não são rotulados como resposta de IA.

**Teste opcional com inferência real**, além da suíte rápida de UI: instale Chromium localmente, baixe o GGUF da revisão acima para fora do repositório e execute:

```sh
npm ci && npm run build
E_LEAO_GGUF=/caminho/Qwen3-0.6B-Q4_K_M.gguf CHROMIUM_PATH=/caminho/chromium npm run test:ia
```

O teste confere o SHA-256 `ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a`, serve os mesmos pesos por loopback (sem depender da rede do provedor), abre o build em um perfil temporário, entra com uma conta fictícia interceptada no teste e ativa a IA **na interface**. Verifica uma resposta gerada sobre DANFSe, a identificação como IA e o link do guia. Depois recarrega a página sem um segundo download dos pesos, aciona a remoção e verifica que o GGUF saiu do armazenamento. Não usa credenciais reais, não simula o modelo nem toca no banco. Esse teste não comprova conectividade de cada dispositivo com o CDN de produção.

## Referências da estimativa rápida

A fonte é a [LC 214/2025, texto consolidado](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214compilado.htm), revisão das referências em 18/11/2026. Na regra geral sem redução: em 2026, IBS estadual 0,1% (art. 343) e CBS 0,9% (art. 346), observados o art. 348, as reduções, exceções e condições de dispensa de recolhimento. Em 2027–28, IBS total de 0,1% (0,05% estadual + 0,05% municipal, art. 344). Não extrapolar esses números para outros tributos, anos ou enquadramentos. Não há sugestão numérica para IS, Simples Nacional, ou CBS após 2026. A aplicação da referência é explícita por campo e fica identificada na simulação salva; a legislação não é sincronizada automaticamente. Revise `src/lib/rateReferences.ts` e seus testes antes de mudar as vigências.

## Migrações e verificações

Migrações em `supabase/migrations/` são só de domínio `eleao_*`, requerem revisão antes de reaplicar num projeto; confirme `public.eleao_*`, políticas, guias publicados, grants e chaves antes de executar. Adapte primeiro o seed/editor se ele divergir dos guias já publicados. Não deixe clientes anon consultarem os artigos da base sem configurar política explícita. Execute `npm test`, `npm run build` e teste isolamento de uma segunda conta num ambiente de teste antes de promover dados reais.

As políticas da versão local estão cobertas por testes de integração PostgreSQL local (PGlite) na migração atual. Ainda devem ser validadas no projeto remoto com duas contas reais, sessão expirada, estado suspenso, convidado ainda não confirmado, recuperação e autorização de administrador. Edge Function, motores externos, renderização final DANFSe, SMTP, IA, cadastro e emissão oficial ainda não foram testados em produção.

## Privacidade e operação

O cliente envia tokens apenas ao Supabase/Edge Function, usa chave publicável e não insere certificados fiscais no histórico. As exportações são locais, o CSV neutraliza fórmulas, e comentários são privados/opt-in. Configure política de privacidade, encarregado/canal LGPD, retenção/descarte, backups, logs mínimos, alerta de abuso e política de incidentes antes de produção. Não rotule o painel gerencial como apuração contabilística do contribuinte. Atualize e teste cada versão upstream, catálogo, taxa e vigência antes de mudar qualquer taxonomia exibida.

## Aprovação de acessos

A migração `20261118000400_access_approval.sql` foi aplicada no projeto dedicado; a interface correspondente depende da publicação coordenada: a migração passa a registrar usuários confirmados como pendentes e somente o proprietário verificado pode aprová-los. Antes de publicar, valide aprovação, recusa, login e isolamento com contas reais de teste. Perfis existentes são preservados como aprovados; revise-os antes da migração. Sem a migração, ocultar a interface não protege o acesso pela API.

A configuração de SMTP do Supabase Auth aponta para Resend, mas o DNS não está verificado. O fluxo de convite é manual e não envia aviso por e-mail ao administrador. O painel recebe solicitações. Não coloque credenciais em código ou no navegador.

## Roteiro técnico e fontes

A migração `20261118000500_official_guides.sql` troca as fontes originais dos guias do GitHub por portais oficiais e acrescenta guias sobre RTC, NFS-e, ECD/ECF, normas do CFC e registro societário. Ela preserva campos já modificados por curadores e não substitui guias com IDs existentes. Os guias da aplicação autenticada vêm do banco: a migração precisa ser aplicada para refletir a atualização. Os textos e links foram conferidos em 18/11/2026; não há monitoramento ou atualização automática de legislação. Revise periodicamente vigência, alterações, exceções e fontes, especialmente antes de usar informações em contexto fiscal.

O roteiro de revisão é orientativo e não substitui apuração nem determina obrigações. Suas marcações ficam apenas no `sessionStorage` da aba, por usuário e competência: não são compartilhadas, persistentes entre dispositivos nem prova de cumprimento. Não inclua dados de clientes nele. Consultas e integrações fiscais externas continuam dependentes da configuração do gateway.

## Consulta diária de fontes oficiais

O workflow Pages inclui uma execução agendada diária às 09:17 UTC, além de push e acionamento manual. Depois do build, `scripts/official_updates.py` consulta dois feeds RSS da Receita Federal (notícias gerais e reforma tributária) e grava `dist/official-updates.json` para a seção de notícias. O conteúdo é limitado a títulos, datas e links HTTPS do domínio oficial permitido; não executa conteúdo remoto nem atualiza regras fiscais ou o banco automaticamente. A interface indica falhas por fonte e avisa quando a última tentativa tem mais de 48 horas. Se o workflow não rodar ou o deploy falhar, o site pode permanecer antigo; monitore a execução em Actions. Serviços externos podem alterar feeds, formatos ou URLs. O agendamento do GitHub não garante horário exato e pode ser desativado em repositórios inativos; verifique também o status do Pages e de Actions.

A consulta a dois feeds **não cobre todas as leis, todos os órgãos, as jurisdições locais, todas as ferramentas nem todos os conteúdos existentes**. O FAQ e as regras de cálculo precisam de revisão técnica humana, comparação com fontes, testes e publicação; a calculadora externa apontada pelo gateway também requer manutenção independente. Uma notícia não equivale a texto legal consolidado. Confira sempre normas, vigência e exceções diretamente. `python3 -m unittest discover -s tests -p 'test_*.py'` testa a extração e falhas sem rede.

## Convites manuais sem domínio de e-mail

O fluxo novo não usa e-mail para criar conta: visitantes enviam nome e e-mail declarado, o proprietário confere a identidade fora do sistema e gera no painel um link secreto de uso único com validade de 48 horas. Um novo link invalida o anterior. A pessoa define a própria senha no link. A validação é de posse do link, **não comprova a propriedade do e-mail**; o proprietário deve confirmar a identidade por um canal confiável antes de emitir. O link deve ser tratado como senha e não pode ser publicado ou enviado a terceiros.

No projeto dedicado foram instaladas as migrações 004 a 006 e a função `eleao-invite` com `verify_jwt=false`, e o cadastro público direto no Supabase Auth foi desabilitado. O frontend ainda deve ser publicado de forma coordenada. A função usa `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor; não colocá-la no frontend. Seu RPC reserva o convite de forma atômica e só ativa a conta após criação bem-sucedida. Se uma falha ocorrer após a reserva, ela fica `processing` para análise administrativa, em vez de reutilização insegura. Antes de lançar, teste geração, cancelamento, reemissão, expiração, consumo concorrente e falhas com duas contas reais em ambiente de teste. A conta existente do proprietário deve ser validada antes de desabilitar o cadastro. O endpoint de solicitação tem um limite global simples, mas precisa de proteção adicional antiabuso (CAPTCHA/WAF e limites por IP) antes de uso público; privacidade e retenção dos pedidos também precisam de política. A recuperação automática de senha ainda depende de SMTP funcional e verificação de domínio; até lá é necessária operação manual segura. Não confundir aprovação manual com verificação de caixa postal.

A verificação remota criou uma conta temporária por convite, confirmou autenticação e rejeição do reuso; a conta e a solicitação de teste foram apagadas. Foram confirmados RLS e grants restritos do fluxo. O teste não confirma login da conta pessoal do proprietário. A mudança 007 adiciona bloqueio transacional ao limite global; ela não substitui limitação por IP nem CAPTCHA.

Para os testes remotos foi habilitada a extensão `pg_net`, sem agendamentos automáticos; os testes usaram dados temporários e foram limpos. As migrações executadas pelo conector receberam versões registradas pelo Supabase diferentes dos prefixos locais; reconcilie o histórico antes de usar `supabase db push` para evitar reaplicação.

## Recuperação manual e mitigação de abuso (implantação coordenada)

As migrações 009 e 010, a função `eleao-recovery` e a interface correspondente foram publicadas no projeto dedicado. Para membros ativos, o proprietário pode emitir um link secreto de uso único, válido por uma hora, e entregá-lo após verificar a identidade por outro canal. Um novo link invalida links anteriores ainda não usados. O proprietário não vê a senha. Esta recuperação **não atende a conta do proprietário**: mantenha um procedimento independente e seguro de recuperação do acesso ao Supabase/conta administrativa. Uma falha após reserva exige análise e novo link. Se a alteração da senha ocorrer mas a finalização falhar, sessões antigas podem continuar ativas; trate como incidente. Mesmo com a finalização bem-sucedida, tokens de acesso já emitidos podem continuar válidos até expirarem. Em teste remoto temporário, recuperação e login com a nova senha retornaram 200, reuso retornou 400 e as sessões anteriores foram excluídas; a conta e dados do teste foram removidos.

A prova de trabalho SHA-256 vincula nome, e-mail e horário e aumenta o custo de solicitações automatizadas. A migração 011 foi aplicada após a publicação e revogou o acesso público ao RPC legado `eleao_request_access`. Mais tarde, a migração 013 também revogou o acesso público direto ao RPC de prova de trabalho, exigindo a verificação Turnstile pelo servidor. O limite global continua sujeito a esgotamento e essas medidas não substituem WAF, limite por IP, monitoramento ou política de retenção.

## Turnstile gratuito para solicitações (ativo)

A integração usa Cloudflare Turnstile no formulário de solicitação e valida o token **no servidor** com Siteverify, conferindo sucesso, hostname `ademirvarjao.github.io` e ação `solicitar_acesso`. Mantém também a prova de trabalho. Não usar as chaves públicas de teste em produção: as chaves secretas de teste são recusadas pela função. Veja [plano gratuito](https://developers.cloudflare.com/turnstile/plans/) e [validação no servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). É possível cadastrar o hostname do GitHub Pages sem comprar um domínio; não é necessário alterar o DNS. O Turnstile não substitui WAF ou limites por IP, nem garante que todo pedido é legítimo; a aprovação permanece exclusiva do proprietário.

### Configuração de produção (pelo responsável pelas contas)

1. Criar conta gratuita na Cloudflare, abrir **Turnstile** e criar um widget **Managed** para o hostname `ademirvarjao.github.io` (sem `https://` e sem caminho). Não usar chaves de teste. Confirmar no painel se esse hostname é aceito.
2. No repositório GitHub, em **Settings → Secrets and variables → Actions → Variables**, criar a variável `VITE_TURNSTILE_SITE_KEY` com a *site key*, que é pública. O workflow a incorpora no build. Não colocar a chave secreta em `VITE_*`, no repositório ou em mensagens.
3. No painel do projeto Supabase dedicado, em **Edge Functions → Secrets**, adicionar `TURNSTILE_SECRET_KEY` com a chave secreta real do widget. O valor não deve ser compartilhado no chat. O projeto Conversor não deve ser alterado.
4. A migração equivalente a `20261118001200_turnstile_verified.sql` e a função `eleao-request` com `verify_jwt=false` já foram instaladas no projeto dedicado pelo conector, com versão remota diferente do prefixo local. A função depende de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do ambiente de Edge Functions. O Siteverify rejeitou um token inválido, e um teste real do proprietário produziu uma solicitação pendente e um token consumido no mesmo instante antes da ativação. Conferir erros sem registrar senhas, tokens ou segredos. Não executar `supabase db push` sem reconciliar as versões remotas.
5. A interface foi publicada com a variável de build configurada. O proprietário enviou um pedido de teste usando o widget real, e o pedido foi encontrado no banco com registro de consumo de CAPTCHA no mesmo instante; o pedido de teste foi removido. As falhas, ação e hostname incorretos e reuso também são cobertos por testes locais; nem todos os cenários foram reproduzidos com tokens reais em produção.
6. A migração equivalente a `20261118001300_turnstile_enforcement.sql` foi aplicada no projeto dedicado. Foi confirmado que `anon` e `authenticated` não podem executar diretamente `eleao_request_access_pow` nem `eleao_request_access_verified`; somente `service_role` pode executar a segunda. Após a virada, um teste interno confirmou que essa função ainda consegue registrar uma solicitação com prova válida, e uma tentativa anônima direta foi rejeitada. O pedido e os dados internos do teste foram removidos. Um novo desafio real após a virada não foi exercitado. Clientes antigos em cache precisam recarregar a página.

Se a chave estiver ausente, o serviço da Cloudflare falhar ou o widget não carregar depois da virada, a solicitação é bloqueada, sem fallback inseguro. Planejar reversão com cautela: restaurar a permissão pública de `eleao_request_access_pow` remove a obrigatoriedade do CAPTCHA para todos até nova ativação. Os tokens validados são armazenados apenas como hash por ao menos 15 minutos e limpos quando há novas solicitações; o limite global pode ser esgotado por tráfego malicioso, e redes ou navegadores que bloqueiem scripts externos podem não conseguir enviar o formulário.
