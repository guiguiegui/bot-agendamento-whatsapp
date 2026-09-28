# Bot de Agendamento via WhatsApp — Barba & Ofício

Bot de atendimento e agendamento por WhatsApp para pequenos negócios (barbearias, salões, clínicas). Projeto de portfólio — mesmo cliente fictício da [landing page](../barbearia.html), pra mostrar o pacote completo: site + automação de atendimento.

Não é um bot de palavra-chave. É uma máquina de estados de verdade, com fila assíncrona, banco de dados, testes automatizados (29 testes, incluindo um teste de ponta a ponta contra Redis real) e arquitetura pensada pra rodar em produção, não só pra demo.

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

A lógica de conversa (`src/conversation/router.ts`) e as regras de agendamento (`src/domain/scheduling.ts`) **não sabem que o WhatsApp existe**. Elas recebem uma interface (`AgendaPort`) e são 100% testáveis sem subir banco, fila ou conexão nenhuma — é por isso que dá pra ter 29 testes rodando em ~1 segundo. A pasta `src/whatsapp` e `src/queue` são as únicas que conhecem infraestrutura de verdade.

## Por que essas escolhas técnicas

- **SQLite direto (`better-sqlite3`), sem ORM**: esse bot roda numa instância só, pra um negócio só. Um ORM ou um Postgres separado seria mais uma peça pra manter no ar sem nenhum ganho real nessa escala. `better-sqlite3` é síncrono (sem overhead de round-trip) e o banco inteiro é um arquivo — backup é copiar um arquivo.
- **Redis + BullMQ pra fila e sessão**: é a peça que realmente precisa ser compartilhada se um dia rodar mais de uma instância, e já vem pronta pra isso.
- **Máquina de estados explícita, não regex solto**: cada conversa tem um estado bem definido (`MENU`, `AGENDAR_DATA`, etc.), então "o que esse número '1' significa" nunca é ambíguo — depende só do estado atual, testado isoladamente.

### Sobre a biblioteca do WhatsApp

Este projeto usa [Baileys](https://github.com/WhiskeySockets/Baileys), que conecta como um WhatsApp Web (escaneando QR code) — **não é a API oficial da Meta**. Pra um negócio pequeno validando a ideia, isso é o caminho mais rápido e sem custo: não precisa de aprovação de Business Manager nem número dedicado da Meta. A troca é que é uma engenharia reversa não-oficial: o WhatsApp pode, em teoria, banir o número por automação. Na prática, uso moderado (um número dedicado ao negócio, sem disparo em massa) é o padrão usado por boa parte do mercado de automação pra pequenos negócios no Brasil hoje.

**Caminho de upgrade**: se o volume crescer ou o cliente precisar de garantia contratual, a camada `IMessagingClient` (`src/whatsapp/types.ts`) foi desenhada exatamente pra isso — trocar `BaileysMessagingClient` por uma implementação sobre a [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) oficial não muda uma linha da lógica de conversa ou de agendamento.

## Rodando localmente

Pré-requisitos: Node 20+, um Redis (local ou Docker).

```bash
npm install
cp .env.example .env      # ajuste os valores se quiser
npm run dev                # sobe o bot em modo desenvolvimento
```

Na primeira execução, um QR code aparece no terminal — escaneie com o WhatsApp do número do negócio (**Aparelhos conectados → Conectar um aparelho**). As credenciais ficam salvas em `WHATSAPP_AUTH_DIR`, então não precisa escanear de novo nas próximas vezes.

### Com Docker

```bash
cp .env.example .env
docker compose up -d
docker compose logs -f bot   # pra ver o QR code na primeira conexão
```

## Testes

```bash
npm run typecheck   # TypeScript em modo estrito
npm test            # 29 testes: regras de agendamento, máquina de estados, SQLite
npm run smoke       # opcional: fluxo completo contra um Redis local de verdade
```

O `smoke` roda o mesmo caminho que um cliente real percorreria (menu → escolher serviço → escolher data → escolher horário → confirmação), mas passando pela fila e pelo Redis de verdade, só trocando o WhatsApp por um cliente falso que guarda as mensagens enviadas — é o mais perto de um teste real sem precisar de um número de WhatsApp conectado.

## Adaptando para um cliente de verdade

Tudo que muda de um negócio pro outro está isolado em `src/domain/`:

| O que mudar | Onde |
|---|---|
| Nome do negócio, textos do menu | `src/conversation/mensagens.ts` |
| Catálogo de serviços, preços, duração | `src/domain/services.ts` |
| Horário de funcionamento | `src/domain/businessHours.ts` |
| Antecedência mínima de cancelamento, janela de agendamento | `src/domain/businessHours.ts` |
| Números com acesso a comandos de admin | `.env` → `ADMIN_PHONE_NUMBERS` |

Nenhuma dessas mudanças toca na máquina de estados, na fila ou no banco.

## Estrutura do projeto

```
src/
  domain/         regras de negócio puras (agendamento, catálogo, horários) — sem I/O
  conversation/    máquina de estados da conversa + textos + porta (interface) pro banco
  db/              SQLite: schema, conexão, repositório que implementa a porta
  queue/           fila (BullMQ), worker, sessão da conversa no Redis
  whatsapp/        adaptador Baileys + interface de mensageria
  commands/        comandos administrativos (fora do fluxo do cliente)
test/              testes unitários e de integração (SQLite real)
scripts/           smoke test de ponta a ponta (fila + Redis reais)
```

---

Projeto de portfólio desenvolvido por Guilherme Sousa. Negócio, endereço e dados de contato são fictícios.
