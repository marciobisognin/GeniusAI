# GeniusAI Foresight — Metodologia Científica de Simulação e Forecasting

**Status:** metodologia normativa do produto; o MVP v0.1 implementa apenas o subconjunto explicitamente identificado no README e ainda não constitui validação empírica preditiva.
**Lente principal:** ciência de previsão probabilística, inferência causal, econometria dinâmica, modelagem baseada em agentes e decisão sob incerteza.
**Princípio central:** o sistema não “prevê o futuro” como uma narrativa única. Ele estima distribuições condicionais, compara cenários explicitamente condicionados e identifica quais decisões parecem robustas dentro de modelos auditáveis e falíveis.

---

## 1. Leitura estrutural: objeto científico e fronteiras do produto

### 1.1 Pergunta científica correta

Para uma data de corte `t₀`, um conjunto de evidências `D≤t₀`, uma hipótese de modelo `M`, ações futuras `a` e premissas de cenário `s`, o objeto é:

\[
p(Y_{t_0+h}, X_{t_0+1:t_0+h}\mid D_{\le t_0}, a, s, M)
\]

onde:

- `Y`: resultados observáveis — inflação, preço, fluxo comercial, conflito, escassez, mudança de governo etc.;
- `X`: estado latente do mundo — capacidade, intenção, coesão, regime econômico, prontidão, percepção e outros construtos não diretamente observados;
- `h`: horizonte em dias, semanas, meses ou anos;
- `a`: sequência de ações dos atores;
- `s`: condições de cenário;
- `M`: estrutura causal e dinâmica assumida.

A saída primária deve ser **probabilística e condicional**, não uma frase categórica. Uma trajetória é apenas uma amostra de uma distribuição de trajetórias.

### 1.2 Usos pretendidos

1. organizar evidências e hipóteses sobre países, civilizações, recursos e mercados;
2. estimar probabilidades de eventos bem definidos e distribuições de variáveis contínuas;
3. explorar propagação de choques e interdependências;
4. comparar políticas e estratégias sob múltiplos futuros plausíveis;
5. explicitar incerteza, desacordo entre modelos e variáveis com maior valor de informação;
6. aprender continuamente por backtesting prequential.

### 1.3 Não objetivos

- adivinhar eventos singulares sem classe de referência nem evidência;
- produzir causalidade a partir de correlação textual;
- tratar personas de LLM como atores reais ou como fontes independentes;
- prometer retornos, acerto ou certeza;
- executar ordens financeiras, políticas, militares ou de infraestrutura;
- substituir analistas, assessores regulados ou autoridades responsáveis;
- atribuir probabilidades numéricas quando o sistema não possui base defensável para fazê-lo.

### 1.4 Unidade mínima de previsão

Toda previsão registrada precisa de um **forecast contract**:

| Campo | Exigência |
|---|---|
| Pergunta | evento ou variável operacionalmente definida |
| Universo | país, ativo, população, mercado ou sistema |
| Data de corte | `t₀` e timezone |
| Horizonte | data/intervalo de resolução |
| Resolução | regra inequívoca e fonte de verdade |
| Probabilidade/distribuição | valor e quantis, nunca apenas linguagem vaga |
| Evidência | IDs do evidence ledger usados |
| Premissas | cenário, intervenções e variáveis mantidas constantes |
| Modelo | versão, parâmetros, seed e código/configuração |
| Incerteza | decomposição e diagnóstico de extrapolação |
| Status | aberta, resolvida, cancelada ou não resolvível |

Sem contrato ex ante não há backtest cientificamente válido.

---

## 2. Eixo central: arquitetura metodológica em camadas

```text
Fontes versionadas → Evidence Ledger → World State probabilístico
       ↓                    ↓                    ↓
 qualidade/vintage      DAG/SCM              filtro Bayesiano
       ↓                    ↓                    ↓
 baselines + séries + ABM + regimes → ensemble de trajetórias
                                      ↓
                           Monte Carlo / cenários
                                      ↓
                         MCTS para decisões, não “oráculo”
                                      ↓
       probabilidades + quantis + relações + incerteza + abstenção
                                      ↓
           resolução → scoring → calibração → revisão de modelo
```

A arquitetura separa deliberadamente cinco funções:

1. **evidência:** o que se sabia e quando;
2. **estado:** o que o sistema acredita sobre o presente;
3. **mecanismo:** como variáveis e atores interagem;
4. **simulação:** quais futuros o mecanismo gera sob incerteza;
5. **decisão:** quais ações são robustas dentro dessas hipóteses.

Narrativa e visualização ficam depois dessas camadas. O LLM pode extrair, resumir, propor hipóteses e explicar resultados; ele não pode criar observações, alterar o ledger ou substituir o motor quantitativo.

---

## 3. Insights mecanicistas e arquitetura científica detalhada

### 3.1 World State: estado do mundo probabilístico e temporal

Definir, por região/ator `i` e tempo `t`:

\[
S_t = \{X_t, Z_t, G_t, A_t, E_t, \Theta, \mathcal{M}, \mathcal{I}_{t_0}\}
\]

- `X_t`: vetores contínuos e discretos de estado;
- `Z_t`: regimes latentes, por exemplo paz/crise/guerra, expansão/recessão, líquido/estressado;
- `G_t`: grafo dinâmico de comércio, alianças, rivalidades, crédito, energia, informação e logística;
- `A_t`: ações disponíveis e executadas pelos atores;
- `E_t`: choques exógenos sorteados ou condicionados;
- `Θ`: parâmetros incertos;
- `𝓜`: conjunto de modelos plausíveis;
- `𝓘_{t₀}`: conjunto de informação admissível na data de corte.

