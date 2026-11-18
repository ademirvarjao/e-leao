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

- Painel do espaço privado com indicadores, atividade e gráficos responsivos.
- Estimativa rápida de IBS, CBS e IS em decimal exato; alíquotas manuais ou referências legais aplicadas explicitamente por data e regime; memória exportável e cenários guardados no histórico.
- Aba avançada para enviar contratos de operação RTC às APIs allow-listed e interpretar as respostas originais.
- Rascunhos de NFS-e independentes da autorização, com direcionamento ao emissor oficial. Geração auxiliar de DANFSe a partir de XML nacional autorizado; não emite nota.
- Solicitação de acesso, aprovação e convite manual; autenticação, recuperação de senha e dados próprios isolados por RLS no Supabase.
- Consulta imediata de guias com fontes e IA generativa gratuita no dispositivo. Em **Assistente fiscal → Ativar IA neste dispositivo**, o navegador baixa o Qwen3-0.6B (~397 MB, uma vez se o cache for mantido). Não exige chave de IA nem envia perguntas a uma API externa.
- Ferramentas gerenciais administrativas para contas, operações agregadas, notas de curadoria e feedback.
- Hash navigation, atalhos de teclado, modos de acessibilidade, exportação CSV com neutralização contra fórmulas e experiência mobile.

O workspace exige conta autorizada. Dados e guias de exemplo no código servem a testes e não são apurações fiscais.

## Publicação, administração e limites

Consulte [`docs/IMPLANTACAO.md`](docs/IMPLANTACAO.md) para GitHub Pages, variáveis seguras, configuração Supabase, publicação da Edge Function, configuração opcional de motores fiscais, requisitos da IA local e administração de convites. É necessário um endereço de e-mail controlado pelo proprietário para provisionar o admin; **nenhuma identidade foi presumida ou elevada**. A action requer ativação de Pages/Actions no GitHub. A integração oficial de emissão permanece desabilitada até que um integração SEFIN, credenciamento e gestão segura de certificados sejam implementados. Não substitui PGDAS-D, orientação contabilística/jurídica ou validadores de conformidade.

## Revisão dos upstreams

A análise detalhada dos três projetos, contratos, datas, diferenças operacionais e decisões de desenho está em [`docs/ANALISE-E-ESCOPO.md`](docs/ANALISE-E-ESCOPO.md). Versões examinadas: regime regular **1.6.1**; Simples Nacional **0.0.6**; renderer DANFSe **1.0.0**.

## Testes

`npm test` cobre os formulários, o cálculo, vigências e referências, o contrato do gateway, o ciclo de vida do assistente e as políticas PostgreSQL locais (PGlite). Não usa pesos de IA nem altera produção. O teste opcional `npm run test:ia` faz inferência real e verifica o cache em Chromium; veja [requisitos e execução](docs/IMPLANTACAO.md#assistente-generativo-local).
