# GeniusAI Foresight — Núcleo Matemático de Teoria dos Jogos

**Versão:** 1.0.0
**Status:** especificação científica aprovada para implementação
**Escopo:** decisões estratégicas entre países, instituições, mercados, coalizões e atores não estatais

## 1. Princípio metodológico

O GeniusAI Foresight não pressupõe que governos, empresas ou mercados sejam perfeitamente racionais. Cada estudo deve declarar qual modelo estratégico está usando, quais informações cada ator possui, como suas preferências foram estimadas e quais conclusões permanecem válidas sob modelos alternativos.

A Teoria dos Jogos entra em quatro funções diferentes:

1. **representação:** formalizar atores, ações, informação, utilidades, compromissos e sequência temporal;
2. **solução:** localizar equilíbrios, melhores respostas, coalizões ou políticas robustas;
3. **simulação:** gerar trajetórias sob racionalidade perfeita, limitada, adaptativa e aprendida;
4. **auditoria:** medir exploração, arrependimento, estabilidade, sensibilidade e distância do equilíbrio.

Nenhum equilíbrio é tratado automaticamente como previsão. Um conceito de solução é uma hipótese sobre comportamento sob premissas explícitas.

---

## 2. Forma estratégica e utilidade esperada

Um jogo normal finito é:

\[
G=\langle N,(A_i)_{i\in N},(u_i)_{i\in N}\rangle
\]

onde `N` é o conjunto de atores, `A_i` o conjunto de ações do ator `i` e `u_i(a)` sua utilidade para o perfil conjunto `a=(a_1,\ldots,a_n)`.

Uma estratégia mista `\sigma_i\in\Delta(A_i)` atribui probabilidades às ações. A utilidade esperada é:

\[
U_i(\sigma)=\sum_{a\in A}\left(\prod_j \sigma_j(a_j)\right)u_i(a)
\]

### Requisitos de implementação

- matrizes e tensores de payoff com validação dimensional;
- melhores respostas puras e mistas;
- eliminação iterada de estratégias estritamente dominadas;
- eficiência de Pareto;
- níveis de segurança maximin e minimax;
- preço da anarquia e preço da estabilidade quando houver função de bem-estar;
- normalização de utilidades sem confundir escalas ordinais e cardinais;
- análise de sensibilidade dos payoffs.

### Limite

Payoffs geopolíticos raramente são observados diretamente. O sistema deve guardar intervalos/distribuições e executar análise de robustez, nunca esconder a incerteza em um único número.

---

## 3. Equilíbrio de Nash e refinamentos

Um perfil `\sigma^*` é equilíbrio de Nash quando:

\[
U_i(\sigma_i^*,\sigma_{-i}^*)\geq U_i(\sigma_i,\sigma_{-i}^*)
\quad \forall i,\forall \sigma_i
\]

### Módulos

- detecção de equilíbrios puros por enumeração;
- solução analítica de jogos `2×2` não degenerados;
- aproximação numérica por fictitious play e regret matching;
- verificação de `\varepsilon`-Nash:

\[
\epsilon(\sigma)=\max_i\left[\max_{a_i}U_i(a_i,\sigma_{-i})-U_i(\sigma)\right]
\]

- classificação de múltiplos equilíbrios por payoff, risco e dominância;
- refinamentos em jogos extensivos: equilíbrio perfeito em subjogos, trembling-hand perfect e equilíbrio sequencial quando o domínio permitir.

### Regra de produto

A UI nunca exibirá “o equilíbrio” sem informar:

- conceito de solução;
- quantidade de equilíbrios encontrados;
- método/erro numérico;
- sensibilidade a payoffs;
- premissas de informação e racionalidade.

---

## 4. Jogos de soma zero, segurança e robustez

Para dois jogadores de soma zero com matriz `A`, o valor é:

\[
v=\max_{x\in\Delta_m}\min_{y\in\Delta_n}x^TAy
 =\min_{y\in\Delta_n}\max_{x\in\Delta_m}x^TAy
\]

