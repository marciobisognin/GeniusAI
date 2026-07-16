# PRD — Sistema Operacional de IA Empresarial e Governamental (SO-IA)
**Versão 2.0 — Expansão dual (Setor Público brasileiro + Empresas Privadas)**
**Data:** 16 de julho de 2026 · **Status:** Proposta para aprovação · **Idioma:** Português (Brasil)

---

## Como ler este documento (Escala de Confiança)
Cada afirmação relevante é marcada para separar **fato** de **proposta** de **hipótese** — mantendo o espírito do PRD original.

- ✅ **Evidência verificada** — apoiada em fonte primária/citável identificada no texto.
- 🟡 **Proposta / decisão de produto** — recomendação deste PRD, não um fato externo.
- 🔵 **Hipótese** — a validar com pesquisa de mercado, entrevista ou piloto.
- ⚠️ **Projeção / previsão de terceiros** — número prospectivo (verbos "poderá", "deve", forecast) que **não** deve ser lido como fato consumado.

---

# SUMÁRIO
1. Resumo Executivo
2. Problema e Contexto (privado + público)
3. Visão, Objetivos e Não-Objetivos
4. Personas e Jobs To Be Done
5. Modelo Conceitual e Grafo Radial
6. Áreas de Negócio e o "Modo Governo"
7. Catálogo de Agentes e Skills (por área)
8. Níveis de Autonomia A0–A5
9. Fluxos e Casos de Uso Demonstradores (3+ do setor público)
10. Requisitos Funcionais e Não-Funcionais
11. Arquitetura de Referência (diagramas)
12. Modelo de Dados
13. Contratos de API e Exemplos JSON (Agent/Skill/Workflow)
14. Padrões e Protocolos de Agentes (MCP, A2A, Skills)
15. Segurança de Agentes e Governança de IA
16. Requisitos Legais e Normativos do Setor Público
17. Integrações Governamentais (SIPAC, PNCP, Compras.gov.br, SEI…)
18. Benchmarks de IA no Setor Público Brasileiro
19. Análise Competitiva de Mercado (2025–2026)
20. Tamanho de Mercado e Tendências
21. Estratégia Go-to-Market Dual
22. Monetização (privado e público)
23. Riscos (incluindo riscos específicos do setor público)
24. Métricas e KPIs
25. Roadmap em 5 Fases e Gates Go/No-Go
26. Definition of Done e Gates de Aceitação
27. Questões Abertas
28. Análise Crítica do PRD Original (mantido / corrigido / adicionado)

---

# 1. Resumo Executivo

O **SO-IA** é uma **plataforma multi-tenant** que reúne: (a) **agentes de IA governados**, (b) **skills reutilizáveis** no padrão aberto SKILL.md, (c) um **núcleo de conhecimento central** com RAG e citações verificáveis, (d) **workflows visuais governados**, (e) **Centros de Comando** (dashboards) por área, e (f) **níveis de autonomia A0–A5** com trilha de auditoria *append-only*. A versão 2.0 amplia o PRD original para atender **dois segmentos simultaneamente**:

1. **Setor público brasileiro**, com âncora nos **Institutos Federais de Educação** — exemplo-âncora: **Instituto Federal Farroupilha (IFFar)**, autarquia federal vinculada ao MEC criada pela **Lei nº 11.892/2008** ✅, campus **Frederico Westphalen (RS)**, especialmente a **Coordenação de Licitação e Contratos (CLC)**, subordinada à Diretoria de Administração (DAD) do campus ✅.
2. **Empresas privadas brasileiras de 20 a 500 colaboradores**.

