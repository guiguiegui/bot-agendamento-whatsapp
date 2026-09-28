/** Normaliza texto do usuário: minúsculas, sem acento, sem espaços nas pontas. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Extrai um número inteiro de uma resposta tipo "1", " 2 " ou "opção 3". Retorna null se não achar. */
export function extrairNumero(texto: string): number | null {
  const match = /\d+/.exec(texto.trim());
  if (!match) return null;
  const n = Number.parseInt(match[0], 10);
  return Number.isFinite(n) ? n : null;
}