O solver deverá oferecer:

- maximin/minimax;
- estratégias de segurança;
- exploitability;
- solução por programação linear quando backend compatível estiver disponível;
- fallback enumerativo para jogos pequenos;
- robust optimization com payoffs intervalares;
- minimax regret:

\[
a^*=\arg\min_a\max_{\theta\in\Theta}
\left[\max_{a'}U(a',\theta)-U(a,\theta)\right]
\]

Isso é útil para dissuasão, proteção de infraestrutura, segurança energética e decisões sob adversário estratégico, mas jogos geopolíticos reais não devem ser reduzidos automaticamente a soma zero.

---

## 5. Jogos extensivos, informação e crenças

Um jogo extensivo registra histórias `H`, ações disponíveis `A(h)`, função de jogador `P(h)`, conjuntos de informação `\mathcal I_i`, probabilidades da natureza e utilidades terminais.

### Requisitos

- árvore de decisão versionada;
- movimentos simultâneos representados por conjuntos de informação;
- perfect recall como padrão;
- backward induction para informação perfeita;
- verificação de equilíbrio perfeito em subjogos;
- beliefs em conjuntos de informação;
- sequential rationality;
- commitment points, red lines e ações irreversíveis;
- custo de atraso e desconto temporal.

O valor presente de uma trajetória poderá usar:

\[
U_i=\mathbb E\left[\sum_{t=0}^{T}\delta_i^t r_i(s_t,a_t)\right]
\]

com `\delta_i` específico do ator. Governos em ciclo eleitoral, bancos centrais e fundos soberanos podem ter horizontes diferentes.

---

## 6. Jogos bayesianos e informação incompleta

Um jogo bayesiano é:

\[
G=\langle N,(A_i),(T_i),p,(u_i)\rangle
\]

onde `T_i` representa tipos privados e `p(t)` a crença comum sobre tipos. Uma estratégia é `s_i:T_i\rightarrow\Delta(A_i)`.

O equilíbrio Bayes–Nash satisfaz:

\[
s_i^*(t_i)\in\arg\max_{s_i}
\mathbb E_{t_{-i}\mid t_i}
[u_i(s_i,s_{-i}^*,t_i,t_{-i})]
\]

### Aplicações

- intenção militar ou diplomática desconhecida;
- capacidade real não observada;
- disposição para suportar sanções;
- tipo político de liderança;
- reservas, custos e limites privados em mercados;
- confiabilidade de alianças.

### Implementação

- priors e posteriors versionados;
- transformação de Harsanyi;
- enumeração para jogos pequenos;
- amostragem de tipos em Monte Carlo;
- atualização Bayesiana após sinais;
- análise de sensibilidade a priors;
- separação entre incerteza sobre estado, parâmetro, modelo e intenção.

---

## 7. Sinalização, screening e reputação

Em jogos de sinalização, um emissor de tipo `t` escolhe sinal `m`, e o receptor escolhe ação `a` após atualizar:

