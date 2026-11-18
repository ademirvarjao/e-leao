# e-Leão

Workspace web responsivo em português para explorar cenários da Reforma Tributária, organizar rascunhos de NFS-e, consultar guias fiscais e, mediante configuração administrativa, conectar motores RTC independentes. **Projeto independente; não é produto, serviço, homologação nem endosso da Receita Federal.**

## Executar

```sh
npm ci
npm test
npm run dev
```

Configuração do browser em `.env.example`. `npm run build` verifica TypeScript e gera a aplicação estática em `dist/`.

## Funções

- Painel demonstrativo com indicadores, atividade e gráficos responsivos.
- Estimativa rápida de IBS, CBS e IS em decimal exato; alíquotas sempre informadas por quem opera; memória exportável e cenários guardados no histórico.
- Aba avançada para enviar contratos de operação RTC às APIs allow-listed e interpretar as respostas originais.
- Rascunhos de NFS-e independentes da autorização, com direcionamento ao emissor oficial. Geração auxiliar de DANFSe a partir de XML nacional autorizado; não emite nota.
- Cadastro, autenticação, confirmação de e-mail, redefinição de senha, perfis e dados próprios isolados por RLS no Supabase.
- Consulta de guias revisados com fontes; IA generativa opcional, explicável e sem treinamento automático com mensagens.
- Ferramentas gerenciais administrativas para contas, operações agregadas, notas de curadoria e feedback.
- Hash navigation, atalhos de teclado, modos de acessibilidade, exportação CSV com neutralização contra fórmulas e experiência mobile.

O modo de demonstração anônimo trabalha com cenários fictícios apenas no navegador. Não se tornam registos do utilizador e não usam percentuais para determinar tributos.

## Publicação, administração e limites

Consulte [`docs/IMPLANTACAO.md`](docs/IMPLANTACAO.md) para GitHub Pages, variáveis seguras, configuração Supabase, implantação Edge Function, configuração opcional de motores/IA e convite/admin. É necessário um endereço de e-mail controlado pelo proprietário para provisionar o admin; **nenhuma identidade foi presumida ou elevada**. A action requer ativação de Pages/Actions no GitHub. A integração oficial de emissão permanece desabilitada até que um provedor/credenciamento/CNSE e certificado seguros sejam implementados. Não substitui PGDAS-D, orientação contabilística/jurídica ou validadores de conformidade.

## Revisão dos upstreams

A análise detalhada dos três projetos, contratos, datas, diferenças operacionais e decisões de desenho está em [`docs/ANALISE-E-ESCOPO.md`](docs/ANALISE-E-ESCOPO.md). Versões examinadas: regime regular **1.6.1**; Simples Nacional **0.0.6**; renderer DANFSe **1.0.0**.

## Testes

`npm test` executa testes de decimal/estimativa, períodos, exportação CSV e fontes da FAQ, mais um teste PostgreSQL local de RLS contra a migração atual. Não acessa nem altera o Supabase de produção.
