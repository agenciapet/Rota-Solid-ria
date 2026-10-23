import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import { pool } from '../lib/db.js';

// Cria o primeiro administrador: npm run criar-adm -- --nome "Natália" --login natalia --senha "..."
const { values } = parseArgs({ options: { nome: { type: 'string' }, login: { type: 'string' }, senha: { type: 'string' } } });
if (!values.nome || !values.login || !values.senha || values.senha.length < 8) {
  console.error('Uso: npm run criar-adm -- --nome "Nome" --login login --senha "palavra-passe com 8+ caracteres"');
  process.exit(1);
}
const hash = await bcrypt.hash(values.senha, 12);
await pool.query(
  `INSERT INTO usuarios (nome, login, senha_hash, tipo) VALUES (?, ?, ?, 'adm')
   ON DUPLICATE KEY UPDATE nome = VALUES(nome), senha_hash = VALUES(senha_hash), tipo = 'adm', ativo = TRUE`,
  [values.nome, values.login.toLowerCase(), hash],
);
console.log(`Administrador "${values.login}" pronto.`);
await pool.end();