\[
\mu(t\mid m)=\frac{p(m\mid t)p(t)}{\sum_{t'}p(m\mid t')p(t')}
\]

O sistema modelará:

- pooling, separating e semi-separating equilibria;
- sinais custosos e cheap talk;
- tying hands versus sunk costs;
- bluff, demonstrações de força e ambiguidade estratégica;
- screening por sanções, inspeções, auditorias ou ofertas contratuais;
- reputação construída em jogos repetidos.

Sinais textuais extraídos por LLM são observações ruidosas, não tipos verdadeiros.

---

## 8. Jogos repetidos e cooperação

Para um jogo repetido infinitamente com desconto `\delta`, uma estratégia cooperativa pode ser sustentável quando o ganho imediato de desvio é compensado pela perda futura. Em uma forma simplificada:

\[
\frac{R}{1-\delta}\geq T+\frac{\delta P}{1-\delta}
\]

logo:

\[
\delta\geq\frac{T-R}{T-P}
\]

O motor deverá representar:

- horizonte finito ou infinito aproximado;
- grim trigger, tit-for-tat, win-stay/lose-shift e estratégias condicionais;
- reputação e memória imperfeita;
- ruído de observação e erro de execução;
- folk theorem como conjunto potencial amplo, não como previsão única;
- cooperação em comércio, clima, defesa, cartéis e regimes internacionais.

---

## 9. Barganha e negociação

### Solução de Nash

Para conjunto viável `F` e ponto de desacordo `d`, a solução é:

\[
x^*=\arg\max_{x\in F,\,x\geq d}
\prod_i(x_i-d_i)^{w_i}
\]

com pesos `w_i` explicitamente justificados.

### Barganha alternada de Rubinstein

Para dois atores com descontos `\delta_1,\delta_2`, o acordo depende de paciência relativa, protocolo e vantagem de fazer a primeira oferta. O sistema deverá permitir:

- ofertas e contrapropostas;
- deadlines;
- custos de atraso;
- outside options;
- informação privada;
- risco de ruptura;
- issue linkage e side payments;
- mediação e acordos contingentes.

Pequenas mudanças no protocolo podem mudar substancialmente o resultado; portanto, o protocolo é dado do modelo, não detalhe visual.

---

## 10. Jogos cooperativos e coalizões

Um jogo cooperativo de utilidade transferível é `\langle N,v\rangle`, com `v(S)` representando o valor da coalizão `S`.

### Valor de Shapley

\[
\phi_i(v)=\sum_{S\subseteq N\setminus\{i\}}
\frac{|S|!(n-|S|-1)!}{n!}
[v(S\cup\{i\})-v(S)]
\]

### Núcleo

Uma alocação `x` está no core quando:

\[
\sum_{i\in N}x_i=v(N),\qquad
\sum_{i\in S}x_i\geq v(S)\;\forall S\subseteq N
\]

### Módulos

- Shapley exato para `n` pequeno e Monte Carlo por permutações para `n` maior;
- Shapley–Shubik para poder de voto;
- Banzhaf opcional;
- core e least core;
- nucleolus como extensão futura;
- coalition structure generation;
- coalizões sobrepostas;
- partition-function games para externalidades entre coalizões;
- estabilidade, blocking e farsighted deviations;
- formação/dissolução temporal de alianças.

Aplicações incluem alianças, blocos comerciais, OPEP+, votações multilaterais e coalizões climáticas.

---

## 11. Stackelberg, compromisso e jogos de segurança

Em um jogo Stackelberg, o líder escolhe `x`, o seguidor observa e responde:

\[
x^*\in\arg\max_x U_L(x,BR_F(x))
\]

O sistema distinguirá:

- strong e weak Stackelberg equilibrium;
- commitment observável versus não crível;
- múltiplas respostas do seguidor;
- adversário perfeitamente racional ou quantal;
- payoffs desconhecidos;
- robust Stackelberg e minimax regret;
- alocação de recursos escassos a alvos.

Não será usado para produzir instruções militares operacionais. O uso é analítico, agregado e defensivo.

---

## 12. Racionalidade limitada e economia comportamental

### Quantal Response Equilibrium

A resposta logit do jogador `i` é:

\[
\sigma_i(a_i)=
\frac{\exp(\lambda_i\,\mathbb E[U_i(a_i,\sigma_{-i})])}
{\sum_{a_i'}\exp(\lambda_i\,\mathbb E[U_i(a_i',\sigma_{-i})])}
\]

- `\lambda=0`: escolha uniforme;
- `\lambda\rightarrow\infty`: melhor resposta determinística.

### Level-k e Cognitive Hierarchy

- nível 0 segue política simples declarada;
- nível 1 responde ao nível 0;
- nível `k` responde a níveis inferiores;
- Cognitive Hierarchy usa distribuição, frequentemente Poisson, sobre níveis.

### Requisitos

