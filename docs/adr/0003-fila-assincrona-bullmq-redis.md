# 3. Fila assíncrona com BullMQ/Redis em vez de processamento direto

Data: 2026-09-27 (retroativa — decisão já existia desde o commit inicial do projeto)

## Status

Aceita

## Contexto

A forma mais direta de implementar um bot é processar cada mensagem recebida na hora, dentro do próprio handler de evento da conexão WhatsApp. Isso funciona até o primeiro problema transitório (banco fora do ar por um segundo, uma exceção não tratada) — nesse modelo, a mensagem simplesmente se perde, e a conexão com o WhatsApp fica bloqueada esperando o processamento terminar antes de aceitar a próxima mensagem.

## Decisão

Toda mensagem recebida vira um **job numa fila** (BullMQ sobre Redis, `src/queue/queue.ts`) em vez de ser processada inline. Um worker separado (`src/queue/worker.ts`) consome a fila. O estado de cada conversa (`SessaoContexto`) fica em Redis (`src/queue/sessionStore.ts`), não em memória do processo.

Isso dá três garantias que processamento direto não tem:

1. **Nada se perde.** Se o processamento falhar, o BullMQ tenta de novo sozinho (`attempts: 3`, backoff exponencial) em vez de a mensagem simplesmente sumir.
2. **Não trava o recebimento.** A conexão com o WhatsApp só enfileira e segue recebendo — nunca fica esperando banco ou fila responder.
3. **Idempotência.** Cada mensagem do WhatsApp tem um id único, usado como `jobId` — se a Baileys entregar o mesmo evento duas vezes (acontece na prática), o bot não processa a mesma mensagem duas vezes.
4. **Sobrevive a reinício.** Por estar em Redis, não na memória do processo, o cliente não perde o passo em que estava numa reinicialização do bot.

## Consequências

- Redis vira uma dependência de infraestrutura obrigatória (antes seria só o WhatsApp + o banco). É justamente a peça que precisa ser compartilhada se um dia mais de uma instância do processo rodar — o multi-tenant (ver [ADR 6](0006-multi-tenant-compartilhado.md)) já nasce compatível com isso.
- Mensagens de negócios diferentes passam pela mesma fila e mesmo worker, tagueadas por `negocioId` — simplicidade operacional em troca de não ter isolamento de fila por tenant (documentado e aceito em [ADR 6](0006-multi-tenant-compartilhado.md)).
- Testar esse caminho exige infraestrutura real — por isso existe `scripts/smoke-e2e.ts`, rodado manualmente (`npm run smoke`) contra um Redis de verdade, fora da suíte automatizada (que testa a máquina de estados isolada, ver [ADR 1](0001-arquitetura-hexagonal.md)).
