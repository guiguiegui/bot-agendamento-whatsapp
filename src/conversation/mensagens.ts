import type { FaixaHorario } from "../domain/businessHours.js";
import type { ServicoNegocio } from "../domain/negocio.js";
import type { MotivoRecusa } from "../domain/scheduling.js";
import { buscarServico, formatarPreco } from "../domain/services.js";
import { formatarDataCurta, formatarHora } from "../utils/formato.js";
import type { AgendamentoResumo } from "./ports.js";

export function textoMenu(nomeNegocio: string): string {
  return [
    `Olá! 💈 Aqui é o assistente da *${nomeNegocio}*.`,
    "",
    "1. Agendar horário",
    "2. Meus agendamentos",
    "3. Cancelar agendamento",
    "4. Serviços e preços",
    "5. Horário de funcionamento",
    "6. Falar com um atendente",
    "",
    "Responda só com o número da opção.",
  ].join("\n");
}

export function textoListaServicos(catalogo: ServicoNegocio[]): string {
  const linhas = catalogo.map(
    (s, i) => `${i + 1}. ${s.nome} — ${formatarPreco(s.precoCentavos)} (${s.duracaoMin} min)`,
  );
  return `Qual serviço você quer agendar?\n\n${linhas.join("\n")}\n\n0. Voltar ao menu`;
}

export function textoListaHorarios(horarios: Date[], servico: ServicoNegocio): string {
  const linhas = horarios.map((h, i) => `${i + 1}. ${formatarHora(h)}`);
  const primeiro = horarios[0];
  const dataFormatada = primeiro ? formatarDataCurta(primeiro) : "";
  return [
    `Horários livres para *${servico.nome}* em ${dataFormatada}:`,
    "",
    linhas.join("\n"),
    "",
    "Responda com o número do horário, ou 0 para escolher outra data.",
  ].join("\n");
}

export function textoCatalogo(catalogo: ServicoNegocio[]): string {
  const linhas = catalogo.map((s) => `• ${s.nome} — ${formatarPreco(s.precoCentavos)}`);
  return `Nossos serviços:\n\n${linhas.join("\n")}`;
}

const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function textoHorarioFuncionamento(horarioFuncionamento: Record<number, FaixaHorario | null>): string {
  const linhas = NOMES_DIA.map((nome, i) => {
    const faixa = horarioFuncionamento[i];
    const horario = faixa
      ? `${String(faixa.abreHora).padStart(2, "0")}h às ${String(faixa.fechaHora).padStart(2, "0")}h`
      : "Fechado";
    return `${nome}: ${horario}`;
  });
  return `Horário de funcionamento:\n\n${linhas.join("\n")}`;
}

/** Mensagem específica pra cada motivo de recusa de `tentarAgendar` — ver domain/scheduling.ts. */
export function textoMotivoRecusa(motivo: MotivoRecusa): string {
  switch (motivo) {
    case "no_passado":
      return "Esse horário já passou.";
    case "fora_da_janela":
      return "Esse horário está fora do período em que aceitamos agendamento.";
    case "fora_do_horario":
      return "Esse horário está fora do nosso expediente.";
    case "conflito_de_horario":
      return "Esse horário acabou de ser ocupado.";
    default: {
      // Checagem de exaustividade: se um motivo novo for adicionado em
      // domain/scheduling.ts e esquecerem de tratar aqui, isso não compila.
      const _exaustivo: never = motivo;
      throw new Error(`Motivo de recusa não tratado: ${String(_exaustivo)}`);
    }
  }
}

export function textoListaAgendamentos(agendamentos: AgendamentoResumo[], catalogo: ServicoNegocio[]): string {
  const linhas = agendamentos.map((a, i) => {
    const servico = buscarServico(catalogo, a.servico);
    return `${i + 1}. ${servico?.nome ?? a.servico} — ${formatarDataCurta(a.inicio)} às ${formatarHora(a.inicio)}`;
  });
  return `Seus próximos agendamentos:\n\n${linhas.join("\n")}`;
}
