import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatarDataCurta(data: Date): string {
  return format(data, "dd/MM (EEEE)", { locale: ptBR });
}

export function formatarHora(data: Date): string {
  return format(data, "HH:mm", { locale: ptBR });
}
