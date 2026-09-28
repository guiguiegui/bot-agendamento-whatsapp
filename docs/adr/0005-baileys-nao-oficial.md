# 5. Baileys (WhatsApp Web não-oficial) em vez da API oficial da Meta

Data: 2026-09-27 (retroativa — decisão já existia desde o commit inicial do projeto)

## Status

Aceita

## Contexto

Existem duas formas de um bot conversar por WhatsApp: a [API oficial da Meta (Cloud API)](https://developers.facebook.com/docs/whatsapp/cloud-api), que exige aprovação de Business Manager e (tipicamente) um número dedicado registrado com a Meta; ou uma biblioteca que emula um cliente WhatsApp Web, conectando via QR code como um "aparelho conectado" — engenharia reversa não-oficial do protocolo.

## Decisão

O projeto usa [Baileys](https://github.com/WhiskeySockets/Baileys) (`src/whatsapp/client.ts`), que conecta via QR code. Pra um negócio pequeno validando a ideia, é o caminho mais rápido e sem custo: não precisa de aprovação de Business Manager nem número dedicado da Meta — o dono do negócio escaneia o QR com o número que já usa.

## Consequências

- A troca é que é uma engenharia reversa não-oficial: o WhatsApp pode, em teoria, banir o número por automação. Na prática, uso moderado (um número dedicado ao negócio, sem disparo em massa) é o padrão usado por boa parte do mercado de automação pra pequenos negócios no Brasil hoje — mas é um risco real, não hipotético, que precisa ser comunicado ao dono do negócio.
- A camada `IMessagingClient` (`src/whatsapp/types.ts`, ver [ADR 1](0001-arquitetura-hexagonal.md)) foi desenhada exatamente pra isolar essa escolha: trocar `BaileysMessagingClient` por uma implementação sobre a Cloud API oficial não muda uma linha da lógica de conversa ou de agendamento — é o caminho de upgrade quando o volume ou a necessidade de garantia contratual justificar.
- No multi-tenant ([ADR 6](0006-multi-tenant-compartilhado.md)), cada negócio tem sua própria conexão Baileys (própria pasta de sessão) — o risco de banimento é por número/negócio, não compartilhado entre todos os negócios da mesma instância.
