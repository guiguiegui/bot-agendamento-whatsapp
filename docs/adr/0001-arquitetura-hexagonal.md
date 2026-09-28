# 1. Arquitetura hexagonal (portas) pra desacoplar domínio de infraestrutura

Data: 2026-09-27 (retroativa — decisão já existia desde o commit inicial do projeto)

## Status

Aceita

## Contexto

A lógica de agendamento (regras de negócio) e a máquina de estados da conversa precisam ser testadas exaustivamente — são elas que decidem se um horário pode ser confirmado, se um cancelamento é aceito, o que responder em cada estado da conversa. Testar isso subindo WhatsApp, Redis e SQLite de verdade a cada `it()` tornaria a suíte lenta e frágil (depende de infraestrutura externa pra rodar), e desencorajaria escrever teste pra cada caso de borda.

## Decisão

`src/conversation/router.ts` e todo `src/domain/` não importam nada de `src/whatsapp` ou `src/db` diretamente. Eles dependem só de interfaces (`AgendaPort`, `RelatorioPort`, definidas em `src/conversation/ports.ts`) — em produção, implementadas por `AgendaRepositorySqlite` sobre SQLite; nos testes, por um fake em memória (`test/fakes/agendaPortFake.ts`). O mesmo vale pro lado do WhatsApp: `IMessagingClient` (`src/whatsapp/types.ts`) abstrai "enviar uma mensagem pra alguém", implementado por `BaileysMessagingClient` em produção.

Essa fronteira é verificada continuamente por um teste de contrato (`test/agendaPort.contrato.test.ts`) que roda a mesma bateria de casos contra a implementação real e o fake, garantindo que os dois se comportem de forma equivalente do ponto de vista de quem consome a porta.

## Consequências

- O grosso da lógica (domínio + conversa) é testável sem infraestrutura nenhuma — a suíte inteira roda em poucos segundos.
- Trocar a implementação de persistência ou de mensageria não exige tocar em `router.ts` ou `domain/` — foi exatamente esse desenho que permitiu, mais tarde, trocar `AgendaRepositorySqlite` por uma versão escopada por `negocio_id` (ver [ADR 6](0006-multi-tenant-compartilhado.md)) sem alterar uma linha da máquina de estados.
- Custo: uma camada de indireção a mais (interface + duas implementações) pra manter em sincronia — mitigado pelo teste de contrato.
