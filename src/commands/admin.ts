import type { RelatorioPort } from "../conversation/ports.js";
import type { ServicoNegocio } from "../domain/negocio.js";
import { buscarServico } from "../domain/services.js";
import { formatarHora } from "../utils/formato.js";

export async function textoResumoDoDia(
  relatorios: RelatorioPort,
  catalogo: ServicoNegocio[],
  data: Date = new Date(),
): Promise<string> {
  const agendamentos = await relatorios.listarResumoDoDia(data);
  if (agendamentos.length === 0) return "Nenhum agendamento para hoje.";

  const linhas = agendamentos.map(
    (a) => `${formatarHora(a.inicio)} — ${buscarServico(catalogo, a.servico)?.nome ?? a.servico} (${a.telefone})`,
  );
  return `📋 Agenda de hoje (${linhas.length}):\n\n${linhas.join("\n")}`;
}

/**
 * Comandos restritos ao(s) número(s) do dono do negócio (ver Negocio.numerosAdmin).
 * Ficam fora da máquina de estados do cliente de propósito — são uma ferramenta
 * operacional, não uma etapa de conversa com quem quer agendar um horário.
 */
export async function processarComandoAdmin(
  texto: string,
  relatorios: RelatorioPort,
  catalogo: ServicoNegocio[],
): Promise<string | null> {
  const comando = texto.trim().toLowerCase();
  if (comando === "/hoje") return textoResumoDoDia(relatorios, catalogo, new Date());
  if (comando === "/ajuda" || comando === "/help") {
    return "Comandos disponíveis:\n/hoje — lista os agendamentos de hoje";
  }
  return null;
}
