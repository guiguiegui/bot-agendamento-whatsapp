import { addDays, startOfDay } from "date-fns";
import { normalizar } from "../utils/texto.js";

/**
 * Interpreta a data digitada pelo cliente: "hoje", "amanhã" (com ou sem acento)
 * ou "dd/mm" / "dd/mm/aaaa". Retorna `null` quando não reconhece o formato.
 */
export function interpretarData(textoOriginal: string, agora: Date): Date | null {
  const texto = normalizar(textoOriginal);

  if (texto === "hoje") return startOfDay(agora);
  if (texto === "amanha") return startOfDay(addDays(agora, 1));

  const match = texto.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;

  const dia = Number.parseInt(match[1]!, 10);
  const mes = Number.parseInt(match[2]!, 10);
  const anoInformado = match[3] ? Number.parseInt(match[3], 10) : agora.getFullYear();
  const ano = anoInformado < 100 ? 2000 + anoInformado : anoInformado;

  const data = new Date(ano, mes - 1, dia);
  // Se o dia "vazou" pro mês seguinte (ex.: 31/02), a data é inválida.
  if (data.getDate() !== dia || data.getMonth() !== mes - 1) return null;

  // Sem ano explícito e a data já passou este ano? assume o próximo ano.
  if (!match[3] && startOfDay(data) < startOfDay(agora)) {
    data.setFullYear(data.getFullYear() + 1);
  }

  return startOfDay(data);
}
