/**
 * Catálogo de serviços — os mesmos da landing page (mesmo cliente fictício),
 * agora com duração em minutos, necessária para calcular os horários livres.
 */
export type ServicoId =
  | "corte"
  | "degrade"
  | "barba"
  | "combo"
  | "sobrancelha"
  | "pezinho";

export interface Servico {
  id: ServicoId;
  nome: string;
  duracaoMin: number;
  precoCentavos: number;
}

export const CATALOGO_SERVICOS: readonly Servico[] = [
  { id: "corte", nome: "Corte clássico", duracaoMin: 40, precoCentavos: 4500 },
  { id: "degrade", nome: "Degradê", duracaoMin: 45, precoCentavos: 5000 },
  { id: "barba", nome: "Barba na navalha", duracaoMin: 30, precoCentavos: 4000 },
  { id: "combo", nome: "Corte + Barba", duracaoMin: 70, precoCentavos: 7500 },
  { id: "sobrancelha", nome: "Sobrancelha", duracaoMin: 15, precoCentavos: 1500 },
  { id: "pezinho", nome: "Acabamento (pézinho)", duracaoMin: 15, precoCentavos: 1500 },
] as const;

export function buscarServico(id: string): Servico | undefined {
  return CATALOGO_SERVICOS.find((s) => s.id === id);
}

export function formatarPreco(precoCentavos: number): string {
  return (precoCentavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
