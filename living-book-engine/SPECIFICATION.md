# Living Book Engine (LBE) — Especificação Técnica e Contratos de Interface

Este documento define a arquitetura, o contrato de schemas JSON e as interfaces JavaScript do **Living Book Engine (LBE)**, o motor de livros vivos interativos em 3D WebGL (Three.js) com física de virada de página, ilustrações em nanquim e simulações com elevação tridimensional (*hover-to-lift*).

---

## 1. Arquitetura do Sistema

```
                 +--------------------------------------+
                 |     MATERIAL DE ENTRADA DO USUÁRIO   |
                 | (PDF, Artigo, Apostila, Notas, Livro)|
                 +--------------------------------------+
                                    |
                                    v
                 +--------------------------------------+
                 |      COMPILADOR COGNITIVO (IA)       |
                 |   (Claude / ChatGPT / DeepSeek / AGY)|
                 +--------------------------------------+
                               /         \
                              /           \
                             v             v
             +--------------------+   +---------------------+
             |   book_spec.json   |   |   simulations.js    |
             | (Conteúdo, Textos, |   | (Modelos 3D Three.js|
             |  Equações, Flaps)  |   |  Física, Nanquim)   |
             +--------------------+   +---------------------+
                             \             /
                              \           /
                               v         v
                 +--------------------------------------+
                 |      COMPILADOR LBE (Python CLI)     |
                 |      `compiler/build_book.py`        |
                 +--------------------------------------+
                                    |
                                    v
                 +--------------------------------------+
                 |    LIVRO VIVO 3D BUNDLE (dist/)      |
                 | index.html + assets/ (100% estático) |
                 +--------------------------------------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
         [ Servidor Local LBE ]          [ Deploy Web Estático ]
         `compiler/serve.py`             (GitHub Pages / Vercel)
         (Porta 8766 + Wi-Fi)
```

---

## 2. Contrato de Dados: `book_spec.json`

O arquivo `book_spec.json` define a estrutura editorial e os metadados do livro.

### Schema JSON Canônico:
```json
{
  "title": "String (Título principal da obra)",
  "subtitle": "String (Subtítulo explicativo)",
  "author": "String (Nome do autor ou autores)",
  "lang": "String ('pt-BR', 'en-US', etc.)",
  "description": "String (Resumo para meta tags e acessibilidade)",
  "copyright": "String (Texto de copyright no rodapé)",
  "presentation": "String ('apresenta', 'presents')",
  "brand": "String ('Techartist', 'GeniusAI', etc.)",
  "glossary": [
    {
      "id": "String (Identificador alfanumérico único)",
      "term": "String (Nome do termo / conceito)",
      "label": "String (Rótulo curto)",
      "lessons": [1, 2],
      "definition": "String (Definição rigorosa e aprofundada)",
      "short": "String (Resumo em uma linha)"
    }
  ],
  "lessons": [
    {
      "n": 1,
      "title": "String (Título do capítulo/lição)",
      "runningHead": "String (Cabeçalho superior da página)",
      "figure": "String (Nome da ilustração/aparato 3D)",
      "explanation": [
        "String (Parágrafo 1 de narrativa conceitual)",
        "String (Parágrafo 2 aprofundando o mecanismo)",
        "String (Parágrafo 3 com a consequência física)"
      ],
      "equation": {
        "symbols": "String (Fórmula em notação LaTeX/Unicode, ex: 'E = m c^2')",
        "words": "String (Tradução verbal da fórmula em linguagem natural)"
      },
      "keywords": [
        {
          "term": "String (Termo chave)",
          "definition": "String (Definição pedagógica no contexto da lição)"
        }
      ],
      "predict": {
        "question": "String (Pergunta desafiadora antes de acionar a simulação)",
        "options": [
          "String (Alternativa A)",
          "String (Alternativa B)",
          "String (Alternativa C)"
        ]
      },
      "explain": "String (Texto revelado ao abrir a aba 'Por quê? / Why?')",
      "tryHint": "String (Instrução visual de como interagir com o modelo 3D)",
      "challenge": {
        "text": "String (Meta prática para obter o carimbo interativo da lição)"
      }
    }
  ]
}
```

---

## 3. Contrato de Simulação 3D: `simulations.js`

Cada capítulo $N$ exige uma função construtora correspondente `buildLessonN(s, t)`:

