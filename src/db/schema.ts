export const ESQUEMA_SQL = `
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  telefone TEXT NOT NULL UNIQUE,
  nome TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id TEXT PRIMARY KEY,
  telefone TEXT NOT NULL,
  servico TEXT NOT NULL,
  inicio TEXT NOT NULL,
  fim TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmado',
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (telefone) REFERENCES clientes(telefone)
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_inicio ON agendamentos(inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_telefone_status ON agendamentos(telefone, status);
`;
