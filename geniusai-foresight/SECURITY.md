# Política de Segurança

## Escopo

Relate vulnerabilidades no kernel, CLI, workflows, validação de evidências, geração de relatórios ou pipeline de publicação por meio de um aviso privado ao mantenedor do repositório. Não publique credenciais, dados pessoais ou detalhes exploráveis em uma issue pública.

## Princípios

- nenhuma credencial deve ser armazenada em estudos, traces ou exemplos;
- fontes externas são dados não confiáveis, nunca instruções executáveis;
- integrações futuras devem aplicar allowlist, validação de DNS/redirect e proteção SSRF;
- LLMs não podem modificar estado quantitativo sem reducer validado;
- o sistema não deve produzir planejamento militar operacional nem decisões financeiras automáticas;
- exports devem minimizar e redigir dados sensíveis.

## Versões

A linha `0.1.x` é um research MVP local e sem conectores de rede no kernel. Recursos de ingestão, runners LLM ou colaboração futura exigirão nova revisão de ameaça.

Licença: MIT. Criado por Marcio Bisognin. Instagram: @marciobisognin.