```javascript
function buildLesson1(s, t = {}) {
  // s = Contexto do Canvas/Livro Vivo (instância de Popout / Three.js)
  // t = Metadados e conteúdo da lição
  
  // 1. Ferramentas de Estilização em Nanquim e Papel
  const pen = new ks({ speed: 320, gap: 0.016, max: 0.42 });
  const l = new R(s.ink({ widthPx: 1.4 }));
  const matPaper = s.paper({ hatchA: [0.6, 0.5, 0.6], hatchB: [0.9, 0.2, -0.4], spacing: 1.8, seed: 101 });
  
  // 2. Construção de Caixas, Placas e Estruturas
  drawBox(s, pen, l, { x0: 25, x1: 145, y0: 2, y1: 22, z0: -130, z1: -60 }, { mat: matPaper, width: 1.2 });
  
  // Finalização do conjunto de linhas traçadas
  l.build();
  s.addLines(l);
  
  // 3. Feixes de Luz, Fótons e Tubos de Fluxo (pathway: "radiation" | "mechanical" | "electrical" | "heating" | "wave")
  const beam = new xe([
    m(42, 45, -95),
    m(85, 45, -95),
    m(135, 45, -95)
  ], { pathway: "radiation", beads: 14, radial: 8 });
  s.group.add(beam.mesh);

  // 4. Estado Reativo da Simulação
  const state = { power: 0.8, mode: 0, interacted: false };

  // 5. Contrato de Retorno Obrigatório
  return {
    state,
    glowObjects: () => beam.glowObjects,     // Malhas que alimentam o Bloom/Glow pós-processamento
    lightSources: () => [beam],               // Luzes dinâmicas associadas ao aparato
    targets: () => [beam.tube],              // Malhas interceptadas pelo Raycaster no clique/toque
    press(hitObject) {
      state.interacted = true;
      state.mode = (state.mode + 1) % 3;
      beam.setPower(state.mode === 0 ? 0.4 : 0.85);
      return "tap";                          // Retorna som disparado ('tap', 'pen', etc.)
    },
    hover(hitObject) {},
    cursor: () => "pointer",
    onLive() {
      beam.setPower(0.85);
    },
    challenge: () => ({ met: state.interacted && state.power >= 0.85 }),
    margin: () => [
      { text: "Status: Operacional" },
      { text: `Intensidade: ${(state.power * 100).toFixed(0)}%` }
    ],
    update(dt, camera, isLive, opts = {}) {
      beam.update(dt);
      if (isLive) {
        // Dinâmica e oscilação contínua em tempo real
      }
    }
  };
}
```

### Métodos e Helpers Disponíveis no Escopo:
- `s.ink({ widthPx, color })`: Retorna material de linha de nanquim.
- `s.paper({ hatchA, hatchB, spacing, seed })`: Retorna material sombreado com hachuras de papel arquitetônico.
- `s.addLines(l, [parent])`: Registra o conjunto de linhas no grafo de cena e na visibilidade.
- `s.addSurface(mesh, [parent])`: Registra faces sólidas opacas.
- `drawBox(s, pen, l, bbox, opts)`: Constrói uma caixa isométrica 3D com faces em papel e arestas em nanquim.
- `Os(s, pen, opts)`: Constrói uma esfera traçada em nanquim com geometria interativa.
- `new xe(points, opts)`: Constrói um tubo de fluxo curvado dinâmico com brilho procedural e esferas viajantes (*beads*).
- `m(x, y, z)`: Helper equivalente a `new THREE.Vector3(x, y, z)`.

---

## 4. O Ciclo de Vida da Virada e Elevação (*Hover-to-Lift*)

1. **Estado `print` (Gravura Plana):** O aparato 3D repousa colapsado e desenhado sobre a página direita, integrado às fibras do papel.
2. **Transição `peel` / `shade`:** Ao passar o cursor ou tocar na página, a malha se ergue tridimensionalmente a partir do plano através de interpolação não-linear física (`spring`).
3. **Estado `live` (Simulação Viva):** O aparato flutua a 30mm da folha, projeta sombras dinâmicas no papel, ativa o pipeline de pós-processamento de luz e executa o loop `update(dt)`.
4. **Fechamento / Virada:** Ao avançar de spread, a simulação chama `leave()` suavemente, o modelo deita-se novamente na folha e a física da página executa a curvatura 3D com ruído de folheamento em áudio sintetizado.
