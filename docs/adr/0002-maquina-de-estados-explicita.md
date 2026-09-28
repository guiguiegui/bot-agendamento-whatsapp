# 2. Máquina de estados explícita pra conversa

Data: 2026-09-27 (retroativa — decisão já existia desde o commit inicial do projeto)

## Status

Aceita

## Contexto

Um bot de atendimento por texto precisa interpretar respostas curtas e ambíguas ("1", "sim", "hoje") de um jeito consistente. A abordagem mais comum em bots simples é casar palavras-chave/regex direto no texto recebido, mas isso faz o significado de uma resposta depender de contexto implícito espalhado pelo código — "o que o número '1' significa" vira uma pergunta sem resposta única, porque depende de qual pergunta foi feita antes, e essa informação não está representada em lugar nenhum explicitamente.

## Decisão

Cada conversa tem um estado explícito (`EstadoConversa`, em `src/conversation/states.ts`: `MENU`, `AGENDAR_SERVICO`, `AGENDAR_DATA`, `AGENDAR_HORARIO`, `CANCELAR_ESCOLHER`, `FALANDO_COM_ATENDENTE`), persistido entre mensagens (ver [ADR 3](0003-fila-assincrona-bullmq-redis.md)). `src/conversation/router.ts` despacha pra um handler por estado — "o que esse número '1' significa" depende só do estado atual, nunca de histórico implícito ou de regex genérico tentando adivinhar intenção.

## Consequências

- Cada estado é testável isoladamente (ver `test/router.test.ts`) — inclusive casos de borda como corrida de horário entre dois clientes, ou o cliente demorar a responder até um horário oferecido passar.
- Adicionar um novo passo na conversa é adicionar um novo valor em `EstadoConversa` e um handler — não exige reescrever lógica de interpretação de texto existente.
- Custo: mais boilerplate do que um bot baseado em regex solto, pra um fluxo de conversa tão simples quanto esse. O tamanho do projeto (fluxo de agendamento com vários passos, cancelamento, comando de admin) já paga esse custo.
