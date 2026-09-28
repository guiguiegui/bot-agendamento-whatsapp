# Bot de Agendamento via WhatsApp — Barba & Ofício

[![CI](https://github.com/guiguiegui/bot-agendamento-whatsapp/actions/workflows/ci.yml/badge.svg)](https://github.com/guiguiegui/bot-agendamento-whatsapp/actions/workflows/ci.yml)

Bot de atendimento e agendamento por WhatsApp para pequenos negócios (barbearias, salões, clínicas). Projeto de portfólio — mesmo cliente fictício da [landing page](../barbearia.html), pra mostrar o pacote completo: site + automação de atendimento.

Não é um bot de palavra-chave. É uma máquina de estados de verdade, com fila assíncrona, banco de dados, multi-tenant de verdade (vários negócios, cada um com seu WhatsApp, na mesma instância), 113 testes automatizados (mais um smoke test opcional de ponta a ponta contra Redis real, `npm run smoke`) e arquitetura pensada pra rodar em produção, não só pra demo.

## O que ele faz

- **Agenda horários de verdade**: consulta a agenda, calcula os horários realmente livres (respeitando duração de cada serviço e horário de funcionamento) e confirma o agendamento — sem overbooking.
- **Evita corrida de horário**: se dois clientes tentam pegar o mesmo horário ao mesmo tempo, o segundo recebe a lista atualizada automaticamente em vez de "roubar" a vaga do primeiro (ver `test/router.test.ts`, teste "reoferece horários...").
- **Cancela com regra de negócio**: respeita uma antecedência mínima configurável antes do horário marcado.
- **Passa a conversa pra um humano**: o dono do negócio pode assumir a conversa a qualquer momento (o bot fica em silêncio até o cliente digitar "menu" de novo).
- **Comando de admin**: o número do dono manda `/hoje` e recebe a agenda do dia, direto no WhatsApp.
- **Sobrevive a reinício**: o estado de cada conversa fica no Redis, não na memória do processo — reiniciar o bot não faz o cliente perder o passo em que estava.

## Arquitetura

```
WhatsApp  →  Baileys (conexão)  →  Fila (BullMQ/Redis)  →  Worker
                                                              │
                                                              ▼
                                          Máquina de estados (router.ts)
                                                              │
                                              ┌───────────────┴───────────────┐
                                              ▼                               ▼
                                    Regras de negócio puras           Sessão da conversa
                                    (domain/scheduling.ts)                 (Redis)
                                              │
                                              ▼
                                     SQLite (agendaRepository.ts)
```

A mensagem recebida vira um **job na fila** em vez de ser processada na hora. Isso não é over-engineering: é o que dá três garantias que um script simples de `if/else` não tem —

1. **Nada se perde.** Se o processamento falhar (banco fora do ar por um segundo, por exemplo), o BullMQ tenta de novo sozinho em vez de a mensagem simplesmente sumir.
2. **Não trava o recebimento.** A conexão com o WhatsApp nunca fica esperando o banco responder — ela só enfileira e segue recebendo.
3. **Idempotência.** Cada mensagem do WhatsApp tem um id único, usado como `jobId` — se a Baileys entregar o mesmo evento duas vezes (acontece), o bot não processa a mesma mensagem duplicada.

A lógica de conversa (`src/conversation/router.ts`) e as regras de agendamento (`src/domain/scheduling.ts`) **não sabem que o WhatsApp existe**. Elas recebem uma interface (`AgendaPort`) e são 100% testáveis sem subir banco, fila ou conexão nenhuma — é por isso que dá pra ter 113 testes rodando em poucos segundos. A pasta `src/whatsapp` e `src/queue` são as únicas que conhecem infraestrutura de verdade (ver [ADR 1](docs/adr/0001-arquitetura-hexagonal.md)).

## Por que essas escolhas técnicas

Resumo rápido — o raciocínio completo de cada uma está nos [ADRs](docs/adr/README.md):

- **Multi-tenant numa instância só, sem microsserviço por cliente** ([ADR 6](docs/adr/0006-multi-tenant-compartilhado.md)): cada negócio cadastrado (tabela `negocios`) tem sua própria conexão WhatsApp, catálogo, horário e política de cancelamento — isolados por `negocio_id` no banco — mas compartilham a mesma fila, worker e processo. Adicionar um negócio novo não exige subir infraestrutura nova (ver `## Cadastrando um negócio novo`).
- **SQLite direto (`better-sqlite3`), sem ORM** ([ADR 4](docs/adr/0004-sqlite-sem-orm.md)): um Postgres separado seria mais uma peça pra manter no ar sem ganho real na escala de pequenos negócios que esse bot atende — mesmo com vários negócios, ainda é um arquivo só, com isolamento lógico (coluna), não físico. `better-sqlite3` é síncrono (sem overhead de round-trip) e backup é copiar um arquivo.
- **Redis + BullMQ pra fila e sessão** ([ADR 3](docs/adr/0003-fila-assincrona-bullmq-redis.md)): é a peça que realmente precisa ser compartilhada se um dia rodar mais de uma instância do bot, e já vem pronta pra isso.
- **Máquina de estados explícita, não regex solto** ([ADR 2](docs/adr/0002-maquina-de-estados-explicita.md)): cada conversa tem um estado bem definido (`MENU`, `AGENDAR_DATA`, etc.), então "o que esse número '1' significa" nunca é ambíguo — depende só do estado atual, testado isoladamente.

### Sobre a biblioteca do WhatsApp ([ADR 5](docs/adr/0005-baileys-nao-oficial.md))

Este projeto usa [Baileys](https://github.com/WhiskeySockets/Baileys), que conecta como um WhatsApp Web (escaneando QR code) — **não é a API oficial da Meta**. Pra um negócio pequeno validando a ideia, isso é o caminho mais rápido e sem custo: não precisa de aprovação de Business Manager nem número dedicado da Meta. A troca é que é uma engenharia reversa não-oficial: o WhatsApp pode, em teoria, banir o número por automação. Na prática, uso moderado (um número dedicado ao negócio, sem disparo em massa) é o padrão usado por boa parte do mercado de automação pra pequenos negócios no Brasil hoje.

**Caminho de upgrade**: se o volume crescer ou o cliente precisar de garantia contratual, a camada `IMessagingClient` (`src/whatsapp/types.ts`) foi desenhada exatamente pra isso — trocar `BaileysMessagingClient` por uma implementação sobre a [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) oficial não muda uma linha da lógica de conversa ou de agendamento.

## Rodando localmente

Pré-requisitos: Node 22+, um Redis (local ou Docker).

```bash
npm install
cp .env.example .env      # ajuste os valores se quiser
npm run dev                # sobe o bot em modo desenvolvimento
```

Na primeira execução, um QR code aparece no terminal pra cada negócio ativo cadastrado (recém-instalado, só o negócio de exemplo) — escaneie com o WhatsApp do número correspondente (**Aparelhos conectados → Conectar um aparelho**). As credenciais ficam salvas na pasta configurada em `whatsapp_auth_dir` daquele negócio (ver `## Cadastrando um negócio novo`), então não precisa escanear de novo nas próximas vezes.

### Com Docker

```bash
cp .env.example .env
docker compose up -d
docker compose logs -f bot   # pra ver o QR code na primeira conexão
```

O container expõe um `HEALTHCHECK` (`docker ps` mostra o status) e o bot serve `GET /health` (200 se banco e Redis estão respondendo, 503 senão) e `GET /metrics` (mensagens processadas, latência, contagem da fila) na porta `HEALTH_PORT` (padrão `3000`, configurável no `.env`).

## Testes

```bash
npm run typecheck   # TypeScript em modo estrito
npm test            # 113 testes: regras de agendamento, máquina de estados, SQLite, migrações, isolamento entre negócios
npm run smoke       # opcional: fluxo completo contra um Redis local de verdade
```

O `smoke` roda o mesmo caminho que um cliente real percorreria (menu → escolher serviço → escolher data → escolher horário → confirmação), mas passando pela fila e pelo Redis de verdade, só trocando o WhatsApp por um cliente falso que guarda as mensagens enviadas — é o mais perto de um teste real sem precisar de um número de WhatsApp conectado.

## Cadastrando um negócio novo

Cada negócio (catálogo, horário, política de cancelamento, números de admin, WhatsApp próprio) é uma linha na tabela `negocios` — não é mais código. Não há UI de administração, então o cadastro é feito por um CLI:

```bash
# 1. copie o template e ajuste os valores pro negócio novo
cp negocio.exemplo.json meu-negocio.json

# 2. cadastre (id é o identificador único do negócio — usado em logs e paths)
npm run negocio -- criar --id meu-negocio --config meu-negocio.json

# 3. reinicie o bot — ele carrega os negócios ativos no boot e sobe uma conexão
#    WhatsApp nova (um QR code novo pra escanear) pra cada um
npm run dev
```

Outros comandos:

```bash
npm run negocio -- listar               # todos os negócios, ativos e inativos
npm run negocio -- desativar --id <id>  # para de atender por esse negócio (não deleta o histórico)
```

Importante: `whatsappAuthDir` no JSON precisa apontar pra um subdiretório dentro de `./data/` (ex: `./data/auth-meu-negocio`) — é o volume que o Docker já monta; fora dele, a sessão do WhatsApp não sobrevive a um restart do container.

Nenhum desses passos toca na máquina de estados, na fila ou no código — é só dado.

## Estrutura do projeto

```
src/
  domain/         regras de negócio puras (agendamento, catálogo, horários, negócio) — sem I/O
  conversation/    máquina de estados da conversa + textos + porta (interface) pro banco
  db/              SQLite: migrações, conexão, repositórios que implementam as portas
  queue/           fila (BullMQ), worker (dispatch por negócio), sessão da conversa no Redis
  whatsapp/        adaptador Baileys + interface de mensageria (uma instância por negócio)
  commands/        comandos administrativos (fora do fluxo do cliente)
test/              testes unitários e de integração (SQLite real)
scripts/           smoke test de ponta a ponta (fila + Redis reais) e o CLI de negócios
docs/adr/          decisões arquiteturais (contexto, decisão, consequências)
```

Por que cada escolha técnica foi feita — com mais detalhe do que cabe neste README — está registrado como [Architecture Decision Records em `docs/adr/`](docs/adr/README.md).

---

Projeto de portfólio desenvolvido por Guilherme Sousa. Negócio, endereço e dados de contato são fictícios.