Dimensões mínimas por país/civilização:

- demografia e capital humano;
- produção, inflação, finanças públicas e externas;
- energia, água, alimentos e minerais;
- infraestrutura, logística e capacidade industrial;
- instituições, legitimidade, coesão e estabilidade;
- forças de segurança e capacidade militar em nível agregado e não operacional;
- tecnologia, inovação e dependências críticas;
- alianças, rivalidades, comércio e sanções;
- opinião pública e ecossistema informacional;
- clima, geografia e exposição a desastres;
- preços, volatilidade, liquidez e contágio, quando mercado for parte do problema.

Cada atributo do world state deve guardar **distribuição posterior**, não só um ponto. Construtos latentes como “intenção” ou “coesão” precisam de modelo de mensuração, indicadores observáveis, validade de construto e ampla incerteza.

### 3.2 Evidence Ledger bitemporal

Cada evidência terá pelo menos:

```yaml
evidence_id:
claim_or_observation:
entity:
variable:
event_time:          # quando o fenômeno ocorreu
release_time:        # quando se tornou publicamente disponível
ingested_at:
valid_from:
valid_to:
revision_id:
source_url:
source_type:
primary_or_secondary:
methodology:
provenance_chain:
license:
quality_scores:
  reliability:
  directness:
  independence:
  timeliness:
  revision_risk:
uncertainty_or_range:
transformation_lineage:
contradicts:
corroborates:
```

#### Regra “as-of date / no future leakage”

Para simular uma previsão feita em `t₀`, só é permitido usar itens com:

\[
release\_time(e) \leq t_0
\]

na versão efetivamente disponível em `t₀`. Dados revisados posteriormente não podem substituir a vintage histórica. A avaliação deve congelar:

- snapshot de dados;
- versão de documentos;
- versão do modelo e prompt;
- transformação e features;
- parâmetros, seed e dependências;
- fonte de resolução definida ex ante.

Croushore e Stark mostram que usar dados revisados pode alterar previsões e produzir erros retrospectivamente menores; ALFRED existe precisamente para recuperar vintages históricas. Para notícias e documentos, o equivalente é arquivar publicação, atualização e captura, preservando o texto observado na época.

#### Política de fonte

1. fontes primárias oficiais e registros transacionais quando apropriados;
2. fontes independentes para triangulação;
3. mídia e relatórios especializados com histórico de correções;
4. sensores, satélite e dados de mercado com metodologia conhecida;
5. redes sociais apenas como sinal ruidoso, sujeito a bot, censura, seleção e manipulação;
6. conteúdo gerado por IA nunca conta como evidência independente.

Pontuações de qualidade não devem ser convertidas mecanicamente em “verdade”. Elas modulam o modelo de mensuração e a variância observacional.

### 3.3 Causal DAG e Structural Causal Model

O grafo causal é um artefato versionado, revisado por domínio e temporalmente orientado. Para cada variável `Xj`:

\[
X_{j,t+1}=f_j(PA_{j,t}, A_t, U_{j,t};\theta_j)
\]

- `PAj,t`: pais causais no DAG;
- `At`: ações/intervenções;
- `Uj,t`: fatores não observados e choques;
- `θj`: parâmetros.

A intervenção não é “observar A=a”. Em um SCM, ela substitui a equação de `A`:

\[
p(Y\mid do(A=a)) \neq p(Y\mid A=a)
\]

em geral. Toda afirmação causal deve documentar:

- estimando: ATE, CATE, efeito dinâmico, efeito direto/total;
- conjunto de ajuste e justificativa pelo DAG;
- confundidores, mediadores, colliders e seleção;
- interferência entre unidades e spillovers;
- positividade/overlap;
- consistência e versão do tratamento;
- estratégia de identificação;
- testes de falsificação e limites de transportabilidade.

#### Escala de força causal

- **C0 — associação:** correlação, Granger-causality ou padrão descritivo;
- **C1 — mecanismo plausível:** DAG e teoria, sem identificação empírica forte;
- **C2 — quase-experimento:** IV, diff-in-diff, synthetic control, RDD etc., com diagnósticos;
- **C3 — evidência robusta convergente:** múltiplos desenhos, dados e contextos;
- **C4 — intervenção experimental:** rara em geopolítica/macroeconomia e ainda limitada por validade externa.

O produto nunca deve renomear C0 como “causa”. O DAG disciplina hipóteses; não prova que estejam corretas.

### 3.4 Atualização Bayesiana e estado latente

Para parâmetro `θ` e dados `D`:

\[
p(\theta\mid D)=\frac{p(D\mid\theta)p(\theta)}{p(D)}
\]

A distribuição posterior alimenta a posterior preditiva:

\[
p(\tilde y\mid D)=\int p(\tilde y\mid\theta)p(\theta\mid D)d\theta
\]

Priors devem ter origem registrada: literatura, classe de referência, elicitação de especialistas ou regularização fraca. Executar prior-predictive checks, posterior-predictive checks e análise de sensibilidade a priors. Um consenso de agentes derivados do mesmo LLM não é múltipla evidência: há dependência compartilhada e ela deve ser modelada.

#### Modelo de espaço de estados

