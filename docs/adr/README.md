# Architecture Decision Records

Registro das decisões arquiteturais deste projeto, no formato [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): contexto, decisão, consequências. A maioria dessas decisões já era explicada em prosa no [README](../../README.md) — este diretório as formaliza num formato padrão, com o histórico de quando e por quê cada uma foi tomada.

Uma ADR não é atualizada depois de aceita — se uma decisão muda, cria-se uma ADR nova marcando a antiga como substituída.

| # | Título | Status |
|---|---|---|
| [0001](0001-arquitetura-hexagonal.md) | Arquitetura hexagonal (portas) pra desacoplar domínio de infraestrutura | Aceita |
| [0002](0002-maquina-de-estados-explicita.md) | Máquina de estados explícita pra conversa | Aceita |
| [0003](0003-fila-assincrona-bullmq-redis.md) | Fila assíncrona com BullMQ/Redis em vez de processamento direto | Aceita |
| [0004](0004-sqlite-sem-orm.md) | SQLite direto, sem ORM | Aceita |
| [0005](0005-baileys-nao-oficial.md) | Baileys (WhatsApp Web não-oficial) em vez da API oficial da Meta | Aceita |
| [0006](0006-multi-tenant-compartilhado.md) | Multi-tenant numa instância só, fila/worker compartilhados | Aceita |
| [0007](0007-camada-de-casos-de-uso.md) | Camada de casos de uso separada da máquina de estados | Aceita |
