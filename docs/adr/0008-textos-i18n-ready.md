# 8. Textos de conversa centralizados, prontos pra tradução

Data: 2026-09-28

## Status

Aceita

## Contexto

Os textos que o bot manda pro cliente estavam espalhados em dois lugares: 7 funções em `src/conversation/mensagens.ts`, e mais de 15 strings literais direto dentro dos handlers de `src/conversation/router.ts` (ex: `"Não entendi essa opção 🤔"`). Não há hoje nenhum negócio cadastrado que precise de um idioma diferente de português — o público-alvo declarado no README é negócio brasileiro —, mas ter texto de conversa espalhado por dois lugares (um módulo dedicado e o próprio router) já era, por si só, uma inconsistência que dificultava saber onde uma mensagem específica estava definida.

## Decisão

Todo texto de conversa passa a viver num dicionário só, `src/i18n/pt-BR.ts`, que implementa a interface `src/i18n/types.ts` (`Mensagens`) — o contrato que qualquer idioma novo precisaria satisfazer. `src/conversation/mensagens.ts` foi apagado (totalmente absorvido). `router.ts` chama `mensagens.nomeDaMensagem(...)` em vez de ter texto literal ou chamar uma função solta.

Onde uma mensagem antes era montada por concatenação de duas frases com palavras de ligação em português (ex: motivo de recusa + `"E não sobrou outro horário livre..."`), a composição inteira virou uma função só no dicionário — a ideia é que um idioma diferente possa reescrever a frase completa, não ficar preso a encaixar pedaços traduzidos numa ordem fixa de português.

**Não foi criado** nenhum mecanismo de seleção de idioma (variável de ambiente, campo no cadastro do negócio, `index.ts` com fallback) — isso é infraestrutura pra um recurso que não existe ainda. Só existe um arquivo de idioma (`pt-BR.ts`), importado direto por `router.ts`; adicionar um segundo idioma no futuro será criar um arquivo novo que implemente `Mensagens` e decidir ali, nesse momento, como escolher entre os dois — sem precisar tocar em `router.ts` nem nos casos de uso (ver [ADR 7](0007-camada-de-casos-de-uso.md)).

## Consequências

- Todo texto de conversa tem um lugar só pra ser encontrado e revisado — não tem mais nada de texto de conversa dentro de `router.ts`.
- `test/router.test.ts` não teve nenhuma linha alterada e continuou passando 100% — como os testes usam `toMatch(/regex/i)` sobre o texto renderizado, qualquer erro de cópia ao mover as ~24 mensagens teria quebrado algum teste.
- Adicionar um idioma novo de verdade ainda vai exigir decidir de onde vem o idioma escolhido (hoje não há esse conceito em `Negocio`) — decisão deliberadamente não tomada agora, por não haver caso concreto que a exija.