\[
X_t\sim p(X_t\mid X_{t-1},Z_t,A_{t-1},\theta), \qquad
Y_t\sim p(Y_t\mid X_t,\phi)
\]

Recursão de filtragem:

\[
p(X_t\mid Y_{1:t-1})=\int p(X_t\mid X_{t-1})p(X_{t-1}\mid Y_{1:t-1})dX_{t-1}
\]

\[
p(X_t\mid Y_{1:t})\propto p(Y_t\mid X_t)p(X_t\mid Y_{1:t-1})
\]

- **Kalman:** apenas quando aproximação linear-Gaussiana é defensável;
- **HMM:** regimes discretos e transições Markovianas;
- **Markov-switching:** parâmetros mudam com regime latente;
- **particle filter/SMC:** dinâmica não linear ou não Gaussiana; atualizar pesos pela verossimilhança e reamostrar quando houver degeneração.

Com pesos normalizados `wᵢ`:

\[
ESS=\frac{1}{\sum_i (w_i)^2}
\]

O limiar de reamostragem, número de partículas, algoritmo e erro de Monte Carlo devem ser monitorados. Regime é uma hipótese latente, não um rótulo factual; reportar `p(Zt=k|D)`.

### 3.5 Portfólio de modelos, não monocultura

#### Baselines obrigatórios

- persistência/no change;
- random walk para preços quando aplicável;
- tendência simples e sazonal ingênua;
- taxa histórica por classe de referência;
- consenso externo disponível na data;
- “nenhuma habilidade além da base rate”.

Um modelo complexo só entra se superar baselines fora da amostra e agregar informação ou explicação útil.

#### VAR/BVAR/VECM/SVAR — quando cabível

VAR de ordem `p`:

\[
y_t=c+\sum_{\ell=1}^{p}A_{\ell}y_{t-\ell}+u_t
\]

Usar quando houver séries regulares, número controlado de variáveis, história suficiente e dinâmica aproximadamente estável. Aplicar transformações, testes de raiz unitária/cointegração e diagnósticos de resíduos. BVAR/regularização ajuda em alta dimensionalidade moderada; VECM é preferível quando relações cointegrantes são defensáveis; fatores dinâmicos atendem painéis maiores e frequências mistas.

SVAR exige restrições de identificação externas aos dados:

