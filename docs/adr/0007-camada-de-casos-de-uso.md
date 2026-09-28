# 7. Camada de casos de uso separada da máquina de estados

Data: 2026-09-28

## Status

Aceita

## Contexto

`src/conversation/router.ts` acumulava duas responsabilidades diferentes na mesma função: orquestrar a máquina de estados (ver [ADR 2](0002-maquina-de-estados-explicita.md)) — decidir o próximo `EstadoConversa` e qual mensagem mandar a partir do texto recebido — e decidir a regra de negócio em si, chamando o `AgendaPort` combinado com funções de domínio (`tentarAgendar`, `horariosDisponiveis`, `podeCancelar`) pra saber se um horário podia ser confirmado ou um cancelamento aceito.

Essa mistura tinha um custo concreto: não dava pra testar "o horário X é recusado por conflito" isoladamente da máquina de estados — só chegava nesse caso simulando texto (`"1"`, `"hoje"`, `"1"`) através de `processarMensagem`. Cada regra de negócio nova exigia entender o fluxo de conversa inteiro pra testar, mesmo quando a regra em si não tinha nada a ver com estado.

## Decisão

Casos de uso em `src/application/` — nova camada de topo, entre `domain/` (regras puras, sem I/O) e `conversation/` (máquina de estados, sem regra de negócio). Cada caso de uso é uma classe com construtor `(porta: AgendaPort)` e método `async executar(input): Promise<Resultado>`, onde `Resultado` é uma união discriminada (mesmo estilo já usado em `domain/scheduling.ts` com `ResultadoAgendamento`) — os casos de uso não sabem nada sobre texto, mensagem ou `EstadoConversa`.

Criados 4: `ConfirmarAgendamentoUseCase`, `CancelarAgendamentoUseCase`, `ListarHorariosDisponiveisUseCase`, `ListarAgendamentosDoClienteUseCase`. Só existem onde há de fato combinação de `AgendaPort` + domínio — handlers do router que são puramente estado/texto (escolha de serviço, opções do menu que só formatam texto, os escapes de "menu" e atendente humano) continuam no router, sem caso de uso correspondente.

`router.ts` passa a instanciar o caso de uso certo dentro de cada handler e traduzir o `Resultado` em mensagem (via `mensagens.ts`) + próximo estado — não chama mais `AgendaPort` nem funções de `domain/scheduling.ts` diretamente.

## Consequências

- Cada regra de negócio agora é testável em isolamento (`test/application/*.test.ts`, contra o mesmo `AgendaPortFake` já usado nos testes do router) — sem precisar simular texto/estado pra alcançar um caso de borda.
- `test/router.test.ts` não mudou uma linha durante essa refatoração e continua passando — prova que o comportamento observável (o que o bot responde pra quem manda mensagem) não mudou; ele vira o teste de equivalência da própria extração, e continua sendo o teste de contrato de wiring (estado → mensagem certa).
- Mais um nível de indireção pra manter em sincronia com a fronteira definida na [ADR 1](0001-arquitetura-hexagonal.md) — os casos de uso dependem só de `AgendaPort` (interface), nunca de uma implementação concreta, então a garantia de testabilidade sem infraestrutura se mantém.
- `src/conversation/ports.ts` continua onde está (não migrou pra `application/`) — é consumido por outros pontos do sistema (`commands/admin.ts`, `db/agendaRepository.ts`, `queue/worker.ts`) que não têm relação com essa extração; mover teria sido um diff mecânico sem ganho real.