**Por que agora (evidência de mercado):**
- O mercado de *agentic AI* teve estimativas de piso de **US$ 7,29 bilhões pela Fortune Business Insights (2025)** e **US$ 7,6 bilhões pela Grand View Research (2025)**, que projeta **US$ 10,9 bilhões para 2026** a um CAGR de 49,6% até 2033; [Grand View Research](https://www.grandviewresearch.com/industry-analysis/ai-agents-market-report) a Precedence/Straits e a Mordor Intelligence apontam faixas próximas (US$ 6,96–7,55 bi em 2025 → ~US$ 9,9–10,86 bi em 2026) ✅⚠️ *(projeções de longo prazo são de terceiros)*.
- **Gartner (press release de 26/08/2025):** *"Forty percent of enterprise applications will be integrated with task-specific AI agents by the end of 2026, up from less than 5% today"*, e projeta que a *agentic AI* poderá gerar ~30% da receita de software empresarial até 2035, superando US$ 450 bi (declaração de Anushree Verma, Sr Director Analyst) ✅⚠️.
- **O "gap de escala":** apenas **11%** das organizações chegaram a implantar e escalar agentes com resultados de negócio em toda a empresa, segundo a **KPMG Global AI Pulse survey** (divulgada em 31/03/2026, 2.110 líderes C-suite em 20 países) [Enterprise DNA](https://enterprisedna.co/resources/news/kpmg-global-ai-pulse-q1-2026/) — número corroborado por McKinsey (State of AI 2025) e Deloitte (2025 Emerging Technology Trends) ✅. **O Gartner alerta ainda que mais de 40% dos projetos de agentic AI correm risco de cancelamento até 2027** por custos, valor incerto e governança inadequada ✅⚠️.

**Tese do produto (🟡):** o SO-IA vence pelo que a maioria dos players não entrega de forma integrada ao contexto brasileiro — **governança auditável + conhecimento citável + conformidade LGPD/Lei 14.133 + residência de dados on-premise**. Para o setor público, é a diferença entre um chatbot e uma ferramenta que **instrui processos administrativos** com rastreabilidade suficiente para o TCU/CGU.

---

# 2. Problema e Contexto

## 2.1 Dores comuns aos dois segmentos
- Conhecimento fragmentado (drives, e-mails, sistemas legados) sem fonte única citável.
- Trabalho repetitivo intensivo em texto (redigir, conferir, cotar, resumir, atestar).
- Adoção de IA "sombra" (uso de ChatGPT pessoal) **sem governança, sem auditoria e com risco de vazamento de dados**.

## 2.2 Dores específicas do setor privado (20–500 colaboradores)
- Times enxutos sem capacidade de operar frota de agentes; TCO imprevisível de plataformas globais.
- Necessidade de integrar CRM, marketing, e-mail e mensageria com pouca engenharia.

## 2.3 Dores específicas dos Institutos Federais (contexto IFFar/CLC)
- **Processos manuais no SIPAC/SIG:** o IFFar usa o **Sistema Integrado de Gestão (SIG/SIPAC) da UFRN**, e **desde dezembro de 2019 todos os processos tramitam eletronicamente** por ele; em 2026 alcançou **interoperabilidade com o Tramita GOV.BR** ✅. Importante: **o IFFar NÃO usa SEI** (diferentemente de IFRO, IFPE e da Prefeitura de Farroupilha) ✅ — correção factual relevante para integração.
- **Tarefas intensivas na CLC-FW:** instrução de processos de licitação/dispensa/inexigibilidade sob a **Lei 14.133/2021**, elaboração de ETP/TR, **pesquisa de preços**, **atesto de notas fiscais**, **fiscalização e controle de vigência** de contratos administrativos, conformidade documental.
- **Restrição de recursos:** para 2025, o IFFar teve orçamento de custeio + assistência estudantil de ~R$ 52–55 milhões (excluindo folha de pessoal, paga centralizadamente) ✅ — o que torna **ganho de produtividade sem novos servidores** um driver central.
- **Lacuna/oportunidade:** não foi identificada iniciativa de IA já operacional em contratos/licitações no próprio IFFar ✅ (apenas modernização recente de interoperabilidade e Plano de Dados Abertos), enquanto TCU, governo federal e alguns estados já avançaram.

---

# 3. Visão, Objetivos e Não-Objetivos

**Visão (🟡):** um "sistema operacional" organizacional em que **agentes governados executam trabalho real**, ancorados em conhecimento citável, sob níveis de autonomia auditáveis, servindo empresas e órgãos públicos com o **mesmo núcleo** e **perfis (modos) distintos**.

### Objetivos (🟡)
1. Reduzir o tempo de tarefas administrativas repetitivas (meta de piloto: ≥40% em atesto e pesquisa de preços — 🔵 a validar).
2. Prover **trilha de auditoria append-only** para cada ação de agente (obrigatório).
3. Suportar **residência de dados on-premise / modelos abertos** para dados sensíveis do setor público.
4. Entregar conhecimento **sempre com citação de fonte** (zero-alucinação-tolerável em atos administrativos).
5. Habilitar **construção por servidores TAE** (low-code) sem depender de fornecedor externo.

### Não-Objetivos (🟡)
- **Não** substituir a decisão humana em atos administrativos vinculados (atesto, homologação, empenho permanecem de competência do agente público).
- **Não** ser ERP nem sistema de processo eletrônico — o SO-IA **integra** SIPAC/SEI/Compras.gov.br, não os substitui.
- **Não** operar autonomia A4/A5 sobre atos que a Lei 14.133 exige segregação de funções.

---

# 4. Personas e Jobs To Be Done

## 4.1 Personas do setor privado (mantidas)
| Persona | Job To Be Done |
|---|---|
| Diretor(a) de Operações | "Quero visibilidade e automação de processos sem contratar mais gente." |
| Head de Vendas | "Quero qualificar leads e preparar propostas mais rápido." |
| Analista de Marketing | "Quero gerar e revisar conteúdo ancorado na marca." |
| Gestor(a) de TI/Dados | "Quero governança, segurança e integração sem lock-in." |

## 4.2 Personas do setor público (NOVAS)
| Persona | Job To Be Done | Autonomia máx. recomendada |
|---|---|---|
| **Fiscal de contrato** | "Quero ser alertado de vigências e conferir NF contra o contrato antes de atestar." | A2 (preparador) |
| **Pregoeiro / Agente de contratação** | "Quero instruir o processo e checar conformidade do edital com a Lei 14.133." | A2 |
| **Gestor de contratos** | "Quero controlar aditivos, prazos e prorrogações de todos os contratos do campus." | A3 (executor governado, para tarefas não-vinculadas) |
| **Auditor interno** | "Quero verificar conformidade documental e segregação de funções." | A1 (recomendador) |
| **Procurador / AGU** | "Quero minutas e checklists jurídicos com citação de normas e acórdãos." | A2 |
| **Servidor TAE construtor** | "Quero montar automações para minha instituição sem programar." | Admin de tenant |

**Nota de governança (✅):** o **Acórdão TCU nº 1668/2021 – Plenário** veda que o mesmo agente atue em praticamente todas as etapas da contratação ("Não é aceitável que um único agente elabore o termo de referência e, posteriormente, ele mesmo o aprove"). O SO-IA **codifica a segregação de funções** como regra de workflow (ver §9 e §23).

---

# 5. Modelo Conceitual e Grafo Radial

Grafo radial organizacional com **núcleo de conhecimento central** no centro e as áreas como raios. Entidades principais:

`Tenant → Área → {Agente, Skill, Workflow, Conector, FonteDeConhecimento} → Execução → {Aprovação, RegistroDeAuditoria}`

```
                         ┌───────────────────────┐
                         │   NÚCLEO DE            │
                         │   CONHECIMENTO (RAG)   │
                         │   + Citações           │
                         └───────────┬───────────┘
        Licitações/Contratos  ┌──────┼──────┐  Orçamento/Finanças
                 ╲            │      │      │            ╱
        Patrimônio ──────  CENTROS DE COMANDO  ────── Gestão de Pessoas
                 ╱            │      │      │            ╲
        Comunicação    └──────┼──────┘  Ensino/Pesquisa/Extensão
                        Gabinete/Governança · TI
```

---

# 6. Áreas de Negócio e o "Modo Governo"

## 6.1 Modo Empresa (7 áreas originais — mantidas)
Vendas · Negócios · Marketing · Operações · Inteligência · Clientes · Back Office.

## 6.2 Modo Governo (8ª dimensão — NOVA; áreas adaptadas 🟡)
| Área (Governo) | Escopo | Sistemas típicos |
|---|---|---|
| **Licitações e Contratos** | Instrução, ETP/TR, pesquisa de preços, fiscalização, vigências | SIPAC, Compras.gov.br, PNCP, Comprasnet Contratos |
| **Orçamento e Finanças** | Empenho, liquidação, atesto, pagamento | SIPAC (Liquidação), SIAFI |
| **Gestão de Pessoas** | Atos de pessoal, dúvidas de RH | SIGRH/SIGGP |
| **Ensino/Pesquisa/Extensão** | Editais, projetos, apoio acadêmico | SIGAA |
| **Gabinete/Governança** | Despachos, indicadores, controle interno | SIPAC/Protocolo |
| **Comunicação** | Notas, acessibilidade (eMAG/WCAG), LAI | Portais gov.br |
| **TI** | Suporte, contratações de TIC (IN SGD) | GLPI |
| **Patrimônio/Almoxarifado** | Entrada de NF, inventário, requisições | SIPAC (Almoxarifado) |

---

# 7. Catálogo de Agentes e Skills

## 7.1 Base original (mantida)
14 agentes e 28 skills nas 7 áreas do Modo Empresa, com 6 conectores MVP (Google Drive, CRM tipo HubSpot/Pipedrive, Meta Ads, GA4, Gmail/Outlook, Slack/Teams/WhatsApp).

## 7.2 Agentes de Governo (ADICIONADOS 🟡)
| Agente | Skills principais (SKILL.md) | Autonomia |
|---|---|---|
| **Agente de Instrução de Contratação** | `montar-etp`, `montar-tr`, `checklist-14133`, `verificar-segregacao-funcoes` | A2 |
| **Agente de Pesquisa de Preços** | `consultar-pncp-precos`, `consultar-painel-precos`, `cotar-fornecedores`, `calcular-preco-estimado` | A2 |
| **Agente de Atesto de NF** | `ler-nota-fiscal`, `conferir-nf-contra-empenho`, `checar-regularidade-fiscal`, `preparar-atesto` | A2 (atesto final = humano) |
| **Agente de Vigência Contratual** | `monitorar-vigencias`, `alertar-prazos`, `preparar-aditivo`, `checar-saldo-empenho` | A3 (alertas) / A2 (aditivos) |
| **Agente de Conformidade Documental** | `verificar-instrucao-processual`, `mapear-pendencias`, `citar-acordao-tcu` | A1 |
| **Agente de Atendimento LAI** | `triar-pedido-lai`, `redigir-resposta`, `checar-sigilo-lgpd` | A2 |

**Princípio de skills (✅):** conforme a Anthropic, uma *skill* é um diretório com `SKILL.md` (YAML frontmatter + Markdown) carregado por **progressive disclosure** — apenas nome/descrição no system prompt, corpo carregado sob demanda; segue o **Agent Skills open standard** (portável entre Claude apps, Claude Code e API). Isso reduz custo de contexto e permite **catálogo institucional versionado em git** 🟡.

---

# 8. Níveis de Autonomia A0–A5 (mantidos + regras de governo)

| Nível | Nome | Comportamento | Uso no setor público |
|---|---|---|---|
| **A0** | Observador | Só observa/loga | Livre |
| **A1** | Recomendador | Sugere, não age | Auditoria, pareceres |
| **A2** | Preparador | Prepara artefato para revisão humana | **Padrão para atos vinculados** (ETP, atesto, minutas) |
| **A3** | Executor governado | Executa com aprovação em pontos-chave | Alertas, tarefas não-vinculadas |
| **A4** | Autônomo limitado | Executa dentro de limites/orçamento | Apenas privado ou back-office não-crítico |
| **A5** | Autonomia ampliada | Opera com supervisão por exceção | **Vedado** para atos administrativos |

**Regra 🟡:** todo salto para A3+ exige (a) política de guardrails ativa, (b) *human-in-the-loop* configurado, (c) trilha append-only e (d), no setor público, verificação de **supervisão humana proporcional ao risco** (exigida pela Portaria MGI nº 3.485/2026 — ver §16).

---

# 9. Fluxos e Casos de Uso Demonstradores

## 9.1 Caso Público #1 — **Atesto de Nota Fiscal** (Agente de Atesto de NF)
```
[Gatilho] NF recebida (upload / e-mail / API SIPAC-Almoxarifado)
   │
   ▼
1. ler-nota-fiscal (IDP: extrai CNPJ, itens, valores, chave NFe)
2. conferir-nf-contra-empenho  → compara itens/qtd/valor com o empenho no SIPAC
3. checar-regularidade-fiscal  → SICAF / regularidade do fornecedor
4. mapear-pendencias           → divergências (preço, quantidade, prazo)
   │
   ▼
[A2] Prepara minuta de atesto + relatório de conferência com CITAÇÕES
   │
   ▼
[HUMANO] Fiscal revisa e ATESTA (ato vinculado — nunca automático)
   │
   ▼
[Auditoria append-only] registra quem, quando, com base em quê
```
**Contexto factual (✅):** no SIPAC, a **data de atesto** identifica o dia em que todos os materiais da nota foram recebidos ("um OK para a nota fiscal"), e o módulo de **Liquidação de Despesas** gerencia cadastro de NF, empenhos e liquidação — fluxo em que o agente atua como **preparador**, não decisor.

## 9.2 Caso Público #2 — **Alerta de Vigência Contratual** (Agente de Vigência)
```
[Agendado diariamente]
1. monitorar-vigencias (lê contratos do SIPAC/Comprasnet Contratos)
2. alertar-prazos (D-180/D-90/D-30 antes do fim da vigência)
3. checar-saldo-empenho
   │
   ▼
[A3] Notifica gestor + [A2] prepara minuta de termo aditivo (se cabível)
   │
   ▼
[Centro de Comando: Licitações e Contratos] dashboard de vigências em risco
```

## 9.3 Caso Público #3 — **Instrução de Pesquisa de Preços** (Agente de Pesquisa de Preços)
Ancorado nos parâmetros do **art. 23 da Lei 14.133/2021** e na **IN SEGES/ME nº 65/2021** ✅, que **prioriza (i) o Painel de Preços/Compras.gov.br e (ii) contratações similares da Administração**, com as demais fontes (mídia especializada, pesquisa direta com ≥3 fornecedores, base de NF-e) de forma complementar e justificada.
```
1. consultar-painel-precos  (Painel de Preços — paineldeprecos)
2. consultar-pncp-precos    (PNCP: contratos, atas de registro de preços)
3. cotar-fornecedores       (≥3, com justificativa de escolha)
4. calcular-preco-estimado  (média/mediana + memória de cálculo + descarte de outliers)
   │
   ▼
[A2] Gera relatório de pesquisa de preços com metodologia, fontes datadas e memória
   │
   ▼
[HUMANO] Agente de contratação valida (respeitada a segregação — Acórdão TCU 1668/2021)
```

## 9.4 Casos privados (mantidos)
Qualificação de leads → preparação de proposta; briefing → conteúdo de marketing revisado; triagem de tickets → resposta com citação de base de conhecimento.

---

# 10. Requisitos Funcionais e Não-Funcionais

## 10.1 Funcionais (RF)
- RF-01 Multi-tenancy com isolamento por tenant (RLS no PostgreSQL).
- RF-02 Núcleo de conhecimento com RAG + **citações obrigatórias** e *query-time filters* por permissão.
- RF-03 Construtor visual de workflows (low-code) para TAEs e times de negócio.
- RF-04 Caixa de trabalho, filas de aprovação e *human-in-the-loop*.
- RF-05 Catálogo de agentes/skills versionado (SKILL.md).
- RF-06 Centros de Comando com KPIs por área.
- RF-07 Conectores via **MCP servers** + conectores nativos gov (PNCP, Compras.gov.br).
- RF-08 Model router entre provedores (incl. modelos abertos on-premise).

## 10.2 Não-Funcionais (RNF)
- RNF-01 **Auditoria append-only** imutável de toda ação de agente.
- RNF-02 **LGPD**: base legal, minimização, encarregado (DPO), publicidade de dispensa de consentimento (setor público).
- RNF-03 **Residência de dados**: opção on-premise para dados sensíveis; vedação de envio de dados sigilosos a IA generativa externa (Portaria MGI 3.485/2026).
- RNF-04 **Acessibilidade** eMAG/WCAG.
- RNF-05 Observabilidade (OpenTelemetry) e avaliação contínua (LLM-as-judge).
- RNF-06 Disponibilidade alvo ≥ 99,5% (🔵 a validar por SLA de contrato).
- RNF-07 Segredos em Vault; RBAC granular.

---

# 11. Arquitetura de Referência

```
┌─────────────────────────────────────────────────────────────────┐
│  APRESENTAÇÃO  — Next.js/React (Centros de Comando, Workbench)   │
└───────────────┬─────────────────────────────────────────────────┘
                │  (BFF / API Gateway — authz, rate limit, OWASP)
┌───────────────▼─────────────────────────────────────────────────┐
│  ORQUESTRAÇÃO — FastAPI/NestJS + Temporal (workflows duráveis)    │
│   • Fila de aprovações (human-in-the-loop)                        │
│   • Motor de autonomia A0–A5 + guardrails                         │
└───────┬───────────────────────┬───────────────────┬──────────────┘
        │                       │                   │
┌───────▼───────┐   ┌───────────▼────────┐   ┌──────▼───────────────┐
│ CAMADA DE     │   │  MODEL ROUTER      │   │  CAMADA MCP SERVERS  │
│ AGENTES/SKILLS│   │  Claude/OpenAI/    │   │ (conectores como     │
│ (SKILL.md)    │   │  Gemini/Llama/Qwen │   │  ferramentas)        │
│               │   │  on-prem p/ dados  │   │  + A2A (agente↔agente)│
│               │   │  sensíveis         │   │                      │
└───────┬───────┘   └────────────────────┘   └──────┬───────────────┘
        │                                             │
┌───────▼─────────────────────────────────────────────▼────────────┐
│  NÚCLEO DE CONHECIMENTO — PostgreSQL (RLS) + pgvector, Redis, S3   │
│  Event-driven (fila de eventos) · OpenTelemetry · Vault           │
└───────────────────────────────────────────────────────────────────┘
        │ conectores gov / privados
   PNCP · Compras.gov.br · Comprasnet Contratos · SIPAC · SIAFI ·
   TransfereGov · Gov.br SSO · SEI (p/ órgãos que o usam) ·
   Google Drive · CRM · Meta Ads · GA4 · Gmail/Outlook · Slack/Teams/WhatsApp
```

**Decisões de arquitetura (🟡):**
- **MCP como mecanismo de conectores** — MCP (Anthropic, nov/2024; doado à **Agentic AI Foundation / Linux Foundation** em dez/2025 [DEV Community](https://dev.to/pockit_tools/mcp-vs-a2a-the-complete-guide-to-ai-agent-protocols-in-2026-30li) ✅) é o "USB-C" agente↔ferramenta; cada integração vira um **MCP server**, isolando credenciais e reduzindo integrações custom.
- **A2A (Google, abr/2025; também sob Linux Foundation)** para orquestração agente↔agente, com **Agent Card** em `/.well-known/agent-card.json` e ciclo de vida de *Task* [arxiv](https://arxiv.org/pdf/2606.03755) ✅.
- **Model routing** priorizando **modelos abertos on-premise (Llama/Qwen)** quando o dado é sigiloso/sensível — atende à exigência de soberania de dados do setor público. O TCU, por exemplo, opera o **ChatTCU sobre Microsoft Azure OpenAI Service em ambiente restrito** ✅, um precedente de "IA em ambiente controlado".

---

# 12. Modelo de Dados (essencial)

| Entidade | Campos-chave |
|---|---|
| `tenant` | id, nome, modo(empresa/governo), residencia_dados, orgao_cnpj |
| `area` | id, tenant_id, tipo, nome |
| `agent` | id, area_id, nome, autonomia, model_policy, guardrails_id |
| `skill` | id, nome, versao, skill_md (blob), allowed_tools, hash |
| `workflow` | id, area_id, definicao(json), segregacao_funcoes(bool) |
| `connector` | id, tipo(mcp/nativo), config(ref Vault), escopos |
| `knowledge_source` | id, tenant_id, tipo, permissao, embedding_ref |
| `execution` | id, agent_id, workflow_id, status, inputs, outputs, custo_tokens |
| `approval` | id, execution_id, aprovador, decisao, timestamp |
| `audit_log` | id, ator, acao, entidade, before/after, timestamp (**append-only**) |

Isolamento por **Row-Level Security (RLS)** no PostgreSQL; vetores em **pgvector**.

---

# 13. Contratos de API e Exemplos JSON

## 13.1 AgentDefinition (JSON Schema resumido)
```json
{
  "$schema": "https://so-ia.gov.br/schemas/agent.v1.json",
  "id": "agente-atesto-nf",
  "nome": "Agente de Atesto de Nota Fiscal",
  "area": "orcamento_financas",
  "autonomia": "A2",
  "model_policy": {
    "default": "claude-sonnet",
    "sensitive_data": "llama-3-70b-onprem",
    "fallback": "gpt-4o"
  },
  "skills": ["ler-nota-fiscal","conferir-nf-contra-empenho","checar-regularidade-fiscal","preparar-atesto"],
  "connectors": ["mcp-sipac","mcp-sicaf"],
  "guardrails": {
    "pii_redaction": true,
    "prompt_injection_defense": "strict",
    "human_approval_required_for": ["atesto_final"]
  },
  "audit": { "append_only": true }
}
```

## 13.2 SkillDefinition (SKILL.md — frontmatter + corpo)
```markdown
---
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
4. Retornar tabela com fonte, data/hora de acesso e link do documento.
```

## 13.3 WorkflowDefinition (JSON Schema resumido — com segregação de funções)
```json
{
  "$schema": "https://so-ia.gov.br/schemas/workflow.v1.json",
  "id": "wf-pesquisa-precos",
  "area": "licitacoes_contratos",
  "segregacao_funcoes": true,
  "steps": [
    { "id": "s1", "agent": "agente-pesquisa-precos", "autonomia": "A2" },
    { "id": "s2", "type": "human_approval", "role": "agente_de_contratacao",
      "rule": "aprovador != autor_do_ETP" }
  ],
  "audit": { "append_only": true },
  "compliance_refs": ["Lei 14.133/2021 art.23","IN SEGES/ME 65/2021","Acordao TCU 1668/2021"]
}
```

---

# 14. Padrões e Protocolos de Agentes (2025–2026)

| Padrão | Origem/status | Uso no SO-IA (🟡) |
|---|---|---|
| **MCP (Model Context Protocol)** | Anthropic (nov/2024); doado à Agentic AI Foundation/Linux Foundation (dez/2025) [DEV Community](https://dev.to/pockit_tools/mcp-vs-a2a-the-complete-guide-to-ai-agent-protocols-in-2026-30li) ✅ | Mecanismo padrão de conectores (agente↔ferramenta) |
| **A2A (Agent2Agent)** | Google (abr/2025); Linux Foundation; Agent Card + Task lifecycle [arxiv](https://arxiv.org/pdf/2606.03755) ✅ | Orquestração multi-agente entre tenants/órgãos |
| **Agent Skills (SKILL.md)** | Anthropic; open standard, progressive disclosure ✅ | Formato canônico de skills reutilizáveis |
| **OpenAI function calling / Agents SDK** | OpenAI (Responses API/Agents SDK, mar/2025) ✅ | Compatibilidade de tool-calling no model router |
| **Orquestração** (Temporal, LangGraph, CrewAI) | Ecossistema 2025–2026 ✅ | Temporal para durabilidade; LangGraph/CrewAI candidatos p/ padrões de agente (🔵 a decidir em POC) |

**Posição estratégica (🟡):** adotar **padrões abertos** (MCP/A2A/SKILL.md) evita lock-in — diferencial frente a plataformas que amarram o cliente ao seu grafo de dados (ver §19).

---

# 15. Segurança de Agentes e Governança de IA

## 15.1 OWASP Top 10 para LLM (edição 2025) ✅
**Prompt Injection (LLM01) mantém o 1º lugar** pela 2ª edição consecutiva — LLMs processam instruções e dados no mesmo canal ✅. Riscos-chave adotados como *checklist* obrigatório: injeção direta e indireta, *sensitive information disclosure*, *supply chain*, *data/model poisoning*, *improper output handling*, **excessive agency/permissions**, *misinformation* e *unbounded consumption*.

## 15.2 Defesas em profundidade (🟡)
- Isolamento instrução/dados; *output handling* tratado como não confiável.
- Filtros de *prompt injection* (direto e indireto) em conteúdo recuperado (RAG).
- **Menor privilégio** para tool-calls (mitiga *excessive agency*).
- *Human-in-the-loop* obrigatório em A2/A3 para atos sensíveis.
- **LLM-as-judge** e red-teaming contínuo (ex.: garak/DeepTeam) na avaliação.
- Isolamento multi-tenant por RLS + segregação de credenciais nos MCP servers.

## 15.3 Frameworks de governança
- **NIST AI RMF** (Govern/Map/Measure/Manage — voluntário) ✅ como espinha de risco.
- **ISO/IEC 42001:2023** (AIMS — certificável, estruturada como ISO 27001) ✅ como sistema de gestão. Há **crosswalk oficial NIST↔ISO 42001** publicado pelo NIST ✅.
- Adoção conjunta 🟡: ISO 42001 = "estrutura do prédio"; NIST AI RMF = "fiação flexível" para riscos emergentes.

---

# 16. Requisitos Legais e Normativos do Setor Público

| Norma | O que exige | Impacto no SO-IA |
|---|---|---|
| **LGPD — Cap. IV (arts. 23–32)** ✅ | Tratamento pelo poder público só para **finalidade pública**, com informação ao titular e **encarregado (art. 39)**; [Fortaleza](https://transparencia.fortaleza.ce.gov.br/index.php/leiGeralProtecaoDados/guia/tratamento_dados_pessoais) publicidade da dispensa de consentimento (art. 23, I) | Base legal e DPO por tenant; logs de finalidade |
| **PL 2338/2023 (Marco Legal da IA)** ✅⚠️ | Aprovado no Senado em **10/12/2024**; em 2026 tramita na Câmara [Blog Locus.IA](https://ialocus.com.br/blog/post-pl-2338-marco-legal-ia-brasil-2026.html) (votação adiada para fevereiro/2026); modelo **baseado em risco** (inspirado no AI Act), transparência/explicabilidade, direito a revisão humana, sanções de até **R$ 50 mi**; [Blog Locus.IA](https://ialocus.com.br/blog/post-pl-2338-marco-legal-ia-brasil-2026.html) Executivo enviou PL do **SIA** (governança) para sanar vício de iniciativa | Projetar para "alto risco": auditabilidade, explicabilidade, avaliação de impacto (⚠️ ainda **não é lei**) |
| **Lei 14.129/2021 (Governo Digital)** ✅ | Interoperabilidade, dados abertos, processo eletrônico, transparência ativa [Governo Digital](https://www.gov.br/governodigital/pt-br/legislacao/lei-do-governo-digital) | Conectores gov + dados abertos |
| **EGD/EFGD 2024–2027 (Decreto 12.198/2024; Portarias SGD/MGI 6.618/2024 e 473/2026)** ✅ | Metas de IA: ≥25 ciclos de projetos no PBIA; meta de **60% dos órgãos do SISP com soluções de IA com critérios éticos até 2026** | Alinhar roadmap às metas EFGD |
| **Portaria MGI nº 3.485/2026** ✅ | Política de governança de IA do MGI: **supervisão humana proporcional ao risco**, identificação de conteúdo gerado por IA, **vedação de dados sigilosos/pessoais em IA generativa** salvo análise de risco | Guardrails nativos + rótulo de conteúdo IA |
| **INs SGD/ME (ex.: IN 94/2022 TIC; Portaria 750/23)** ✅ | Regras de contratação de TIC e software no SISP | Aderência do modelo de contratação |
| **eMAG / WCAG** ✅ | Acessibilidade digital | RNF-04 |
| **ePING** ✅ | Padrões de interoperabilidade | Camada de conectores |
| **LAI (Lei 12.527/2011)** ✅ | Transparência ativa/passiva; limites de dados pessoais | Agente de Atendimento LAI |
| **Diretrizes TCU/CGU** ✅ | Auditoria, rastreabilidade, segregação de funções (Acórdão 1668/2021) | Auditoria append-only + regra de segregação |

---

# 17. Integrações Governamentais

| Sistema | Papel | Modo de integração | Observação factual |
|---|---|---|---|
| **PNCP** ✅ | Publicidade de contratações; consulta de preços/atas | **API REST/JSON**; consultas públicas sem login; APIs de manutenção com **JWT (login → Bearer, token válido 1h)** | Base para pesquisa de preços (art. 23) |
| **Compras.gov.br / SIASG** ✅ | Operacionalização de licitações; CATMAT/CATSER; Painel de Preços; ETP Digital | **API Dados Abertos (Swagger, CSV/JSON)**; [GOV.BR](https://www.gov.br/compras/pt-br/cidadao/compras-publicas-dados-abertos) Módulo 7 – Contratações 14.133 | IFFar realiza licitações aqui (UASG Reitoria 158127; Campus FW 155570) |
| **Comprasnet Contratos (contratos.comprasnet.gov.br)** ✅ | Gestão de contratos; software livre (GPL) [Comprasnet](https://contratos.comprasnet.gov.br/api/docs) | **API documentada (Swagger)** | Fonte para vigências/aditivos |
| **SIPAC/SIG (UFRN)** ✅ | Processo eletrônico, contratos, liquidação, almoxarifado | Integração via módulos/protocolo; **IFFar interopera com Tramita GOV.BR (2026)** | **Sistema principal do IFFar** |
| **SIAFI** ✅ | Execução orçamentária/financeira federal | Integração indireta via SIPAC | Empenho/liquidação |
| **TransfereGov** ✅ | Transferências, convênios | API | Convênios/projetos |
| **Gov.br SSO** ✅ | Autenticação do cidadão/servidor | OIDC | Login único |
| **SEI** ✅ | Processo eletrônico | Conector opcional | Usado por **outros IFs** (IFRO, IFPE); **não pelo IFFar** — correção importante |

---

# 18. Benchmarks de IA no Setor Público Brasileiro ✅

- **Família de robôs do TCU (desde 2016):** **ALICE** (Análise de Licitações e Editais — varre editais no Compras.gov.br/DOU; já superou 100 mil análises), **SOFIA**, **MÔNICA**, **ADELE**, **CARINA**, **ÁGATA** ✅. Em decisão recente, o TCU destacou o avanço do **Alice 360** com IA [Zeanite](https://zenite.blog.br/tcu-aponta-irregularidades-em-contratacoes-publicas-e-destaca-avanco-do-alice-360-com-ia/) e a intenção de integrá-lo ao Sistema Compras ✅⚠️ *(integração ampliada é planejamento em curso)*.
- **ChatTCU (lançado em março/2023, sobre Azure OpenAI, ambiente restrito):** segundo o Portal TCU, **em setembro já contava com mais de 2 mil usuários, 97 mil conversas abertas e quase 650 mil mensagens trocadas**, [TCU](https://portal.tcu.gov.br/imprensa/noticias/instituicoes-parceiras-recebem-suporte-tecnico-para-implementacao-do-chattcu) e teve o código-fonte compartilhado com **mais de 136 instituições** [TCU](https://portal.tcu.gov.br/imprensa/noticias/chattcu-ultrapassa-136-compartilhamentos-de-codigo-fonte) ✅.
- **Governo Federal — NIA (Núcleo de IA da SGD/MGI):** ações formalizadas nas **Portarias SGD/MGI 6.618/2024 e 473/2026**; meta de capacitar **115 mil servidores em IA até 2026** e desenvolver ≥25 soluções; **SerproLLM** e guia "IA Generativa no Serviço Público" ✅.
- **Estados/outros IFs:** Ceará (Seplag) lançou assistente de justificativas de contratação com IA generativa (set/2025); IFTO tem pesquisa aplicada de IA em licitações/obras ✅. **No IFFar não há iniciativa de IA operacional em contratos** — lacuna que o SO-IA endereça ✅.

**Leitura estratégica (🟡):** os precedentes mostram apetite institucional real, mas concentrados em **órgãos de controle e no governo federal**. Há **espaço aberto na "ponta"** (campi de institutos federais, prefeituras, autarquias médias) — o mercado-alvo natural do SO-IA no setor público.

---

# 19. Análise Competitiva de Mercado (2025–2026)

| Plataforma | Posicionamento | Preço conhecido (2026) | Diferencial | Fraqueza p/ nosso alvo |
|---|---|---|---|---|
| **Microsoft Copilot Studio** ✅ | Camada de agentes sobre M365/Dataverse | M365 Copilot ~US$ 30/usuário/mês; Copilot Studio por **créditos (~US$ 0,01/mensagem; US$ 200 = 25.000 msgs)** | Grafo de produtividade M365; conectores amplos; suporte MCP | Lock-in Microsoft; custo escala com volume de mensagens |
| **Salesforce Agentforce** ✅ | Agentes CRM-native (Atlas Reasoning) | **~US$ 2/conversa**; add-ons a partir de **US$ 125/usuário/mês**; Agentforce 1 a **US$ 550/usuário/mês** (1 mi Flex Credits) | Profundidade no Customer 360; Einstein Trust Layer | Caro; depende de Data 360; foco CRM |
| **Google Gemini Enterprise (ex-Agentspace)** ✅ | Plataforma agêntica + busca | **US$ 21–60+/usuário/mês** + billing separado de tokens/compute | Busca + agentes; Nano Banana; MCP via SDK | No-code limitado fora do ecossistema Google; billing complexo |
| **Glean** ✅ | Busca corporativa + agentes | Sob consulta (enterprise) | 100+ conectores, permissões em runtime | Foco em busca/retrieval, orquestração limitada |
| **Dust.tt** ✅ | Plataforma multi-agente (open source, MIT) | Sob consulta; foca automação | Multi-modelo, agentes no Slack/Teams, sem lock-in | Menos maduro em governança gov-BR |
| **Palantir AIP / CrewAI / LangGraph Platform / n8n / Zapier Agents / Relevance AI** ✅ | De orquestração enterprise a automação no-code | Variado (n8n/Zapier acessíveis; Palantir enterprise) | Flexibilidade/on-prem (Palantir) | Nenhum tem conformidade Lei 14.133/LGPD-poder-público nativa |
| **Players BR** ✅ | **Inner AI / Squad.com** (R$ 30 mi captados, valuation ~R$ 500 mi); **Freedom** (agentes B2B, +900% receita 2025, clientes Panvel/Vibra); **Loopia** (e-commerce, Seed R$ 6,5 mi); **Blip** (conversacional, +US$ 170 mi) | Assinatura/uso | Contexto BR, PT-BR | Nenhum com **modo governo / Lei 14.133 nativo** |

**Conclusão competitiva (🟡):** os líderes globais assumem que você "já comprou o grafo deles" (Salesforce/Microsoft) e **nenhum** oferece **conformidade nativa Lei 14.133 + LGPD-poder-público + residência on-premise + segregação de funções**. É exatamente aí que o SO-IA se diferencia — um **"GovTech agentic + PME BR"** com padrões abertos (MCP/A2A/SKILL.md).

---

# 20. Tamanho de Mercado e Tendências ✅⚠️

- **Mercado global de agentic AI:** US$ 7,29 bi (Fortune Business Insights, 2025) / US$ 7,6 bi (Grand View, 2025) → **~US$ 10,9 bi em 2026** (Grand View), CAGR 40–50% até 2031–2034 ✅⚠️.
- **Adoção:** ~**79%** das empresas dizem ter adotado agentes, mas só **~11% em produção** ✅; **IDC estima que agentic AI já representa 10–15% do gasto de TI empresarial em 2026** ✅⚠️.
- **Precificação em transição:** por *seat* caiu de **21%→15%** em 12 meses; **híbrido (base+uso) subiu para ~41%** [Pickaxe](https://pickaxe.co/post/ai-agent-pricing-models) (Bessemer 2026 AI Pricing Playbook) ✅⚠️.
- **Outcome-based:** Intercom **US$ 0,99/conversa resolvida**; [KORIX](https://korixinc.com/learning-center/ai-pricing-models-2026) Zendesk **US$ 1,50–2,00/resolução**; [Substack](https://thepricingconundrum.substack.com/p/outcome-based-pricing-in-practice) HubSpot Breeze caiu para **US$ 0,50/conversa resolvida** (abr/2026) [Substack](https://thepricingconundrum.substack.com/p/outcome-based-pricing-in-practice) ✅.
- **Brasil:** ecossistema aquecido — startups de IA captaram centenas de milhões em 2025; forte demanda em back-office ("problemas chatos" de alto ROI) ✅.

---

# 21. Estratégia Go-to-Market Dual (🟡)

## 21.1 Setor Público
- **Beachhead:** um campus de instituto federal (piloto IFFar/CLC-FW) com 3 casos de uso (§9), operado por **servidor TAE construtor** — modelo *land* de baixo custo.
- **Expansão:** de campus → reitoria → outros IFs (há 11 campi no IFFar; a Rede Federal tem dezenas de institutos) → autarquias/prefeituras.
- **Prova de valor:** métricas de tempo economizado + conformidade (auditoria append-only) para convencer controle interno/TCU.
- **Alavancas:** alinhamento à EFGD (meta de 60% dos órgãos SISP com IA até 2026) e ao PBIA.

## 21.2 Setor Privado (20–500 colaboradores)
- **Motion:** *product-led* + vendas assistidas; começar por Back Office/Operações (ROI claro).
- **Empacotamento:** conectores MVP + 2–3 workflows prontos por vertical.

---

# 22. Monetização

## 22.1 Setor Privado (🟡)
- **Híbrido (recomendado):** assinatura base por tenant + **uso** (execuções/tokens) — alinhado ao padrão de mercado (41% híbrido) ✅.
- **Opção outcome-based** para casos mensuráveis (ex.: ticket resolvido) — com **definição contratual de "resolução"** para evitar disputas [KORIX](https://korixinc.com/learning-center/ai-pricing-models-2026) ✅.

## 22.2 Setor Público (🟡)
- **Uso interno / open source:** um servidor TAE constrói e opera para a instituição (custo marginal ≈ infra + tokens) — modelo mais aderente à realidade orçamentária dos IFs.
- **SaaS GovTech:** contratação via **Lei 14.133/2021** (licitação/dispensa conforme valor), com atenção às **INs SGD/ME de contratação de TIC** e ao **Mapa Salarial de Referência** da SGD ✅.
- **Marketplace/Compras.gov.br:** disponibilização como solução catalogada 🔵.
- **Cautela (⚠️):** *outcome-based* puro é problemático no setor público (atos vinculados não podem ter cobrança condicionada a "resolução automática"); preferir **licença + uso** com residência on-premise.

---

# 23. Riscos

| Risco | Tipo | Mitigação |
|---|---|---|
| **Prompt injection / excessive agency** | Técnico | OWASP LLM 2025, menor privilégio, HITL |
| **Alucinação em ato administrativo** | Técnico/Jurídico | RAG com citação obrigatória; autonomia máx. A2 em atos vinculados |
| **Violação de segregação de funções** | Público | Regra `aprovador != autor` no workflow (Acórdão TCU 1668/2021) |
| **Vazamento de dados sigilosos** | Público/LGPD | Residência on-premise; vedação de dado sigiloso em IA generativa (Portaria MGI 3.485/2026) |
| **Responsabilização do Estado (LGPD art. 42–43, responsabilidade objetiva)** | Público | Auditoria append-only; DPO; base legal documentada |
| **Marco legal da IA muda regras** | Regulatório | Projetar para "alto risco" (explicabilidade/avaliação de impacto) desde já (⚠️ PL 2338 ainda não é lei) |
| **Cancelamento por custo/valor incerto** | Mercado | Gartner: >40% dos projetos em risco até 2027 ✅⚠️ → começar por casos de alto ROI e medir |
| **Lock-in de fornecedor de modelo** | Técnico/Negócio | Model router + padrões abertos (MCP/A2A/SKILL.md) |
| **Baixa maturidade digital / resistência institucional** | Público | Construção por TAE, capacitação, começar em A1/A2 |

---

# 24. Métricas e KPIs (🟡)
- **Produto:** nº de agentes/skills ativos, execuções/mês, taxa de aprovação humana, custo por execução.
- **Valor:** tempo economizado por caso (atesto, pesquisa de preços), % de processos instruídos com apoio.
- **Qualidade/segurança:** taxa de citações válidas, incidentes de segurança, cobertura de avaliação (LLM-as-judge).
- **Governo:** % de ações com trilha append-only completa, conformidade em amostra de auditoria.
- **Negócio:** MRR/ARR (privado), nº de órgãos/campi ativos (público), NRR.

---

# 25. Roadmap em 5 Fases e Gates Go/No-Go

| Fase | Escopo | Gate Go/No-Go |
|---|---|---|
| **F1 — Núcleo** | Multi-tenancy, RAG+citações, auditoria append-only, 6 conectores MVP, A0–A2 | Gate Funcional + Conhecimento |
| **F2 — Workflows & Autonomia** | Construtor visual, HITL, A3, guardrails, LLM-as-judge | Gate IA + Segurança |
| **F3 — Modo Governo** | Áreas gov, conectores PNCP/Compras.gov.br/SIPAC, 3 casos-âncora, segregação de funções | Gate Segurança + Negócio (piloto IFFar) |
| **F4 — Escala & On-prem** | Model router on-premise (Llama/Qwen), A2A multi-órgão, ISO 42001 readiness | Gate Segurança + Residência |
| **F5 — Marketplace & Outcome** | Catálogo de skills gov, pricing híbrido/outcome, expansão Rede Federal + PMEs | Gate Negócio |

---

# 26. Definition of Done e Gates de Aceitação

**Definition of Done (por feature):** código + testes + observabilidade + doc + **entrada de auditoria** + revisão de segurança.

| Gate | Critério (amostra) |
|---|---|
| **Funcional** | Fluxo ponta-a-ponta executa; RBAC e multi-tenant isolados |
| **Conhecimento** | ≥95% das respostas com citação verificável; *query-time filters* por permissão |
| **IA** | Avaliação LLM-as-judge acima do baseline; taxa de alucinação abaixo do limite (🔵 definir) |
| **Segurança** | Testes OWASP LLM 2025 (prompt injection direto/indireto) passam; segredos em Vault |
| **Negócio** | Piloto atinge meta de tempo economizado; parecer favorável de controle interno (público) |

---

# 27. Questões Abertas
1. 🔵 Framework de orquestração de agentes definitivo (LangGraph vs. CrewAI vs. próprio sobre Temporal) — decidir em POC.
2. 🔵 Modelo aberto on-premise padrão para dados sensíveis (Llama vs. Qwen vs. SerproLLM) e requisitos de hardware por campus.
3. 🔵 Limiar aceitável de alucinação por tipo de ato administrativo.
4. 🔵 Sigla oficial da unidade no IFFar-FW: fontes confirmam **"CLC" (Coordenação de Licitação e Contratos)**; "CLCFW" não foi confirmada textualmente — validar com a instituição.
5. 🔵 Estratégia de contratação pública ótima (dispensa vs. pregão vs. cessão/open source) por faixa de valor.
6. ⚠️ Dependência do desfecho do **PL 2338/2023** (classificação de risco, sanções) sobre requisitos de explicabilidade.

---

# 28. Análise Crítica do PRD Original

## 28.1 O que foi **mantido** ✅
- 7 áreas do Modo Empresa; grafo radial; núcleo de conhecimento com RAG e citações.
- Catálogo de 14 agentes / 28 skills; construtor de workflows; caixa de trabalho e aprovações; 7 Centros de Comando.
- 6 conectores MVP; níveis de autonomia A0–A5; RBAC; multi-tenancy; auditoria append-only.
- Stack (Next.js/React, FastAPI/NestJS, Temporal, PostgreSQL+RLS+pgvector, Redis, S3, OpenTelemetry, Vault); model router; requisitos LGPD; roadmap em 5 fases; monetização assinatura+uso; gates de aceitação.

## 28.2 O que foi **corrigido/ajustado** 🟡
- **Autonomia no setor público:** atos vinculados **rebaixados para A2 (preparador)** com aprovação humana obrigatória — o PRD original não tratava a distinção ato vinculado × discricionário.
- **Conectores:** conectores agora expressos como **MCP servers** (padrão aberto), não integrações custom — reduz lock-in e superfície de credenciais.
- **Model router:** explicitada a **rota on-premise (modelos abertos)** para dados sensíveis, exigência do setor público.
- **Segurança:** ancorada explicitamente no **OWASP Top 10 LLM 2025** (prompt injection = LLM01) e nos frameworks **NIST AI RMF + ISO/IEC 42001**.
- **Fato corrigido sobre o IFFar:** usa **SIPAC/SIG (não SEI)** — evita erro de integração; "CLC" é a sigla confirmada.

## 28.3 O que foi **adicionado** 🟡 (novo nesta v2.0)
- **Dimensão Setor Público completa:** Modo Governo (8 áreas), personas públicas, 3 casos-âncora (atesto, vigência, pesquisa de preços), integrações gov (PNCP/Compras.gov.br/SIPAC/SIAFI/TransfereGov/Gov.br/SEI).
- **Requisitos legais BR:** LGPD-poder-público, PL 2338/2023, Lei 14.129/2021, EFGD/Portarias SGD, Portaria MGI 3.485/2026, eMAG/WCAG, ePING, LAI, diretrizes TCU/CGU (segregação de funções).
- **Benchmarks públicos:** ALICE/SOFIA/MÔNICA/ChatTCU, NIA/SGD, precedentes estaduais e de outros IFs.
- **Padrões de agentes 2025–2026:** MCP, A2A, Agent Skills (SKILL.md), OpenAI Agents SDK.
- **Contratos JSON concretos:** AgentDefinition, SkillDefinition (SKILL.md), WorkflowDefinition com segregação de funções.
- **Análise competitiva e de mercado 2025–2026** com preços (Copilot Studio, Agentforce, Gemini Enterprise, Glean, Dust, players BR) e **benchmarks de pricing** (seat/uso/outcome).
- **GTM dual** e **monetização adaptada ao setor público** (uso interno/open source vs. SaaS GovTech vs. Lei 14.133).
- **Riscos específicos do setor público** (segregação de funções, responsabilização objetiva, soberania de dados).

---

### Nota final de método
Afirmações de mercado e regulatórias estão marcadas com ✅ (verificado), ⚠️ (projeção/previsão de terceiros), 🟡 (proposta de produto) e 🔵 (hipótese a validar), preservando a **escala de confiança** do PRD original. Projeções de mercado (CAGR, tamanhos futuros, Gartner/IDC/Bessemer) e o status do PL 2338/2023 e do Alice 360 são **prospectivas de terceiros** e não devem ser lidas como fatos consumados.