import type { Negocio } from "../../src/domain/negocio.js";

/**
 * Negócio de referência pros testes — os mesmos valores usados em produção
 * pelo negócio seedado na migração 0002 (src/db/migrations). São duas
 * cópias conscientes e independentes: esta é dado de teste (pode evoluir
 * livre, sem infra nenhuma por trás); a da migração é um snapshot congelado
 * de bootstrap de produção. Nenhuma das duas deve importar da outra.
 */
export const NEGOCIO_TESTE: Negocio = {
  id: "barba-e-oficio",
  nome: "Barba & Ofício",
  ativo: true,
  whatsappAuthDir: "./data/auth",
  numerosAdmin: [],
  antecedenciaMinimaCancelamentoHoras: 2,
  janelaAgendamentoDias: 14,
  catalogoServicos: [
    { id: "corte", nome: "Corte clássico", duracaoMin: 40, precoCentavos: 4500 },
    { id: "degrade", nome: "Degradê", duracaoMin: 45, precoCentavos: 5000 },
    { id: "barba", nome: "Barba na navalha", duracaoMin: 30, precoCentavos: 4000 },
    { id: "combo", nome: "Corte + Barba", duracaoMin: 70, precoCentavos: 7500 },
    { id: "sobrancelha", nome: "Sobrancelha", duracaoMin: 15, precoCentavos: 1500 },
    { id: "pezinho", nome: "Acabamento (pézinho)", duracaoMin: 15, precoCentavos: 1500 },
  ],
  horarioFuncionamento: {
    0: null, // domingo — fechado
    1: null, // segunda — fechado
    2: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 }, // terça
    3: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 }, // quarta
    4: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 }, // quinta
    5: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 }, // sexta
    6: { abreHora: 8, abreMinuto: 0, fechaHora: 17, fechaMinuto: 0 }, // sábado
  },
};
