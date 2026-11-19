# Cenários da calculadora

Em **Calculadora RTC → Nome do cenário**, filtre por descrição, situação ou código. A escolha identifica uma hipótese, **não classifica o contribuinte**. Para comparar hipóteses, a base digitada é mantida; alíquotas, IS e confirmação do cenário anterior são limpos. O modo **Cenário personalizado** continua disponível para dar um título livre e informar os próprios percentuais.

## Cobertura e fonte

Em 18/11/2026, o recorte conferido é o catálogo do [RTC regular 1.6.1 da Receita Federal](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular/tree/150cccbe414d4a5edea703e4f7a424af5aa222c7/flyway/sql), base V0059. Inclui **164 classificações de IBS/CBS**, **29 de IS** e **15 atividades do Simples** usadas pelo [contrato SN 0.0.6](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional/tree/c5b0f01c8351c3f0d0795cc617b29d233e9f98df). Os códigos são texto com zeros à esquerda. Um mesmo código numérico pode identificar situações inteiramente diferentes em IBS/CBS e IS. As atividades SN usam `cAtivSN`, **não** uma cClassTrib inferida da atividade.

Há ainda cinco nomes usuais de operações onerosas (venda, serviço, locação de bem móvel, licenciamento/cessão e permuta), todos explicitamente sob a hipótese de tributação integral `000001`. São atalhos editoriais, não códigos adicionais. O catálogo inclui registros históricos e de vigência futura: a janela exibida é **do registro na versão**, não uma garantia de vigência legal, de implementação no motor contratado ou de que o documento pode ser emitido. Confira a [tabela vigente da SVRS](https://dfe-portal.svrs.rs.gov.br/Cff/ClassificacaoTributaria) e a legislação na data do fato gerador.

### Reproduzir os metadados

Com Python 3 e SQLite, numa cópia separada das fontes da revisão acima:

```sh
python3 scripts/import-rtc-catalog.py /caminho/para/calculadora-rtc-regime-regular/flyway/sql --check
```

Sem `--check`, o comando regenera `src/data/rtc-catalog.json`. O importador verifica o SHA-256 do conjunto ordenado de migrações antes de executá-las num SQLite em memória, verifica as chaves estrangeiras e exporta apenas metadados (classificação/atividade, situação, dispositivo, tratamento ou anexo, nomenclatura, vínculos de documento e datas). Não importa alíquotas nominais, NCM/NBS de terceiros ou valores de exemplos para preencher a tela. O frontend não baixa um banco, nem executa as migrações em produção. [Licença MIT do upstream](../public/licenses/receita-rtc-MIT.txt). Ao atualizar a versão, é necessária nova revisão dos vínculos, datas, regras locais e expectativas dos testes.

## Quando há uma sugestão numérica?

- No **regime regular**, a base deve estar ajustada (art. 12). Na regra geral sem redução, em 2026 há referências nominais de 0,9% de CBS e 0,1% de IBS estadual (arts. 346 e 343); de 2027 a 2028, 0,05% de IBS estadual + 0,05% municipal (art. 344). Não se projeta uma alíquota geral de CBS após 2026. Compensação e dispensa de recolhimento condicionada em 2026 não são calculadas (art. 348).
- Uma **lista positiva**, revisada em `src/lib/scenarios.ts`, admite alíquota zero, redução de 30% ou de 60% em casos específicos. O usuário confere item, NCM/NBS, anexos, requisitos, data e base antes de liberar as referências. Pode aplicar as sugestões juntas ou por campo, ou informar percentuais manualmente. Redução incide na **alíquota**, não na base. Art. 348, III, a (2026) e art. 344, parágrafo único, I (IBS de 2027–28). A sugestão de **zero**, quando a lei reduz expressamente ambas as alíquotas a zero, não depende de conhecer a nominal de CBS. A janela de sugestão local termina em 2028: não é uma cláusula de expiração do benefício.
- Exemplo: para R$ 1.000,00 de serviço efetivamente enquadrado no **Anexo II** (educação, art. 129) em 2026, as sugestões são CBS `0,9% × (1 − 60%) = 0,36%` e IBS `0,1% × (1 − 60%) = 0,04%`. A memória registra **R$ 3,60 + R$ 0,40 = R$ 4,00**, antes de qualquer apuração. Nem toda receita de uma instituição de ensino está incluída.
- **Demais casos:** o motor recebe um modelo a completar, não uma alíquota genérica. Ex.: monofasia exige dados do combustível e da etapa; suspensão não é alíquota zero; regimes específicos podem usar outra base. A atividade do Simples orienta o modelo, não calcula o DAS nem resolve sozinha anexo, fator R ou alíquota efetiva (LC 123/2006, art. 18). IS tem classificações, bases, eventual parcela por unidade e vigência próprias. O modo manual permite testar apenas IS ad valorem, sem atestar incidência.

## Consulta por item e histórico

A escolha nunca envia uma consulta. Ao preparar o modelo, apenas os dados conhecidos são propostos, incluindo data, família/códigos e, se houver um único vínculo, modelo de documento. O usuário completa ou remove os marcadores `<informar …>` conforme o contrato e confirma o envio. Para IS, a cClassTrib de IBS/CBS **não** é copiada da classificação de IS. Para o Simples, os decimais do contrato são texto. Em ambos, são necessários a conta e o serviço configurado pelo administrador. HTTP 200 pode conter itens não calculados; os estados por item, avisos e JSON original são preservados, sem gerar um total local de uma resposta parcial.

Na estimativa rápida, a memória discrimina base × percentual e valor em reais de cada tributo, a origem da alíquota e a base própria do IS (ou o fato de não ter sido incluído). O arredondamento é meio par por tributo; IBS usa o percentual total, sem arredondamento separado por ente. Total de tributos estimados não é preço final nem saldo a recolher. O histórico e o download JSON conservam os centavos e as premissas usadas, sem recalcular com um catálogo posterior. Registros antigos e rascunhos não recebem enquadramento retroativo. Não há nova migração do banco do e-Leão.

Textos legais: [LC 214/2025 atualizada](https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-214-16-janeiro-2025-796905-normaatualizada-pl.html) e [LC 123/2006 atualizada](https://www2.camara.leg.br/legin/fed/leicom/2006/leicomplementar-123-14-dezembro-2006-548099-normaatualizada-pl.html). Para emissão de documento fiscal eletrônico e padrão da NFS-e, consulte também os arts. 60 e 62 da LC 214; nem o rascunho, nem o DANFSe autorizam uma nota.
