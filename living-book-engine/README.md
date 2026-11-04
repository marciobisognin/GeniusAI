# Living Book Engine (LBE) — MVP
> **Framework Autônomo para Criação de Livros Vivos 3D Interativos com WebGL, Nanquim e Simulações Físicas**

O **Living Book Engine (LBE)** é um motor estático de alto desempenho inspirado na arquitetura de *Every Joule* e *O Cântico dos Quanta*. Ele permite que qualquer pessoa — ou qualquer Inteligência Artificial (Claude, ChatGPT, DeepSeek, Gemini, etc.) — transforme documentos técnicos, apostilas, artigos acadêmicos ou livros em uma experiência tridimensional imersiva no navegador.

---

## 🌟 O que é um "Livro Vivo"?

Diferente de um PDF ou e-book estático, um Livro Vivo possui:
1. **Física Realista de Folheamento 3D:** Páginas curvadas em tempo real com Three.js e sombras volumétricas que respondem a gestos de toque (*swipe*), cliques ou teclado (<kbd>→</kbd> e <kbd>←</kbd>).
2. **Ilustrações com Elevação Tridimensional (*Hover-to-Lift*):** No estado padrão, a ilustração parece uma gravura antiga impressa em nanquim e papel com hachuras arquitetônicas. Ao passar o cursor ou tocar na tela, ela se ergue da folha em 3D e se transforma em uma máquina física viva e interativa.
3. **Didática por Experimentação:** Cada capítulo contém fórmulas matemáticas reais, palavras-chave do glossário, widget de predição antes da ativação, abas expansíveis *"Por quê?"* e metas práticas (*challenges*) que concedem carimbos interativos.
4. **Zero Dependências Pesadas:** Roda 100% no navegador (HTML5, WebGL, ES6 Modules), sem necessidade de Webpack, Vite ou Node.js em produção.

---

## 📁 Estrutura do Repositório

```
living-book-engine/
├── README.md                           # Documentação central e guia rápido
├── AI_PROMPT_GUIDE.md                  # Prompt Mestre para qualquer IA gerar livros
├── SPECIFICATION.md                    # Especificação estrita dos contratos JSON e JS
├── compiler/
│   ├── build_book.py                   # Compilador CLI em Python (empacota o livro final)
│   └── serve.py                        # Servidor HTTP local leve com CORS e detecção Wi-Fi
├── core/                               # Motor 3D base reutilizável
│   ├── assets/                         # Three.js, shaders, fontes e pós-processamento
│   ├── parts/                          # Prefixos, pontes e sufixos de compilação
│   └── template.html                   # HTML base com loader suave e failsafe
├── examples/
│   └── demo-relatividade/              # Exemplo completo: Teoria da Relatividade
│       ├── book_spec.json              # 5 Lições editoriais, equações e glossário
│       └── simulations.js              # 5 Simulações 3D interativas em nanquim
└── dist/
    └── demo-relatividade/              # Livro de exemplo compilado e testável imediatamente
```

---

## 🚀 Como Criar um Livro com Outra IA

### Passo 1: Envie o Material para a IA
1. Abra o arquivo [`AI_PROMPT_GUIDE.md`](./AI_PROMPT_GUIDE.md) e copie o **Prompt Mestre**.
2. Cole o prompt no seu chat com **Claude 3.7**, **ChatGPT (o3/4o)**, **DeepSeek R1** ou **Gemini**.
3. Anexe ou cole o material técnico que você quer transformar em livro (PDF, texto, anotações de aula, artigo científico).

### Passo 2: Salve a Resposta da IA
A IA irá retornar exatamente dois arquivos:
1. `book_spec.json`: Estrutura do livro, textos, equações e glossário.
2. `simulations.js`: Código Three.js dos aparatos 3D interativos.

Salve ambos dentro de uma pasta (ex: `meus-livros/termodinamica/`).

### Passo 3: Compile o Livro Localmente
No terminal, execute o compilador:
```bash
python3 compiler/build_book.py \
  --spec meus-livros/termodinamica/book_spec.json \
  --sims meus-livros/termodinamica/simulations.js \
  --out dist/termodinamica
```

O compilador irá:
- Validar a integridade das lições e do glossário.
- Injetar o texto no sistema de rasterização 2D de páginas do livro.
- Empacotar as simulações 3D no pipeline de shaders de nanquim e luz.
- Validar toda a sintaxe com `node --check`.

### Passo 4: Rode o Servidor Local
Execute:
```bash
python3 compiler/serve.py --book dist/termodinamica --port 8766
```

O terminal exibirá:
- **Acesso no computador:** `http://localhost:8766/`
- **Acesso no celular/tablet (na mesma rede Wi-Fi):** `http://<SEU_IP_LOCAL>:8766/`

---

## 🧪 Testando a Demonstração Inclusa (Relatividade de Einstein)

O MVP já inclui um livro demonstrativo completo e compilado: **"A Dança do Espaço-Tempo"** (5 lições interativas sobre relatividade restrita e geral):
```bash
# Rodar a demo na porta 8766
python3 compiler/serve.py --book dist/demo-relatividade --port 8766
```

Abra no navegador e aproveite:
- **Lição 1:** O Interferômetro de Michelson-Morley (braços ortogonais de laser e laje de pedra).
- **Lição 2:** O Relógio de Luz (pulso de fóton vertical vs. trajetória diagonal com dilatação temporal).
- **Lição 3:** A Contração Espacial de Lorentz (foguete em alta velocidade comprimindo na malha).
- **Lição 4:** $E = mc^2$ (conversão nuclear e dispersão de raios gama).
- **Lição 5:** A Curvatura do Espaço-Tempo (poço gravitacional e órbita geodésica ao redor de uma estrela).

---

## 🌐 Publicando na Web (GitHub Pages / Vercel / Netlify)

A pasta de saída (`dist/<nome-do-livro>/`) é **100% estática**. Para publicá-la:
1. Copie o conteúdo da pasta `dist/<nome-do-livro>/` para um repositório no GitHub.
2. Ative o **GitHub Pages** nas configurações do repositório (Source: `Deploy from a branch` -> `main` / `root`).
3. O livro estará acessível em qualquer lugar do mundo com carregamento ultrarrápido!

---

## 📜 Licença e Créditos
Inspirado na arquitetura de visualização científica *Every Joule* de Robin Sloan e Techartist.  
Implementado e expandido para o ecossistema GeniusAI / Antigravity por Marcio Bisognin.
