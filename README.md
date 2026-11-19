# e-Leão

Workspace web responsivo em português para explorar cenários da Reforma Tributária, organizar rascunhos de NFS-e, consultar guias fiscais e, mediante configuração administrativa, conectar motores RTC independentes. **Projeto independente; não é produto, serviço, homologação nem endosso da Receita Federal.**

## Executar

```sh
npm ci
npm test
npm run dev
```

Configuração do browser em `.env.example`. `npm run dev` e `npm run build` usam Python 3 com SQLite para preparar as referências públicas de NCM e NBS. Na primeira execução é necessário acesso ao GitHub da Receita, ou uma cópia da revisão fixada (ver [reprodução offline](docs/CENARIOS.md#reproduzir-os-metadados)). `npm run build` verifica TypeScript e gera a aplicação estática em `dist/`.

## Funções

- Painel do espaço privado com indicadores, atividade e gráficos responsivos.
- Catálogo de cenários visível, pesquisável por operação, CST/cClassTrib ou atividade do Simples. Opções, vigências e vínculos de documento do catálogo RTC da Receita; cenários usuais e título manual. [Cobertura, fontes, limites e reprodução do catálogo](docs/CENARIOS.md).
- Estimativa rápida de IBS, CBS e IS em decimal exato. Quando a hipótese cabe no cálculo local, há sugestões opt-in por classificação, regime e data. A memória por tributo com as premissas, alíquotas manuais ou referências e dispositivos legais pode ser salva e exportada em PDF ou Excel (.xlsx); hipóteses complexas abrem o formulário da consulta RTC.
- Consulta de NCM/NBS, hierarquia e vigência na base pública distribuída com o RTC, sem transmitir o código ou os dados da operação. A comparação opcional de versão com o piloto da Receita é separada do cálculo.
- Formulários para regime regular, Simples e base da NFS-e, sem edição de JSON. **Verificar conexão do serviço** consulta a versão/prontidão da instância configurada, sem calcular ou enviar XML. Os relatórios exportáveis preservam os valores e os avisos do motor.
- Rascunhos de NFS-e independentes da autorização, com direcionamento ao emissor oficial. Geração auxiliar de DANFSe a partir de XML nacional autorizado; não emite nota.
- Solicitação de acesso, aprovação e convite manual; autenticação, recuperação de senha e dados próprios isolados por RLS no Supabase.
- Consulta imediata de guias com fontes e IA generativa no dispositivo. **Ao abrir o Assistente fiscal**, o navegador prepara o Qwen3-0.6B automaticamente (~397 MB na primeira vez, com reuso do cache). Perguntas dos guias têm resposta direta; para perguntas livres, a fonte encontrada já aparece enquanto a IA prepara uma explicação. O painel de carregamento mostra apenas o progresso e a porcentagem. Em **Opções da conversa**, é possível escolher **Usar só os guias**. Não exige chave de IA nem envia perguntas a uma API externa.
- Ferramentas gerenciais administrativas para contas, operações agregadas, notas de curadoria e feedback.
- Hash navigation, atalhos de teclado, modos de acessibilidade, exportação CSV com neutralização contra fórmulas e experiência mobile.

O workspace exige conta autorizada. Dados e guias de exemplo no código servem a testes e não são apurações fiscais.

## Publicação, administração e limites

Consulte [`docs/IMPLANTACAO.md`](docs/IMPLANTACAO.md) para GitHub Pages, variáveis seguras, configuração Supabase, publicação da Edge Function, configuração opcional de motores fiscais, requisitos da IA local e administração de convites. É necessário um endereço de e-mail controlado pelo proprietário para provisionar o admin; **nenhuma identidade foi presumida ou elevada**. A action requer ativação de Pages/Actions no GitHub. A integração oficial de emissão permanece desabilitada até que um integração SEFIN, credenciamento e gestão segura de certificados sejam implementados. Não substitui PGDAS-D, orientação contabilística/jurídica ou validadores de conformidade.

## Revisão dos upstreams

A análise detalhada dos três projetos, contratos, datas, diferenças operacionais e decisões de desenho está em [`docs/ANALISE-E-ESCOPO.md`](docs/ANALISE-E-ESCOPO.md). Versões examinadas: regime regular **1.6.1**; Simples Nacional **0.0.6**; renderer DANFSe **1.0.0**.

## Testes

`npm test` cobre os formulários, o cálculo, vigências e referências, o contrato do gateway, o ciclo de vida do assistente e as políticas PostgreSQL locais (PGlite). Não usa pesos de IA nem altera produção. O teste opcional `npm run test:ia` faz inferência real e verifica o cache em Chromium; veja [requisitos e execução](docs/IMPLANTACAO.md#assistente-generativo-local).