- parâmetros ajustáveis e calibráveis;
- prospect theory apenas quando houver base empírica;
- vieses institucionais e custos cognitivos;
- heterogeneidade entre órgãos do mesmo país;
- comparação obrigatória com Nash e políticas simples;
- nenhuma persona de LLM tratada como medida de psicologia real.

---

## 13. Aprendizado em jogos e arrependimento

O regret externo médio do ator `i` é:

\[
R_i^T=\max_{a_i}\frac1T\sum_{t=1}^T
[u_i(a_i,a_{-i}^t)-u_i(a^t)]
\]

Uma dinâmica no-regret satisfaz `R_i^T\rightarrow0`. Se todos minimizam regret externo, distribuições empíricas se aproximam de coarse correlated equilibrium; regret interno conecta-se a correlated equilibrium.

### Regret matching

\[
\sigma_i^{T+1}(a)\propto [R_i^T(a)]_+
\]

### Counterfactual Regret Minimization

Para jogos extensivos de informação imperfeita, CFR decompõe regret por conjunto de informação. O MVP deverá incluir a interface e fixtures pequenas; CFR completo entra como módulo experimental porque garantias clássicas concentram-se em jogos finitos de dois jogadores e soma zero com perfect recall.

### Auditoria

- regret por ator;
- exploitability;
- estabilidade entre seeds;
- convergência versus orçamento;
- comparação com best response e heurísticas.

---

## 14. Jogos estocásticos e Markov games

Um jogo estocástico é:

\[
G=\langle N,S,(A_i),P,(r_i),\gamma\rangle
\]

com transição:

