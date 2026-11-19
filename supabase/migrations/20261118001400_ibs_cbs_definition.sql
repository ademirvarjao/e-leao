-- Align the original comparison FAQ with the statutory glossary. Do not
-- rewrite a curator's question, answer, attribution or keywords, or recreate a deleted row.
update public.eleao_articles
set answer = 'IBS significa Imposto sobre Bens e Serviços, de competência compartilhada entre os estados, o Distrito Federal e os municípios. CBS significa Contribuição Social sobre Bens e Serviços, de competência da União. Ambos são tributos sobre o consumo, instituídos pelo art. 1º da LC 214/2025.',
    source = 'https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-214-16-janeiro-2025-796905-normaatualizada-pl.html'
where id = 'guia-1'
  and question = 'Qual é a diferença entre IBS e CBS?'
  and category = 'Reforma tributária'
  and answer = 'A CBS é a contribuição federal sobre bens e serviços. O IBS é o imposto de competência compartilhada entre estados, municípios e Distrito Federal. No e-Leão, os dois valores aparecem separados: uma simulação não representa, por si só, um saldo a recolher.'
  and source = 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/dezembro/comunicado-conjunto'
  and keywords = 'diferença tributos reforma significado cbs ibs imposto consumo';
