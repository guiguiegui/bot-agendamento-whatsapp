import type { AgendamentoResumo } from "../conversation/ports.js";
import type { FaixaHorario } from "../domain/businessHours.js";
import type { ServicoNegocio } from "../domain/negocio.js";
import type { MotivoRecusa } from "../domain/scheduling.js";

/**
 * Contrato que qualquer arquivo de idioma (ex: pt-BR.ts) precisa implementar.
 * Adicionar um idioma novo é criar um arquivo que satisfaça esta interface —
 * sem precisar tocar em router.ts nem nos casos de uso (ver ADR 8).
 *
 * Onde uma mensagem hoje é composta de duas frases com palavras de ligação
 * (ex: motivo de recusa + "e não sobrou outro horário"), a composição
 * inteira é uma função só — pra um idioma diferente poder reescrever a
 * frase completa, não só encaixar partes traduzidas numa ordem fixa.
 */
export interface Mensagens {
  menu(nomeNegocio: string): string;
  listaServicos(catalogo: ServicoNegocio[]): string;
  listaHorarios(horarios: Date[], servico: ServicoNegocio): string;
  catalogo(catalogo: ServicoNegocio[]): string;
  horarioFuncionamento(horarioFuncionamento: Record<number, FaixaHorario | null>): string;
  motivoRecusa(motivo: MotivoRecusa): string;
  listaAgendamentos(agendamentos: AgendamentoResumo[], catalogo: ServicoNegocio[]): string;

  opcaoInvalida(): string;
  semAgendamentoMarcado(): string;
  semAgendamentoParaCancelar(): string;
  escolhaParaCancelar(): string;
  atendenteHumano(): string;
  servicoNaoEncontrado(): string;
  servicoEscolhido(nomeServico: string): string;
  contextoPerdido(): string;
  dataNaoReconhecida(): string;
  semHorarioLivreNoDia(): string;
  escolhaHorarioInvalido(): string;
  semOutroHorarioNoDia(motivo: string): string;
  horariosAtualizados(motivo: string, listaHorariosFormatada: string): string;
  agendamentoConfirmado(nomeServico: string, idCurto: string, nomeNegocio: string): string;
  escolhaCancelamentoInvalido(): string;
  agendamentoNaoEncontrado(): string;
  antecedenciaInsuficiente(antecedenciaMinimaHoras: number): string;
  agendamentoCancelado(): string;
}
