import type { ServicoNegocio } from "./negocio.js";

/** Acha um serviço pelo id, dentro do catálogo do negócio em questão. */
export function buscarServico(catalogo: ServicoNegocio[], id: string): ServicoNegocio | undefined {
  return catalogo.find((s) => s.id === id);
}

export function formatarPreco(precoCentavos: number): string {
  return (precoCentavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