\[
B_0y_t=c+\sum_{\ell=1}^{p}B_{\ell}y_{t-\ell}+\varepsilon_t,
\qquad E(\varepsilon_t\varepsilon_t')=I
\]

Restrições de curto/longo prazo, sinais, heterocedasticidade ou instrumentos externos devem ser justificadas institucionalmente e testadas. Ordenar variáveis por Cholesky não é uma descoberta causal. VAR é excelente candidato para previsão/impulso descritivo; SVAR só recebe interpretação causal se sua identificação sobreviver a alternativas.

#### ABM — modelagem baseada em agentes

ABM é indicado quando heterogeneidade, redes, adaptação, expectativas, feedback e emergências são centrais. Cada agente formal deve conter:

- objetivos/utility múltiplos e possivelmente conflitantes;
- restrições materiais e informacionais;
- belief state parcial;
- repertório de ações;
- política de escolha com racionalidade limitada;
- memória e aprendizado;
- relações de rede;
- parâmetros calibrados ou distribuídos;
- regras de entrada, saída e coalizão.

A dinâmica geral:

\[
S_{t+1}=T(S_t,A_t,E_{t+1};\theta,M)
\]

A “equipe adaptativa de agentes” do produto tem duas camadas que não devem ser confundidas:

1. **agentes analíticos LLM:** geram hipóteses, criticam, recuperam evidência e explicam;
2. **agentes do mundo simulado:** regras formais, estados e políticas executáveis.

Diálogo livre entre LLMs não é uma simulação científica. Toda ação que altera o world state passa por transição formal, com parâmetros e distribuição auditáveis. Documentar o ABM no protocolo **ODD — Overview, Design concepts, Details** e validar padrões micro e macro, não apenas histórias plausíveis.

#### Ensemble

Combinar modelos com pesos derivados apenas de desempenho out-of-sample, Bayesian model averaging ou stacking. Preservar dependência entre modelos; dezenas de variantes do mesmo backbone não equivalem a dezenas de visões independentes. Mostrar:

- mediana/quantis do ensemble;
- dispersão dentro de cada modelo;
- dispersão entre modelos;
- contribuição de cada modelo;
- desempenho histórico por regime e horizonte.

### 3.6 Monte Carlo: distribuição de trajetórias

Cada replicação deve sortear conjuntamente:

1. estado inicial latente;
2. erro de mensuração;
3. parâmetros;
4. modelo/estrutura;
5. regime;
6. choques correlacionados;
7. políticas dos agentes;
8. premissas de cenário, se probabilizadas.

Estimador de expectativa:

\[
\hat\mu_N=\frac{1}{N}\sum_{n=1}^{N}g(Y^{(n)}), \qquad
MCSE(\hat\mu_N)\approx\frac{s_g}{\sqrt N}
\]

Para probabilidade binária independente:

\[
MCSE(\hat p)\approx\sqrt{\frac{\hat p(1-\hat p)}{N}}
\]

O número de replicações não deve ser um valor decorativo. Parar quando MCSE e estabilidade de quantis críticos atingirem tolerância pré-especificada. Como o erro cai em `1/√N`, reduzir MCSE pela metade requer aproximadamente quatro vezes mais amostras.

Requisitos:

- seeds registradas e replicações independentes;
- matriz de correlação/copula documentada para choques dependentes;
- amostragem estratificada, Latin hypercube, quasi-Monte Carlo ou control variates quando adequados;
- importance sampling/splitting para eventos raros, com correção de pesos;
- diagnósticos de cauda, tamanho efetivo e convergência;
- não usar uma distribuição normal por conveniência quando dados mostram assimetria, caudas grossas ou limites físicos;
- separar erro numérico Monte Carlo de incerteza sobre o mundo.

### 3.7 MCTS para decisões sequenciais sob incerteza

MCTS não aumenta a veracidade do modelo de mundo. Ele explora melhor uma árvore **dada** uma dinâmica e uma função de valor. Portanto, deve ser rotulado como motor de decisão, não motor de evidência.

Em ambiente parcialmente observável, operar sobre belief state `bₜ=P(Sₜ|história)`. Ciclo:

1. seleção;
2. expansão;
3. simulação/rollout;
4. retropropagação.

UCT típico para filho `j`:

\[
UCT_j=\bar Q_j+c\sqrt{\frac{\ln N_{pai}}{N_j}}
\]

O primeiro termo explora valor estimado; o segundo favorece alternativas pouco visitadas. Para geopolítica e mercados:

- chance nodes representam choques;
- opponent modeling mantém múltiplos modelos de outros atores;
- progressive widening limita branching factor;
- ações irreversíveis recebem maior exigência de evidência;
- recompensas incluem múltiplos objetivos, externalidades e restrições;
- avaliar robustez a funções de utilidade alternativas;
- usar medidas sensíveis à cauda, como `CVaRα`, quando perdas extremas importam;
- retornar fronteira de políticas robustas, não uma “jogada ótima” singular.

Para perda contínua `L`, em caso regular:

\[
CVaR_{\alpha}(L)=E[L\mid L\ge VaR_{\alpha}(L)]
\]

Uma política só é recomendável no interior do simulador se permanecer aceitável sob modelos, priors, regimes e parâmetros adversos plausíveis. Desempenho em rollouts não é evidência de eficácia no mundo real.

### 3.8 Cenários

Manter uma **scenario lattice** com quatro classes:

- referência/base rate;
- alternativas condicionais por mecanismos;
- stress scenarios severos mas plausíveis;
- wildcards de baixa probabilidade/alto impacto.

Cada cenário contém condições iniciais, intervenções, choques, mecanismo narrativo, indicadores precursores, pontos de bifurcação e critérios de invalidação. O sistema deve distinguir:

- **forecast:** distribuição com probabilidade avaliável;
- **conditional forecast:** “se X, então distribuição Y”;
- **scenario:** futuro internamente coerente, nem sempre probabilizável;
- **stress test:** condição deliberadamente extrema;
- **speculation:** hipótese ainda sem suporte suficiente.

Não forçar soma de probabilidades para cenários não exaustivos ou não mutuamente exclusivos. Quando probabilidades forem indefensáveis, reportar possibilidade, plausibilidade e consequências sem falsa precisão.

### 3.9 Decomposição de incerteza

Pela lei da variância total, para modelo `M` e parâmetros `θ`:

\[
Var(Y\mid D)=
E_{M,\theta}[Var(Y\mid M,\theta,D)]
+Var_{M,\theta}(E[Y\mid M,\theta,D])
\]

O primeiro termo captura variabilidade condicional/aleatória; o segundo, desacordo devido a parâmetros e estrutura. A decomposição operacional terá:

| Componente | Exemplo | Redutível? |
|---|---|---|
| Aleatória/aleatória condicional | sorte, choque, heterogeneidade | em geral não |
| Mensuração/dados | revisão, cobertura, erro de fonte | parcialmente |
| Parâmetros | elasticidades, transições | com dados melhores |
| Estado latente | regime, intenção, prontidão | parcialmente |
| Estrutural/modelo | DAG, equações, política de agente | por comparação/modelagem |
| Cenário | premissa externa | não dentro do cenário |
| Reflexiva/estratégica | atores reagem à previsão | limitada |
| Computacional | partículas/Monte Carlo | sim, com computação |

A dicotomia aleatória (aleatoric) versus epistêmica é útil, mas insuficiente; a incerteza epistêmica deve ser aberta em dados, parâmetro, estado e estrutura. Interações impedem uma soma ingênua. Estimar contribuições com desenhos fatoriais aninhados, Sobol/ANOVA funcional ou variance components.

Índices de Sobol:

\[
S_i=\frac{Var_{X_i}(E[Y\mid X_i])}{Var(Y)}, \qquad
S_{T_i}=\frac{E_{X_{-i}}(Var[Y\mid X_{-i}])}{Var(Y)}
\]

Na interface, mostrar intervalos/quantis, dispersão entre modelos, risco de extrapolação, top drivers e uma categoria **unknown/abstain**. “Confiança” não deve ser um único score opaco.

---

## 4. Limitações, ressalvas e segurança

### 4.1 Limites epistemológicos

1. **Não estacionariedade:** guerras, pandemias, inovação e mudanças de regime quebram relações históricas.
2. **Reflexividade/Lucas critique:** políticas e agentes mudam ao antecipar a regra ou a própria previsão.
3. **Goodhart:** quando um indicador vira alvo, perde qualidade como medida.
4. **Choques fora do suporte:** Monte Carlo só sorteia o que foi colocado no modelo; não inventa unknown unknowns.
5. **Identificação parcial:** vários SCMs podem explicar os mesmos dados observacionais e divergir sob intervenção.
6. **Dados estratégicos:** propaganda, censura, atraso e decepção tornam missingness informativo e adversarial.
7. **Caudas escassas:** eventos raros fornecem poucos exemplos; estimativas extremas são frágeis.
8. **Agência humana:** preferências, coalizões e erros não são leis físicas estáveis.
9. **Horizonte:** incerteza e dependência estrutural geralmente crescem com `h`; precisão aparente de longo prazo deve diminuir, não aumentar.
10. **Narrative fallacy:** uma trajetória coerente pode ser apenas uma história plausível.
11. **Valores:** otimizar uma função de recompensa não resolve conflitos éticos ou distributivos.
12. **Segredo e privacidade:** variáveis decisivas podem ser legitimamente indisponíveis.

#### Regra de abstenção

O sistema deve responder “não estimável com confiabilidade” quando houver, por exemplo:

- evento sem regra de resolução;
- extrapolação muito além do suporte;
- evidência insuficiente ou altamente contraditória;
- identificação causal inexistente para uma pergunta causal;
- instabilidade severa entre modelos;
- falha de calibração naquele domínio/horizonte;
- risco de uso materialmente perigoso.

### 4.2 Segurança específica para previsões financeiras

No PRD, o módulo financeiro deve nascer como **ferramenta educacional e de pesquisa**, sem execução automática e sem linguagem de garantia. Controles mínimos:

1. nenhum “compre/venda agora” personalizado sem enquadramento jurídico, suitability e profissional autorizado;
2. nenhuma integração de execução na versão inicial;
3. projeções sempre identificadas como hipotéticas, não garantia de resultados futuros;
4. metodologia, limitações, universo de ativos, conflitos e pressupostos em linguagem clara;
5. data/hora, mercado, moeda, latência e qualidade da cotação visíveis;
6. apresentar perdas, drawdown, iliquidez, gap risk, volatilidade, correlação instável e perda total — não apenas retorno esperado;
7. backtests com custos, spread, slippage, impostos quando aplicável, survivorship bias, delistings e dados point-in-time;
8. vedar cherry-picking de janela, ativo, métrica ou cenário;
9. revisão humana e compliance para saídas de alto impacto;
10. logs imutáveis de input, output, modelo e divulgação mostrada;
11. detecção de conflito de interesse, promoção paga e favorecimento de ativos;
12. controles contra manipulação de mercado, informação privilegiada e extração de dados não autorizada;
13. limites de perda e alertas de alavancagem apenas como educação, não como promessa de proteção;
14. monitoramento de drift e kill switch do módulo quando calibração/qualidade falhar;
15. revisão jurídica por jurisdição antes de disponibilização pública.

Como referência regulatória ilustrativa — não parecer jurídico — a FINRA Rule 2214 exige que ferramentas de análise de investimento descrevam metodologia, limitações e premissas, expliquem variabilidade e indiquem que projeções são hipotéticas e não garantias. A FINRA Notice 24-09 reafirma que obrigações existentes continuam aplicáveis ao uso de GenAI. O Federal Reserve/OCC SR 11-7 destaca validação independente, governança e “effective challenge” para risco de modelo.

### 4.3 Segurança geopolítica

- trabalhar com indicadores agregados e fontes públicas/licenciadas;
- não converter a plataforma em sistema de targeting, sabotagem, evasão de sanções ou instrução operacional de violência;
- revisar saídas que possam expor populações vulneráveis, infraestrutura crítica ou informação pessoal;
- manter objetivos humanos e restrições de direitos, não apenas utilidade estatal;
- registrar quem solicitou, finalidade e nível de sensibilidade para análises de alto risco.

---

## 5. Questões abertas prioritárias

1. **Qual é a ontologia mínima do world state que funciona em geopolítica, recursos e finanças sem produzir um modelo universal incoerente?**
   Importa porque a ontologia define o que pode ser medido, relacionado e validado.

2. **Quais alvos possuem histórico point-in-time e regra de resolução suficientes para um benchmark honesto?**
   Sem isso, a promessa científica não pode ser testada.

3. **Como estimar dependência entre agentes, modelos e fontes que compartilham a mesma informação?**
   Tratar cópias como independentes produz confiança excessiva.

4. **Quais intervenções são realmente identificáveis, em vez de apenas simuláveis?**
   Uma política pode ser fácil de colocar no SCM e impossível de validar causalmente.

5. **Quais limites de abstenção e calibração impedem o produto de exibir falsa precisão?**
   A segurança depende mais de saber quando não prever do que de gerar mais narrativas.

6. **Como medir utilidade decisória sem recompensar retroativamente uma história conveniente?**
   É necessário separar qualidade probabilística, valor da decisão e sorte realizada.

7. **Qual regime jurídico se aplica ao módulo financeiro em cada mercado e interface?**
   Disclaimer não substitui registro, suitability, supervisão ou regras de comunicação.

---

## 6. Hipóteses causais e testáveis para o próprio produto

### H1 — Ledger point-in-time reduz desempenho inflado por leakage

- **Hipótese:** backtests com vintages e releases disponíveis na data produzirão scores piores, porém mais representativos, que backtests com dados finais.
- **Confirmatória:** diferença sistemática em Brier/log score/RMSE entre pipelines vintage e latest-available.
- **Refutatória:** diferença negligenciável e estável em múltiplos domínios e períodos.
- **Impacto:** alto.

### H2 — Ensemble causal-dinâmico melhora calibração, não necessariamente acurácia pontual

- **Hipótese:** ensemble de baseline, séries, estado/regime e ABM reduz log score/CRPS e melhora cobertura contra cada modelo isolado.
- **Confirmatória:** ganho out-of-sample consistente e menor miscalibration, com DM tests/intervalos por bootstrap quando cabíveis.
- **Refutatória:** pesos colapsam em um baseline ou ganho desaparece após correção por seleção.
- **Impacto:** alto.

### H3 — Agentes LLM livres aumentam plausibilidade narrativa sem skill preditivo

- **Hipótese:** remover a camada conversacional pouco altera ou melhora scores, embora reduza avaliação humana de “riqueza”.
- **Confirmatória:** ablation mantém Brier/log score e diminui contradições/falsa causalidade.
- **Refutatória:** ganho replicável em forecasting sob informação congelada.
- **Impacto:** alto.

### H4 — Regime switching melhora horizontes curtos durante transições

- **Hipótese:** HMM/Markov-switching supera modelo de regime único em crises e mudanças de volatilidade.
- **Confirmatória:** melhores scores em janelas de transição sem degradar excessivamente períodos normais.
- **Refutatória:** regimes instáveis, não interpretáveis ou sem ganho OOS.
- **Impacto:** médio.

### H5 — Decisões robustas são menos sensíveis ao erro estrutural que decisões de máximo valor esperado

- **Hipótese:** políticas escolhidas por minimax regret/CVaR mantêm utilidade aceitável em mais modelos e stresses que a política de maior média.
- **Confirmatória:** menor regret e menor perda de cauda em holdouts e modelos alternativos.
- **Refutatória:** conservadorismo elimina valor sem reduzir falhas críticas.
- **Impacto:** alto.

---

## 7. Validação, calibração e roteiro de aprovação

### 7.1 Protocolo de backtesting

Usar **rolling-origin/prequential evaluation**. Em cada origem `t₀`:

1. reconstruir `D≤t₀` com vintages;
2. treinar/atualizar apenas com passado admissível;
3. congelar previsão, intervalo, evidência e versão;
4. avançar para a próxima origem segundo calendário pré-definido;
5. resolver usando regra e fonte definidas ex ante;
6. calcular métricas por horizonte, domínio, regime e severidade;
7. só depois permitir atualização do modelo.

Ter três conjuntos temporais:

- **development:** desenho e treinamento;
- **validation:** seleção/hiperparâmetros/calibração;
- **locked test:** avaliação final, tocado uma única vez por versão maior.

Adicionar holdouts geográficos, crises e períodos tranquilos. Avaliar contra baselines e consenso disponível na época. Manter um **shadow mode** antes de liberar decisões ao usuário.

### 7.2 Scoring rules e diagnósticos

Para evento binário `y∈{0,1}` e probabilidade `p`:

\[
Brier=\frac1T\sum_{t=1}^T(p_t-y_t)^2
\]

\[
LogLoss=-\frac1T\sum_{t=1}^T[y_t\log p_t+(1-y_t)\log(1-p_t)]
\]

Aplicar clipping operacional apenas para estabilidade numérica e declarar o `ε`; não usar clipping para esconder excesso de confiança. Brier privilegia erro quadrático; log score pune fortemente probabilidade quase zero no evento ocorrido.

Skill relativo ao baseline:

\[
BSS=1-\frac{Brier_{modelo}}{Brier_{referência}}
\]

Para CDF preditiva `F` e observação `y`:

\[
CRPS(F,y)=\int_{-\infty}^{\infty}[F(z)-\mathbf1\{y\le z\}]^2dz
\]

Para intervalo `[l,u]` de cobertura `1-α`:

\[
IS_\alpha=(u-l)+\frac{2}{\alpha}(l-y)\mathbf1\{y<l\}
+\frac{2}{\alpha}(y-u)\mathbf1\{y>u\}
\]

Relatar também MAE/RMSE para pontos, mas não substituir avaliação distribucional. Para múltiplas variáveis, usar energy score com cautela e métricas marginais/conjuntas.

#### Calibração

Calibração binária ideal:

\[
E[Y\mid \hat p=p]=p
\]

Construir reliability diagrams com binning e intervalos, calibration intercept/slope, ECE apenas como resumo secundário e decomposição de Brier em confiabilidade, resolução e incerteza. Para distribuições contínuas, usar PIT/rank histograms, cobertura empírica e largura de intervalos. O princípio é **maximizar sharpness sujeito à calibração**, conforme Gneiting, Balabdaoui e Raftery.

Avaliar calibração condicional por:

- horizonte;
- país/região;
- regime normal/crise;
- tipo de evento e base rate;
- qualidade dos dados;
- faixa de probabilidade;
- versão do modelo.

Boa calibração média pode ocultar falhas graves em subgrupos. AUC/discriminação não mede calibração e não é suficiente.

### 7.3 Validação causal

- revisão do DAG por especialistas independentes;
- balance/overlap e diagnósticos de pesos;
- testes de pré-tendência quando aplicáveis;
- placebos temporais e geográficos;
- negative controls;
- especificações e janelas alternativas;
- partial identification/sensitivity a confundimento não observado;
- heterogeneidade e transportabilidade;
- invariância dos mecanismos sob ambiente, quando testável.

Uma simulação contrafactual não validada deve ser rotulada “model-based counterfactual”, nunca efeito causal observado.

### 7.4 Validação de ABM e MCTS

ABM:

- ODD completo e reimplementável;
- unit tests de regras e invariantes;
- pattern-oriented validation em múltiplos níveis;
- calibração em um período e validação em outro;
- comparação de distribuições, redes, duração e eventos extremos;
- análise de equifinalidade: múltiplos parâmetros podem reproduzir o mesmo padrão;
- face validation sem tratá-la como evidência suficiente;
- replicação independente e seeds múltiplas.

MCTS:

- convergência de valor/visitas com orçamento crescente;
- estabilidade a `c`, rollout policy, profundidade e progressive widening;
- benchmark contra políticas simples;
- regret no simulador e robustez entre simuladores;
- testes adversariais de reward hacking;
- avaliação de cauda e restrições duras;
- afirmar explicitamente que validação no simulador não valida o mundo.

### 7.5 Ablation, sensibilidade e stress

**Ablations:** retirar textos, agentes LLM, DAG, regime, ABM, MCTS, dados alternativos e módulos de ensemble. Medir ganho incremental out-of-sample.

**Sensibilidade local/global:** elasticidades, Morris screening, Sobol primeira ordem/total, priors e especificações. Mostrar tornado plots e interações.

**Stress tests:**

- correlações convergem para 1 em crise;
- liquidez evapora e spreads ampliam;
- fonte-chave fica indisponível ou é manipulada;
- revisão macroeconômica extrema;
- mudança de regime não vista;
- coalizão ou política de ator muda abruptamente;
- choque simultâneo de energia, clima e crédito;
- misspecification deliberada de DAG;
- distribuição heavy-tail em vez de Gaussiana;
- atraso de dados e relógios inconsistentes.

**Metamorphic/invariance tests:** unidades, moedas, permutação de IDs, duplicação de fonte, pequenas perturbações e conservação física/contábil. Duplicar uma notícia não pode duplicar a evidência; trocar unidade não pode alterar conclusão econômica.

### 7.6 Gates de aceitação para MVP científico

1. zero violações conhecidas de as-of date no suite de auditoria;
2. forecast contracts e resolução ex ante para 100% dos alvos avaliados;
3. desempenho superior a ao menos um baseline relevante em score próprio, com incerteza;
4. cobertura e calibração reportadas por horizonte/subgrupo, sem esconder falhas;
5. MCSE abaixo da tolerância especificada para outputs exibidos;
6. incerteza estrutural e entre modelos visível;
7. ODD, model cards, data sheets e evidence lineage completos;
8. revisão independente/effective challenge;
9. stress, ablation e sensibilidade concluídos;
10. abstenção e kill switch funcionais;
11. módulo financeiro sem execução e aprovado por jurídico/compliance local;
12. claims de marketing limitados ao que o locked test demonstrou.

Não impor um único limiar universal de Brier ou cobertura: os thresholds devem ser pré-registrados por domínio, horizonte, base rate e custo do erro.

### 7.7 Roteiro em três horizontes

#### Curto prazo — PRD e benchmark científico

- escolher 20–50 alvos resolvíveis e dois domínios-piloto;
- definir ontologia mínima, forecast contracts e evidence ledger;
- construir dataset point-in-time;
- implementar conceitualmente baselines, scoring e protocolo prequential;
- produzir DAGs pequenos e auditáveis;
- escrever ODD do primeiro ABM;
- definir taxonomy de incerteza, abstenção e financial safety;
- pré-registrar métricas e gates.

#### Médio prazo — protótipo controlado

- state-space/HMM/particle filter;
- BVAR/VECM ou modelo alternativo apenas onde diagnóstico autorizar;
- ABM formal e ensemble;
- Monte Carlo com MCSE;
- MCTS em sandbox;
- shadow forecasting por ciclos suficientes;
- calibração, ablations, stresses e revisão independente.

#### Longo prazo — operação governada

- model registry e versionamento integral;
- monitoramento de drift/calibração;
- incident response e rollback;
- auditoria periódica e red team;
- publicação de relatório de desempenho, inclusive falhas;
- expansão de domínio apenas após benchmark local;
- conselho científico/ético e revisão regulatória contínua.

**Ação única mais importante agora:** construir o benchmark point-in-time com perguntas resolvíveis e previsões congeladas. Sem ele, qualquer discussão sobre agentes, MCTS ou sofisticação é impossível de distinguir de storytelling.

---

## 8. Significado translacional

A vantagem defensável do GeniusAI Foresight não será “ver mais longe”, mas **tornar auditável a cadeia que liga evidência, hipótese causal, estado latente, simulação, decisão e erro posterior**. Isso converte uma demo de agentes em infraestrutura de raciocínio científico.

A implicação contraintuitiva é que um produto confiável deve frequentemente parecer menos impressionante: intervalos largos, modelos em desacordo, previsões condicionais e abstenções. Essa contenção é sinal de maturidade, não falha de UX.

### Saída recomendada ao usuário

Cada tela de previsão deve conter:

1. pergunta e data de corte;
2. probabilidade/quantis e horizonte;
3. base rate e baseline;
4. três a cinco drivers com status causal;
5. dispersão dentro/entre modelos;
6. condições de cenário;
7. evidências principais e contraditórias;
8. indicadores que fariam a previsão mudar;
9. histórico de calibração daquele domínio/horizonte;
10. limites, abstention flag e aviso de uso;
11. árvore/graph de relações como hipótese, não mapa da verdade;
12. para decisões, alternativas robustas, trade-offs e perdas de cauda — nunca certeza de ótimo.

---

# Referências verificáveis

1. **Pearl, J.** *Causality: Models, Reasoning, and Inference*, 2ª ed. Cambridge University Press. Estrutura causal, intervenções e contrafactuais. https://www.cambridge.org/core/books/causality/B0046844FAE10CBF274D4ACBDAEB5F5B
2. **Croushore, D.; Stark, T.** “A Real-Time Data Set for Macroeconomists: Does Data Vintage Matter for Forecasting?” Federal Reserve Bank of Philadelphia. Dados em tempo real e revisões. https://doi.org/10.21799/frbp.wp.2000.06
3. **Federal Reserve Bank of St. Louis.** ALFRED Help. Vintages e release dates. https://alfred.stlouisfed.org/help
4. **Doucet, A.; Johansen, A. M.** “A Tutorial on Particle Filtering and Smoothing: Fifteen Years Later.” Filtragem Bayesiana/SMC. https://www.stats.ox.ac.uk/~doucet/doucet_johansen_tutorialPF2011.pdf
5. **Hamilton, J. D.** “A New Approach to the Economic Analysis of Nonstationary Time Series and the Business Cycle.” *Econometrica* 57(2), 1989. Regime switching. https://doi.org/10.2307/1912559
6. **Sims, C. A.** “Macroeconomics and Reality.” *Econometrica* 48(1), 1980. VAR. https://doi.org/10.2307/1912017
7. **Stock, J. H.; Watson, M. W.** “Dynamic Factor Models, Factor-Augmented VARs, and SVARs in Macroeconomics.” Identificação e riscos em SVAR. https://www.princeton.edu/~mwatson/papers/Stock_Watson_HOM_Vol2.pdf
8. **Grimm, V. et al.** “The ODD Protocol for Describing Agent-Based and Other Simulation Models.” *JASSS* 23(2), 2020. https://doi.org/10.18564/jasss.4259
9. **Browne, C. B. et al.** “A Survey of Monte Carlo Tree Search Methods.” *IEEE Transactions on Computational Intelligence and AI in Games* 4(1), 2012. https://doi.org/10.1109/TCIAIG.2012.2186810
10. **Gneiting, T.; Balabdaoui, F.; Raftery, A. E.** “Probabilistic Forecasts, Calibration and Sharpness.” *JRSS B* 69(2), 2007. https://doi.org/10.1111/j.1467-9868.2007.00587.x
11. **Gneiting, T.; Raftery, A. E.** “Strictly Proper Scoring Rules, Prediction, and Estimation.” *JASA* 102(477), 2007. https://doi.org/10.1198/016214506000001437
12. **Hewamalage, H.; Ackermann, K.; Bergmeir, C.** “Forecast Evaluation for Data Scientists: Common Pitfalls and Best Practices.” *Data Mining and Knowledge Discovery*, 2023. Rolling-origin e avaliação. https://pmc.ncbi.nlm.nih.gov/articles/PMC9718476/
13. **Depeweg, S. et al.** “Decomposition of Uncertainty in Bayesian Deep Learning for Efficient and Risk-sensitive Learning.” *PMLR 80*, 2018. Lei de variância total e componentes epistêmica/aleatória. https://proceedings.mlr.press/v80/depeweg18a.html
14. **Kroese, D. P. et al.** “Why the Monte Carlo Method Is So Important Today.” *WIREs Computational Statistics* 6(6), 2014. https://doi.org/10.1002/wics.1314
15. **Federal Reserve/OCC.** SR 11-7, *Guidance on Model Risk Management*, 2011. Validação, governança e effective challenge. https://www.federalreserve.gov/boarddocs/srletters/2011/sr1107.pdf
16. **FINRA.** Rule 2214, Requirements for the Use of Investment Analysis Tools. Divulgações e caráter hipotético. https://www.finra.org/rules-guidance/rulebooks/finra-rules/2214
17. **FINRA.** Regulatory Notice 24-09, 2024. Obrigações no uso de GenAI. https://www.finra.org/rules-guidance/notices/24-09
18. **NIST.** *AI Risk Management Framework 1.0*. Governança, medição e gestão de risco de IA. https://doi.org/10.6028/NIST.AI.100-1
19. **Saltelli, A. et al.** “Variance Based Sensitivity Analysis of Model Output: Design and Estimator for the Total Sensitivity Index.” *Computer Physics Communications* 181(2), 2010. Índices de sensibilidade global. https://doi.org/10.1016/j.cpc.2009.09.018

---

## Síntese executiva final

O desenho recomendado é híbrido e falsificável: ledger point-in-time, estado probabilístico, DAG/SCM, filtros Bayesianos e regimes, econometria quando suas premissas cabem, ABM formal para interações, Monte Carlo para distribuições e MCTS apenas para busca decisória. O critério de sucesso não é uma narrativa convincente, mas ganho fora da amostra em scoring rules próprias, calibração condicional, robustez e transparência de incerteza. Para finanças, o MVP deve ser educacional, hipotético, sem execução e sujeito a governança, revisão humana e jurídica. O limite mais importante permanece estrutural: o sistema só pode explorar futuros representados por seus dados, cenários e modelos; portanto, deve saber declarar desacordo, extrapolação e ignorância.
