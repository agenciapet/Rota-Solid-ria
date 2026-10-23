import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../lib/env.js';

// Aplica, por ordem, os ficheiros de migrations/ ainda não aplicados.
const pasta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');
const conn = await mysql.createConnection({ uri: env.databaseUrl, multipleStatements: true });
await conn.query(
  'CREATE TABLE IF NOT EXISTS migracoes (nome VARCHAR(200) PRIMARY KEY, aplicada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
);
const [linhas] = await conn.query('SELECT nome FROM migracoes');
const aplicadas = new Set((linhas as { nome: string }[]).map((l) => l.nome));

for (const ficheiro of fs.readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort()) {
  if (aplicadas.has(ficheiro)) continue;
  console.log(`A aplicar ${ficheiro}…`);
  // DDL no MySQL faz commit implícito; uma migração deve ser pequena o bastante para corrigir à mão se falhar.
  await conn.query(fs.readFileSync(path.join(pasta, ficheiro), 'utf8'));
  await conn.query('INSERT INTO migracoes (nome) VALUES (?)', [ficheiro]);
}
console.log('Migrações em dia.');
await conn.end();
