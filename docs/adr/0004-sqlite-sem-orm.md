# 4. SQLite direto, sem ORM

Data: 2026-09-27 (retroativa — decisão já existia desde o commit inicial do projeto)

## Status

Aceita

## Contexto

Persistir agendamentos e clientes exige algum banco de dados. As opções comuns nesse porte de projeto são um Postgres/MySQL gerenciado (com ou sem ORM) ou SQLite embutido. A escala real desse bot é pequenos negócios (barbearias, salões, clínicas) — volume de escrita e leitura baixo, e (até o multi-tenant, ver [ADR 6](0006-multi-tenant-compartilhado.md)) uma instância por cliente.

## Decisão

Persistência é SQLite direto via `better-sqlite3` (síncrono, sem overhead de round-trip de rede por query), sem ORM — SQL escrito à mão em `src/db/agendaRepository.ts`/`src/db/negocioRepository.ts`, com um sistema de migração versionada caseiro (`src/db/migrationRunner.ts` + `src/db/migrations/`) no lugar de um ORM de migração.

## Consequências

- Uma peça a menos de infraestrutura pra manter no ar — não precisa de um Postgres separado rodando ao lado, nem de credenciais/rede adicional. Backup é copiar um arquivo.
- Multi-tenant (várias empresas, [ADR 6](0006-multi-tenant-compartilhado.md)) continua sendo **um arquivo só**, com isolamento lógico via coluna `negocio_id`, não um banco por tenant — decisão consistente com "menos infraestrutura pra manter", mas significa que um problema no arquivo afeta todos os negócios daquela instância.
- Sem ORM, cada query é escrita à mão e cada mudança de schema passa por uma migração explícita — mais verboso que um ORM com migration automática, mas dá controle total sobre o SQL gerado (relevante quando `ON CONFLICT` e recriação de tabela entram em jogo, como na correção da constraint de `clientes` na migração `0003`).
- Se o volume ou a necessidade de acesso concorrente de escrita crescerem além do que SQLite aguenta bem, a migração pra Postgres exigiria reescrever a camada de repositório (`AgendaRepositorySqlite`) — mas não tocaria no domínio nem na conversa, pelo desenho de portas ([ADR 1](0001-arquitetura-hexagonal.md)).
