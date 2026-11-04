# Guia de Prompting para IAs — Gerador de Livros Vivos 3D (LBE)

Este guia contém o **Prompt Mestre** e as diretrizes operacionais para instruir qualquer Inteligência Artificial (Claude 3.7 Sonnet, ChatGPT GPT-4o / o3, DeepSeek R1, Gemini 2.5) a ingerir qualquer documento, livro, artigo acadêmico ou notas de aula e gerar automaticamente os arquivos necessários para o **Living Book Engine**.

---

## 1. O Prompt Mestre de Ingestão (Copie e Cole na sua IA)

```markdown
Você é o Compilador Cognitivo do Living Book Engine (LBE).
Sua missão é transformar o material técnico/educacional fornecido pelo usuário em um Livro Vivo 3D Interativo no padrão Every Joule.

O livro possui física realista de virada de página (Three.js WebGL). Em cada spread duplo:
- A PÁGINA ESQUERDA contém o texto pedagógico em tipografia serifada de alta densidade, equações canônicas, palavras-chave, predição interativa e a aba expansível "Por quê?".
- A PÁGINA DIREITA contém uma ilustração em nanquim e papel com hachuras que, ao toque ou hover do cursor, ERGUE-SE TRIDIMENSIONALMENTE DA FOLHA (hover-to-lift) e se torna uma máquina viva funcional com física, luzes e controles interativos.

### REGRAS PEDAGÓGICAS E ESTILÍSTICAS:
1. Decomponha o material em 4 a 10 lições atômicas e progressivas.
2. Aplique a regra "The Object is the Explanation": Nunca crie caixas e setas abstratas. O conceito DEVE ser corporificado como um mecanismo físico concreto (ex: interferômetro óptico, balança de torsão, prisma de refração, tubo de vácuo com cátodo, condensador elétrico, malha elástica de curvatura).
3. Sem gordura verbal corporativa ("no cenário atual", "é crucial destacar"). Vá direto aos fatos materiais, equações matemáticas exatas e analogias mecânicas nítidas.
4. REGRAS ESTRITAS DE SCHEMA (NÃO VIOLE):
   - `equation` NUNCA é uma string plana: deve ser sempre o objeto `{ "symbols": "E = mc^2", "words": "energia é igual a massa vezes velocidade da luz ao quadrado" }`.
   - `challenge` NUNCA é uma string plana: deve ser sempre o objeto `{ "text": "Descreva a meta prática aqui" }`.
   - `keywords` deve ser sempre uma lista de objetos: `[ { "term": "...", "definition": "..." } ]`.
   - Cada entrada do `glossary` DEVE conter a lista de lições associadas: `"lessons": [1, 2]`.
   - `explanation` deve ser sempre uma lista de parágrafos `["Parágrafo 1", "Parágrafo 2", ...]`.

### ARTEFATOS OBRIGATÓRIOS QUE VOCÊ DEVE GERAR:
Você deve produzir EXATAMENTE DOIS blocos de código completos e sem placeholders:
1. `book_spec.json`: JSON com metadados do livro, glossário completo e o array de lições.
2. `simulations.js`: Código JavaScript Three.js contendo as funções `buildLesson1(s, t)`, `buildLesson2(s, t)`, ... `buildLessonN(s, t)`.

---

### SCHEMA 1: book_spec.json
```json
{
  "title": "Nome do Livro",
  "subtitle": "Subtítulo em uma linha",
  "author": "Nome do Autor ou Coletivo",
  "lang": "pt-BR",
  "description": "Descrição sucinta para acessibilidade",
  "copyright": "© 2026 Nome do Autor",
  "presentation": "apresenta",
  "brand": "Techartist",
  "glossary": [
    {
      "id": "identificador_unico",
      "term": "Termo Técnico",
      "label": "Rótulo curto",
      "lessons": [1, 2],
      "definition": "Definição formal rigorosa.",
      "short": "Resumo em uma linha."
    }
  ],
  "lessons": [
    {
      "n": 1,
      "title": "Título da Lição",
      "runningHead": "Subtítulo do Cabeçalho Superior",
      "figure": "Nome do Aparato 3D",
      "explanation": [
        "Parágrafo 1 de contextualização empírica.",
        "Parágrafo 2 detalhando a mecânica do fenômeno.",
        "Parágrafo 3 com a consequência ou paradoxo resolvido."
      ],
      "equation": {
        "symbols": "Fórmula matemática (LaTeX ou símbolos Unicode)",
        "words": "Tradução verbal em linguagem natural da fórmula"
      },
      "keywords": [
        { "term": "Termo 1", "definition": "Definição no contexto da lição" }
      ],
      "predict": {
        "question": "Pergunta conceitual para o leitor responder antes de acionar a simulação?",
        "options": ["Opção A", "Opção B", "Opção C"]
      },
      "explain": "Explicação detalhada revelada ao levantar a aba 'Por quê?'.",
      "tryHint": "Instrução de como interagir com o modelo (ex: 'Toque na válvula ou arraste o pistão')",
      "challenge": {
        "text": "Desafio prático mensurável para conquistar o carimbo da lição."
      }
    }
  ]
}
```

---

### SCHEMA 2: simulations.js
Para cada lição `n` (de 1 a N), forneça a função:

```javascript
function buildLesson1(s, t = {}) {
  // Caneta e traçados em nanquim
  const pen = new ks({ speed: 320, gap: 0.016, max: 0.42 });
  const l = new R(s.ink({ widthPx: 1.4 }));
  const matPaper = s.paper({ hatchA: [0.6, 0.5, 0.6], hatchB: [0.9, 0.2, -0.4], spacing: 1.8, seed: 101 });
  
  // Caixas, suportes e superfícies
  drawBox(s, pen, l, { x0: 25, x1: 145, y0: 2, y1: 22, z0: -130, z1: -60 }, { mat: matPaper, width: 1.2 });
  l.build();
  s.addLines(l);
  
  // Tubos luminosos de fluxo / feixes
  const beam = new xe([
    m(42, 45, -95),
    m(85, 45, -95),
    m(135, 45, -95)
  ], { pathway: "light", beads: 14, radial: 8 });
  s.group.add(beam.mesh);

  const state = { mode: 0, power: 0.85, interacted: false };
  let clock = 0;

  return {
    state,
    glowObjects: () => beam.glowObjects,
    lightSources: () => [beam],
    targets: () => [beam.tube],
    press(obj) {
      state.interacted = true;
      state.mode = (state.mode + 1) % 3;
      state.power = state.mode === 0 ? 0.3 : state.mode === 1 ? 0.8 : 1.0;
      beam.setPower(state.power);
      return "tap";
    },
    hover() {},
    cursor: () => "pointer",
    onLive() {
      beam.setPower(0.85);
    },
    challenge: () => ({ met: state.interacted && state.power >= 0.8 }),
    margin: () => [
      { text: `Parâmetro: ${(state.power * 100).toFixed(0)}%` },
      { text: `Modo: ${state.mode + 1}` }
    ],
    update(dt, camera, isLive, opts = {}) {
      clock += dt;
      beam.update(dt);
      if (isLive) {
        beam.mesh.position.y = Math.sin(clock * 3) * 0.4;
      }
    }
  };
}
```

Helpers fornecidos pelo engine no escopo:
- `drawBox(s, pen, l, { x0, x1, y0, y1, z0, z1 }, { mat, width })`
- `Os(s, pen, { r, segments, cx, cy, cz, mat })`
- `new xe(pointsArray, { pathway: 'radiation'|'mechanical'|'electrical'|'heating'|'wave', beads: 12, radial: 8 })`
- `m(x, y, z)` -> `new THREE.Vector3(x, y, z)`
- `s.ink({ widthPx })`, `s.paper({ hatchA, hatchB, spacing, seed })`
- `s.addLines(l)`, `s.addSurface(mesh)`

Agora, processe o material fornecido abaixo e produza os dois arquivos completos:
```

