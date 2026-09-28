import { HORARIO_FUNCIONAMENTO } from "../domain/businessHours.js";
import { CATALOGO_SERVICOS, type Servico, buscarServico, formatarPreco } from "../domain/services.js";
import { formatarDataCurta, formatarHora } from "../utils/formato.js";
import type { AgendamentoResumo } from "./ports.js";

export const MENU_TEXTO = [
  "Olá! 💈 Aqui é o assistente da *Barba & Ofício*.",
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

export function textoListaServicos(): string {
  const linhas = CATALOGO_SERVICOS.map(
    (s, i) => `${i + 1}. ${s.nome} — ${formatarPreco(s.precoCentavos)} (${s.duracaoMin} min)`,
  );
  return `Qual serviço você quer agendar?\n\n${linhas.join("\n")}\n\n0. Voltar ao menu`;
}

export function textoListaHorarios(horarios: Date[], servico: Servico): string {
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

export function textoCatalogo(): string {
  const linhas = CATALOGO_SERVICOS.map((s) => `• ${s.nome} — ${formatarPreco(s.precoCentavos)}`);
  return `Nossos serviços:\n\n${linhas.join("\n")}`;
}

const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function textoHorarioFuncionamento(): string {
  const linhas = NOMES_DIA.map((nome, i) => {
    const faixa = HORARIO_FUNCIONAMENTO[i];
    const horario = faixa
      ? `${String(faixa.abreHora).padStart(2, "0")}h às ${String(faixa.fechaHora).padStart(2, "0")}h`
      : "Fechado";
    return `${nome}: ${horario}`;
  });
  return `Horário de funcionamento:\n\n${linhas.join("\n")}`;
}

export function textoListaAgendamentos(agendamentos: AgendamentoResumo[]): string {
  const linhas = agendamentos.map((a, i) => {
    const servico = buscarServico(a.servico);
    return `${i + 1}. ${servico?.nome ?? a.servico} — ${formatarDataCurta(a.inicio)} às ${formatarHora(a.inicio)}`;
  });
  return `Seus próximos agendamentos:\n\n${linhas.join("\n")}`;
}
