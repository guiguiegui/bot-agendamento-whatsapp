import { config } from "../config.js";
import { abrirBanco } from "./database.js";

// Script standalone (`npm run db:migrate`) — útil pra criar o banco antes do
// primeiro `npm start`, ou depois de apagar o arquivo .db pra recomeçar do zero.
const db = abrirBanco(config.databasePath);
console.log(`Banco pronto em ${config.databasePath}`);
db.close();
