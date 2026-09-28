/**
 * CLI operacional pra cadastrar/listar/desativar negócios — não há UI de
 * administração, então essa é a única forma (fora INSERT manual) de
 * provisionar um negócio novo na plataforma.
 *
 *   npm run negocio -- listar
 *   npm run negocio -- criar --id <id> --config <arquivo.json>
 *   npm run negocio -- desativar --id <id>
 *
 * Ver negocio.exemplo.json na raiz do projeto pra um template de --config.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { config } from "../src/config.js";
import { abrirBanco } from "../src/db/database.js";
import { NegocioRepository } from "../src/db/negocioRepository.js";
import { pareceConfigNegocioValida, type ConfigNegocio } from "../src/domain/negocio.js";

function falhar(mensagem: string): never {
  console.error(`Erro: ${mensagem}`);
  process.exit(1);
}

function lerConfigNegocio(caminho: string): ConfigNegocio {
  let bruto: string;
  try {
    bruto = readFileSync(caminho, "utf8");
  } catch {
    falhar(`não consegui ler o arquivo "${caminho}".`);
  }

  let valor: unknown;
  try {
    valor = JSON.parse(bruto);
  } catch {
    falhar(`"${caminho}" não é um JSON válido.`);
  }

  if (!pareceConfigNegocioValida(valor)) {
    falhar(
      `"${caminho}" não tem o formato esperado de negócio ` +
        "(nome, whatsappAuthDir, numerosAdmin, antecedenciaMinimaCancelamentoHoras, " +
        "janelaAgendamentoDias, catalogoServicos, horarioFuncionamento — ver negocio.exemplo.json).",
    );
  }

  return valor;
}

function comandoListar(repo: NegocioRepository): void {
  const negocios = repo.listarTodos();
  if (negocios.length === 0) {
    console.log("Nenhum negócio cadastrado ainda.");
    return;
  }
  for (const n of negocios) {
    const status = n.ativo ? "✅ ativo  " : "⏸️  inativo";
    console.log(`${status}  ${n.id} — ${n.nome} (${n.catalogoServicos.length} serviços)`);
  }
}

function comandoCriar(repo: NegocioRepository, args: string[]): void {
  const { values } = parseArgs({
    args,
    options: { id: { type: "string" }, config: { type: "string" } },
  });

  if (!values.id) falhar("uso: npm run negocio -- criar --id <id> --config <arquivo.json>");
  if (!values.config) falhar("uso: npm run negocio -- criar --id <id> --config <arquivo.json>");

  if (repo.buscarPorId(values.id)) {
    falhar(`já existe um negócio com id "${values.id}".`);
  }

  const dados = lerConfigNegocio(values.config);
  repo.criar(values.id, dados);
  console.log(`Negócio "${values.id}" (${dados.nome}) criado.`);
}

function comandoDesativar(repo: NegocioRepository, args: string[]): void {
  const { values } = parseArgs({ args, options: { id: { type: "string" } } });
  if (!values.id) falhar("uso: npm run negocio -- desativar --id <id>");

  const negocio = repo.buscarPorId(values.id);
  if (!negocio) falhar(`negócio "${values.id}" não encontrado.`);

  repo.desativar(values.id);
  console.log(`Negócio "${values.id}" (${negocio.nome}) desativado.`);
}

function main(): void {
  const [comando, ...resto] = process.argv.slice(2);
  const db = abrirBanco(config.databasePath);
  const repo = new NegocioRepository(db);

  switch (comando) {
    case "listar":
      comandoListar(repo);
      break;
    case "criar":
      comandoCriar(repo, resto);
      break;
    case "desativar":
      comandoDesativar(repo, resto);
      break;
    default:
      console.error(
        "uso:\n" +
          "  npm run negocio -- listar\n" +
          "  npm run negocio -- criar --id <id> --config <arquivo.json>\n" +
          "  npm run negocio -- desativar --id <id>",
      );
      process.exitCode = 1;
  }

  db.close();
}

main();
