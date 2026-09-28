import type { Migracao } from "../migrationRunner.js";
import { migracao0001EsquemaInicial } from "./0001_esquema_inicial.js";
import { migracao0002NegociosMultiTenant } from "./0002_negocios_multi_tenant.js";

/** Ordem de aplicação. Uma migração já aplicada nunca deve ser editada — crie uma nova. */
export const MIGRACOES: readonly Migracao[] = [migracao0001EsquemaInicial, migracao0002NegociosMultiTenant];