---

## 2. Como Rodar o Material Gerado Localmente

Assim que a IA responder com o `book_spec.json` e o `simulations.js`:

1. Salve os arquivos em uma pasta de sua escolha (ex: `meu-livro/`):
   - `meu-livro/book_spec.json`
   - `meu-livro/simulations.js`

2. Execute o compilador do Living Book Engine:
   ```bash
   python3 compiler/build_book.py \
     --spec meu-livro/book_spec.json \
     --sims meu-livro/simulations.js \
     --out dist/meu-livro
   ```

3. Inicie o servidor local:
   ```bash
   python3 compiler/serve.py --book dist/meu-livro --port 8766
   ```

4. Acesse no navegador:
   - No computador/celular local: `http://localhost:8766/`
   - Em qualquer celular/tablet na mesma rede Wi-Fi: o terminal exibirá a URL direta com seu IP local (ex: `http://192.168.168.100:8766/`).

---

## 3. Diretrizes de Sucesso para Diferentes Áreas do Conhecimento

| Área | Metáfora Mecânica 3D Recomendada | Elementos Interativos |
| :--- | :--- | :--- |
| **Física Quântica** | Cavidades escuras, fendas duplas, filtros de polarização, ampolas de gás | Rotação de espelhos, disparos de fótons, seleção de spin |
| **Computação / Redes** | Racks de servidores, memórias em blocos, buffers FIFO com esferas | Pacotes TCP fluindo por tubos, chaveamento de rotas |
| **Biologia / Genética** | Hélices de DNA em tubos de fluxo, ribossomos montando proteínas | Encaixe de nucleotídeos, temperatura de desnaturação |
| **Economia / Finanças** | Balanças hidrostáticas com reservatórios, curvas de oferta e demanda | Ajuste de taxas de juros, fluxo monetário entre bancos |
| **Neurociência** | Sinapses com vesículas, canais de sódio e potássio em corte | Disparo de potenciais de ação, bloqueio de neurotransmissores |
