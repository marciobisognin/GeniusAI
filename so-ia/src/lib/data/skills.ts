export const skillDescriptions: Record<string, string> = {
  // Empresa
  "enriquecer-lead": "Enriquece dados do lead a partir de fontes públicas e do CRM.",
  "pontuar-fit": "Calcula um score de fit com o ICP da empresa.",
  "sugerir-proxima-acao": "Recomenda a próxima ação comercial mais eficaz.",
  "montar-proposta": "Monta a minuta de proposta a partir do briefing e histórico.",
  "calcular-precificacao": "Aplica a tabela de preços vigente e alçadas de desconto.",
  "revisar-clausulas": "Revisa cláusulas contratuais padrão da proposta.",
  "gerar-conteudo": "Gera rascunho de conteúdo ancorado no guia de marca.",
  "checar-tom-de-voz": "Confere aderência do texto ao tom de voz da marca.",
  "citar-fonte-marca": "Inclui citação da fonte do guia de marca usada.",
  "classificar-ticket": "Classifica a categoria e urgência do ticket recebido.",
  "responder-com-citacao": "Responde citando a base de conhecimento relevante.",
  "escalar-humano": "Escala o ticket para um atendente humano quando necessário.",
  "conciliar-lancamentos": "Concilia lançamentos financeiros entre sistemas.",
  "gerar-resumo-financeiro": "Gera resumo executivo da posição financeira.",
  "sinalizar-divergencia": "Sinaliza divergências para revisão humana.",
  "monitorar-concorrencia": "Monitora movimentos públicos de concorrentes.",
  "resumir-tendencias": "Resume tendências de mercado relevantes.",
  "recomendar-acao": "Recomenda uma ação sem executá-la diretamente.",

  // Governo
  "montar-etp": "Monta o Estudo Técnico Preliminar a partir dos dados do processo.",
  "montar-tr": "Monta o Termo de Referência com base no ETP e no objeto da contratação.",
  "checklist-14133": "Verifica a instrução contra o checklist da Lei 14.133/2021.",
  "verificar-segregacao-funcoes": "Confere se aprovador e autor do ato são pessoas distintas (Acórdão TCU 1668/2021).",
  "consultar-pncp-precos": "Consulta contratos e atas de registro de preços no PNCP.",
  "consultar-painel-precos": "Consulta o Painel de Preços do Compras.gov.br.",
  "cotar-fornecedores": "Cota no mínimo 3 fornecedores com justificativa de escolha.",
  "calcular-preco-estimado": "Calcula média/mediana e gera memória de cálculo, descartando outliers.",
  "ler-nota-fiscal": "Extrai CNPJ, itens, valores e chave de acesso da NF-e via IDP.",
  "conferir-nf-contra-empenho": "Compara itens/quantidades/valores da NF com o empenho no SIPAC.",
  "checar-regularidade-fiscal": "Consulta a regularidade fiscal do fornecedor no SICAF.",
  "preparar-atesto": "Gera a minuta de atesto e o relatório de conferência com citações.",
  "monitorar-vigencias": "Monitora vigências contratuais no SIPAC/Comprasnet Contratos.",
  "alertar-prazos": "Emite alertas D-180/D-90/D-30 antes do fim da vigência.",
  "preparar-aditivo": "Prepara minuta de termo aditivo quando cabível.",
  "checar-saldo-empenho": "Verifica o saldo de empenho disponível para o contrato.",
  "verificar-instrucao-processual": "Verifica se o processo está corretamente instruído.",
  "mapear-pendencias": "Mapeia pendências documentais no processo.",
  "citar-acordao-tcu": "Cita acórdãos do TCU relevantes ao caso analisado.",
  "triar-pedido-lai": "Triagem inicial do pedido de acesso à informação (LAI).",
  "redigir-resposta": "Redige a resposta ao cidadão com base em dados públicos.",
  "checar-sigilo-lgpd": "Verifica se a resposta expõe dado pessoal ou sigiloso (LGPD).",
};

export const skillMdExample = `---
name: consultar-pncp-precos
description: Consulta preços de contratos e atas no PNCP para subsidiar pesquisa de preços (Lei 14.133, art. 23). Use quando o usuário precisar de preços de referência do setor público.
allowed-tools: Read, Fetch
compatibility: ">=so-ia-1.0"
---
## Objetivo
Obter preços de referência priorizando fontes do setor público (art. 23, §1º; IN SEGES/ME 65/2021).

## Passos
1. Buscar contratações similares por CATMAT/CATSER no PNCP.
2. Filtrar por período (≤12 meses) e aplicar índice de atualização.
3. Descartar outliers (Súmulas TCU 177/247 — checar) e registrar memória de cálculo.
4. Retornar tabela com fonte, data/hora de acesso e link do documento.`;
