# 6. Multi-tenant numa instância só, fila/worker compartilhados

Data: 2026-09-28

## Status

Aceita

## Contexto

O projeto nasceu servindo um negócio só, com catálogo de serviços e horário de funcionamento hardcoded em TypeScript (`domain/services.ts`, `domain/businessHours.ts`). Isso travava o modelo em "um fork por cliente": atender um segundo negócio exigia copiar o repositório inteiro. A decisão de produto foi ir de multi-tenant de verdade — vários negócios, cada um com seu próprio número de WhatsApp, rodando na mesma instância — não só separar configuração de código.

Duas perguntas de design precisavam de resposta: onde mora o limite de isolamento entre negócios (banco? processo? fila?), e se cada negócio deveria ter sua própria fila/worker ou se esses recursos deveriam ser compartilhados.

## Decisão

Implementado em 4 fases incrementais, cada uma seu PR:

1. **Fase A** ([PR #3](https://github.com/guiguiegui/bot-agendamento-whatsapp/pull/3)): tabela `negocios` — cada negócio é uma linha, com catálogo/horário/política de cancelamento como dados (JSON), não código. Sistema de migração versionada criado como pré-requisito (não existia antes).
2. **Fase B** ([PR #4](https://github.com/guiguiegui/bot-agendamento-whatsapp/pull/4)): domínio e conversa passam a receber essa configuração como parâmetro explícito em vez de importar constante global.
3. **Fase C** ([PR #5](https://github.com/guiguiegui/bot-agendamento-whatsapp/pull/5)): `AgendaRepositorySqlite` escopado por `negocio_id` em toda query (isolamento lógico, mesmo arquivo SQLite pra todos os negócios — ver [ADR 4](0004-sqlite-sem-orm.md)); `index.ts` instancia uma conexão Baileys por negócio ativo (isolamento físico da conexão WhatsApp — ver [ADR 5](0005-baileys-nao-oficial.md)).
4. **Fase D** ([PR #6](https://github.com/guiguiegui/bot-agendamento-whatsapp/pull/6)): CLI (`npm run negocio`) pra cadastrar/listar/desativar negócio, já que não existe UI de administração.

**Fila e worker continuam compartilhados** entre todos os negócios — um `Worker` só, jobs tagueados por `negocioId` (ver [ADR 3](0003-fila-assincrona-bullmq-redis.md)), em vez de uma fila por negócio. Simplicidade operacional escolhida deliberadamente: na escala de pequenos negócios que esse bot atende, não há benefício real em multiplicar filas/workers, só mais peças pra monitorar.

## Consequências

- Isolamento de dados é por coluna (`negocio_id`), não por arquivo/banco — mais simples de operar, mas significa que um bug numa query que esqueça o filtro por negócio é um vazamento de dados entre clientes, não um erro isolado. Coberto por teste dedicado de isolamento (`test/agendaRepository.test.ts`, casos com o mesmo telefone em dois negócios).
- Isolamento de conexão WhatsApp é físico (uma conexão Baileys por negócio, própria pasta de sessão) — o risco de banimento discutido na [ADR 5](0005-baileys-nao-oficial.md) fica contido a um negócio, não vaza pros outros.
- Fila/worker compartilhados significam que um pico de mensagens de um negócio consome capacidade de processamento que os outros negócios também usam (`concurrency: 5` é do worker inteiro, não por negócio). Aceitável na escala atual; se isso virar gargalo real, é uma mudança contida em `queue/`/`worker.ts` — não exige tocar domínio, conversa ou repositório (mesma garantia da [ADR 1](0001-arquitetura-hexagonal.md)).
- Cadastrar um negócio novo hoje é só dado (`npm run negocio -- criar`), sem exigir subir infraestrutura nova nem fazer deploy — mas ainda exige acesso de linha de comando ao servidor (não há UI de administração).