\[
P(s'\mid s,a_1,\ldots,a_n)
\]

O valor de política conjunta `\pi` é:

\[
V_i^\pi(s)=\mathbb E_\pi
\left[\sum_{t=0}^{\infty}\gamma^t r_i(s_t,a_t)\mid s_0=s\right]
\]

### Implementação

- estados e transições explícitos;
- finite horizon e discounted infinite horizon;
- value iteration para zero-sum pequeno;
- políticas estacionárias e dependentes de história;
- Nash-Q apenas experimental, com avisos de convergência restritiva;
- POMDP/Dec-POMDP como representação de observabilidade parcial;
- partículas e belief state para integrar estado latente;
- progressive widening em espaços de ação grandes.

---

## 15. Jogos evolucionários e dinâmica replicadora

Para população com frequências `x_i` e matriz de payoff `A`:

\[
\dot{x_i}=x_i[(Ax)_i-x^TAx]
\]

O módulo deverá calcular:

- passos discretos e integração numérica controlada;
- pontos fixos;
- evolutionary stable strategies;
- invasibilidade;
- mutação/replicator–mutator;
- dinâmica em redes;
- trajetórias de normas, alianças, padrões de negociação e estratégias de mercado.

A interpretação é populacional/adaptativa; não deve ser confundida com evolução biológica literal de países.

---

## 16. Mean-field games

Mean-field games aproximam populações muito grandes de agentes fracos por uma distribuição agregada `m_t`. Em forma contínua, combinam uma equação Hamilton–Jacobi–Bellman e uma Fokker–Planck/Kolmogorov:

\[
-\partial_t V + H(x,\nabla V,m)=0
\]

\[
\partial_t m-\nabla\cdot(m\,\partial_pH(x,\nabla V,m))=0
\]

No MVP, mean-field será **interface experimental**, não solver completo. É apropriado para populações, investidores, consumidores ou migração, não para poucos países altamente heterogêneos.

---

## 17. MCTS e planejamento estratégico

MCTS seleciona ações por UCT:

\[
UCT(s,a)=\bar Q(s,a)+c\sqrt{\frac{\ln N(s)}{N(s,a)}}
\]

O sistema usará MCTS para **explorar decisões dentro do simulador**, não para transformar frequência de rollouts em probabilidade do mundo sem calibração.

Requisitos:

- seleção, expansão, rollout e backup;
- seeds e budgets reproduzíveis;
- chance nodes;
- information sets/belief state;
- progressive widening;
- risk-sensitive backup por CVaR;
- multiobjective utility;
- comparação com política aleatória, greedy e minimax regret;
- detecção de reward hacking.

---

## 18. Multiobjective games e decisão robusta

A utilidade de um país pode ser vetorial:

\[
\mathbf u_i=(u_i^{econ},u_i^{seg},u_i^{pol},u_i^{soc},u_i^{amb})
\]

O sistema deverá suportar:

- pesos declarados e intervalares;
- fronteira de Pareto;
- lexicographic constraints para red lines;
- social welfare utilitarian, egalitarian e Nash social welfare;
- CVaR para perdas de cauda:

\[
CVaR_\alpha(L)=\min_\eta\left[\eta+
\frac{1}{1-\alpha}\mathbb E(L-\eta)_+\right]
\]

- robustez entre modelos;
- satisficing e minimax regret.

A UI deve mostrar trade-offs, não esconder valores políticos em um escalar arbitrário.

---

## 19. Seleção automática do modelo de jogo

O `GameFormSelector` deverá usar o briefing para recomendar, com justificativa:

| Condição | Forma recomendada |
|---|---|
| decisão simultânea e única | normal form |
| sequência e compromisso | extensive/Stackelberg |
| tipos ou payoffs privados | Bayesian/signaling |
| relacionamento persistente | repeated game |
| alianças e divisão de ganhos | cooperative/coalition |
| estado muda ao longo do tempo | stochastic/Markov game |
| muitos agentes homogêneos | evolutionary/mean-field |
| ação sob observabilidade parcial | Bayesian extensive/POMDP |
| exploração de política | MCTS + simulador |

O usuário poderá substituir a recomendação, mas a decisão ficará registrada no trace.

---

## 20. Validação matemática e científica

Cada solver deverá ter:

1. testes unitários com jogos canônicos;
2. property-based invariants quando possível;
3. golden fixtures;
4. residual de equilíbrio/optimalidade;
5. sensibilidade a parâmetros;
6. comparação com solução analítica conhecida;
7. múltiplas seeds para algoritmos amostrais;
8. limite de tamanho e complexidade explícito;
9. fallback seguro;
10. rótulo `exact`, `approximate`, `heuristic` ou `experimental`.

### Jogos canônicos mínimos

- Prisoner’s Dilemma;
- Chicken/Hawk–Dove;
- Battle of the Sexes;
- Matching Pennies;
- Stag Hunt;
- Ultimatum e bargaining alternado;
- signaling game simples;
- coalition game com Shapley conhecido;
- Stackelberg security game pequeno;
- stochastic game de dois estados;
- replicator dynamics de cooperação;
- correlated equilibrium fixture.

---

## 21. Relação com agentes de linguagem

LLMs podem:

- extrair ações candidatas;
- formular preferências como hipóteses;
- propor tipos e sinais;
- explicar resultados;
- produzir deliberações institucionais;
- levantar estratégias não previstas.

LLMs não podem:

- inventar payoff como fato;
- declarar equilíbrio sem solver;
- alterar diretamente estado quantitativo;
- converter frequência narrativa em probabilidade calibrada;
- acessar informação que o ator simulado não possui;
- revelar cadeia de pensamento privada; somente justificativa curta e auditável.

A ação proposta passa por schema, capability policy, constraints, solver e reducer determinístico antes de produzir efeitos.

---

## 22. Referências científicas fundamentais

1. Nash, J. F. (1950). *Equilibrium Points in n-Person Games*. https://doi.org/10.1073/pnas.36.1.48
2. Shapley, L. S. (1953). *Stochastic Games*. https://doi.org/10.1073/pnas.39.10.1095
3. Harsanyi, J. C. (1967). *Games with Incomplete Information Played by Bayesian Players, Part I*. https://doi.org/10.1287/mnsc.14.3.159
4. Aumann, R. J. (1974). *Subjectivity and Correlation in Randomized Strategies*. https://doi.org/10.1016/0304-4068(74)90037-8
5. Selten, R. (1975). *Reexamination of the Perfectness Concept*. https://doi.org/10.1007/BF01766400
6. Myerson, R. B. (1981). *Optimal Auction Design*. https://doi.org/10.1287/moor.6.1.58
7. Rubinstein, A. (1982). *Perfect Equilibrium in a Bargaining Model*. https://doi.org/10.2307/1912531
8. Fudenberg, D.; Maskin, E. (1986). *The Folk Theorem in Repeated Games*. https://doi.org/10.2307/1911307
9. McKelvey, R. D.; Palfrey, T. R. (1995). *Quantal Response Equilibria*. https://doi.org/10.1006/game.1995.1023
10. Hart, S.; Mas-Colell, A. (2000). *A Simple Adaptive Procedure Leading to Correlated Equilibrium*. https://doi.org/10.1111/1468-0262.00153
11. Camerer, C.; Ho, T.; Chong, J. (2004). *A Cognitive Hierarchy Model of Games*. https://doi.org/10.1162/0033553041502225
12. Nowak, M. A. (2006). *Five Rules for the Evolution of Cooperation*. https://doi.org/10.1126/science.1133755
13. Lasry, J.-M.; Lions, P.-L. (2007). *Mean Field Games*. https://doi.org/10.1007/s11537-007-0657-8
14. Littman, M. L. (1994). *Markov Games as a Framework for Multi-Agent Reinforcement Learning*. https://doi.org/10.1016/B978-1-55860-335-6.50027-1
15. Hu, J.; Wellman, M. P. (2003). *Nash Q-Learning for General-Sum Stochastic Games*. https://www.jmlr.org/papers/v4/hu03a.html
16. Zinkevich, M. et al. (2007). *Regret Minimization in Games with Incomplete Information*. https://proceedings.neurips.cc/paper/2007/hash/08d98638c6fcd194a4b1e6992063e944-Abstract.html
17. Browne, C. B. et al. (2012). *A Survey of Monte Carlo Tree Search Methods*. https://doi.org/10.1109/TCIAIG.2012.2186810
18. Sinha, A. et al. (2018). *Stackelberg Security Games: Looking Beyond a Decade of Success*. https://www.ijcai.org/proceedings/2018/0775.pdf
19. Hogan, D. P.; Brennen, A. (2024). *Open-Ended Wargames with Large Language Models*. https://arxiv.org/abs/2404.11446
20. Rivera, J.-P. et al. (2024). *Escalation Risks from Language Models in Military and Diplomatic Decision-Making*. https://arxiv.org/abs/2401.03408
21. Gao, C. et al. (2024). *Large Language Models Empowered Agent-based Modeling and Simulation*. https://arxiv.org/abs/2312.11970
22. Winter, E. (2002). *The Shapley Value*. https://doi.org/10.1016/S1574-0005(02)03016-3
23. Humphreys, M. (2008). *Coalitions*. https://doi.org/10.1146/annurev.polisci.11.062206.091849

---

## 23. Decisão de implementação

O release inicial implementará como estáveis:

- normal form e utilidade esperada;
- melhores respostas, dominância, Pareto e Nash puro;
- solução mista `2×2`;
- maximin/minimax para jogos pequenos;
- verificação de correlated equilibrium;
- Nash bargaining;
- Shapley exato e amostral;
- Stackelberg finito por enumeração;
- QRE logit iterativo;
- regret matching;
- repeated-game cooperation threshold;
- replicator dynamics;
- Markov-game rollout;
- métricas de residual, exploitability e regret.

Ficarão rotulados como experimentais ou interfaces para versões futuras:

- equilibrium solvers gerais de grande escala;
- CFR completo;
- Nash-Q geral;
- mean-field PDE solver;
- Dec-POMDP;
- mechanism design automatizado;
- nucleolus e coalition structure generation em larga escala.

Essa fronteira impede que o produto prometa completude computacional onde o problema é intratável ou onde as garantias dependem de hipóteses estreitas.
