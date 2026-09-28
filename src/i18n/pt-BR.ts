import type { FaixaHorario } from "../domain/businessHours.js";
import { buscarServico, formatarPreco } from "../domain/services.js";
import { formatarDataCurta, formatarHora } from "../utils/formato.js";
import type { Mensagens } from "./types.js";

const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const mensagens: Mensagens = {
  menu(nomeNegocio) {
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
  },

  listaServicos(catalogo) {
    const linhas = catalogo.map(
      (s, i) => `${i + 1}. ${s.nome} — ${formatarPreco(s.precoCentavos)} (${s.duracaoMin} min)`,
    );
    return `Qual serviço você quer agendar?\n\n${linhas.join("\n")}\n\n0. Voltar ao menu`;
  },

  listaHorarios(horarios, servico) {
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
  },

  catalogo(catalogo) {
    const linhas = catalogo.map((s) => `• ${s.nome} — ${formatarPreco(s.precoCentavos)}`);
    return `Nossos serviços:\n\n${linhas.join("\n")}`;
  },

  horarioFuncionamento(horarioFuncionamento: Record<number, FaixaHorario | null>) {
    const linhas = NOMES_DIA.map((nome, i) => {
      const faixa = horarioFuncionamento[i];
      const horario = faixa
        ? `${String(faixa.abreHora).padStart(2, "0")}h às ${String(faixa.fechaHora).padStart(2, "0")}h`
        : "Fechado";
      return `${nome}: ${horario}`;
    });
    return `Horário de funcionamento:\n\n${linhas.join("\n")}`;
  },

  motivoRecusa(motivo) {
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
  },

  listaAgendamentos(agendamentos, catalogo) {
    const linhas = agendamentos.map((a, i) => {
      const servico = buscarServico(catalogo, a.servico);
      return `${i + 1}. ${servico?.nome ?? a.servico} — ${formatarDataCurta(a.inicio)} às ${formatarHora(a.inicio)}`;
    });
    return `Seus próximos agendamentos:\n\n${linhas.join("\n")}`;
  },

  opcaoInvalida() {
    return "Não entendi essa opção 🤔";
  },

  semAgendamentoMarcado() {
    return "Você não tem nenhum agendamento marcado no momento.";
  },

  semAgendamentoParaCancelar() {
    return "Você não tem nenhum agendamento pra cancelar.";
  },

  escolhaParaCancelar() {
    return "Responda com o número do que deseja cancelar, ou 0 para voltar.";
  },

  atendenteHumano() {
    return "Certo! Um atendente vai continuar a conversa por aqui. Se quiser voltar ao assistente automático a qualquer momento, é só digitar *menu*.";
  },

  servicoNaoEncontrado() {
    return "Não achei essa opção.";
  },

  servicoEscolhido(nomeServico) {
    return `Beleza, *${nomeServico}*. Pra quando você quer agendar? Responda "hoje", "amanhã" ou uma data (ex: 05/10).`;
  },

  contextoPerdido() {
    return "Foi mal, perdi o fio da meada. Vamos começar de novo?";
  },

  dataNaoReconhecida() {
    return 'Não entendi a data. Tente "hoje", "amanhã" ou o formato dd/mm (ex: 05/10).';
  },

  semHorarioLivreNoDia() {
    return "Não sobrou horário livre nesse dia pra esse serviço 😕 Tente outra data.";
  },

  escolhaHorarioInvalido() {
    return "Escolhe um dos números da lista, por favor.";
  },

  semOutroHorarioNoDia(motivo) {
    return `${motivo} E não sobrou outro horário livre nesse dia 😕 Tente outra data.`;
  },

  horariosAtualizados(motivo, listaHorariosFormatada) {
    return `${motivo} Horários atualizados:\n\n${listaHorariosFormatada}`;
  },

  agendamentoConfirmado(nomeServico, idCurto, nomeNegocio) {
    return `✅ Agendamento confirmado! *${nomeServico}* — id #${idCurto}.\n\nTe esperamos na ${nomeNegocio}!`;
  },

  escolhaCancelamentoInvalido() {
    return "Escolhe um dos números da lista, ou 0 para voltar ao menu.";
  },

  agendamentoNaoEncontrado() {
    return "Não achei mais esse agendamento — talvez já tenha sido cancelado.";
  },

  antecedenciaInsuficiente(antecedenciaMinimaHoras) {
    return `Esse agendamento é em menos de ${antecedenciaMinimaHoras}h, não dá mais pra cancelar por aqui. Escolha a opção 6 no menu pra falar com um atendente.`;
  },

  agendamentoCancelado() {
    return "Agendamento cancelado ✅";
  },
};
