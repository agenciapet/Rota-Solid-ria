import bcrypt from 'bcryptjs';
import { pool, query, queryOne } from '../lib/db.js';
import { ROTA_MODELO_ID } from '../lib/rotaModelo.js';

// Dados fictícios para testar a montagem e a execução da rota.
// Uso: npm run semear-demo   (só corre com o banco sem pessoas; nunca em produção)

if (process.env.NODE_ENV === 'production') {
  console.error('Recusado: não semeie dados de demonstração em produção.');
  process.exit(1);
}
const existentes = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM pessoas');
if (existentes && existentes.n > 0) {
  console.error(`Recusado: já existem ${existentes.n} pessoas no banco.`);
  process.exit(1);
}

// Gerador pseudoaleatório com semente fixa: a demonstração sai sempre igual.
let semente = 20261005;
const aleatorio = () => {
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const BASE = { lat: 38.7238, lng: -9.1372 };
await query(
  `INSERT INTO associacao (id, nome, endereco, latitude, longitude, telefone, email)
   VALUES (1, 'Associação Demonstração', 'Rua Fictícia, 1 — Lisboa', ?, ?, '000 000 000', NULL)
   ON DUPLICATE KEY UPDATE id = id`,
  [BASE.lat, BASE.lng],
);

const NOMES = [
  'Alberto R.', 'Beatriz M.', 'Carlos S.', 'Diana F.', 'Eduardo P.', 'Fátima L.', 'Gonçalo T.', 'Helena C.',
  'Ivo A.', 'Joana B.', 'Luís D.', 'Marta G.', 'Nuno H.', 'Olga V.', 'Paulo N.', 'Quitéria O.',
  'Raul E.', 'Sofia I.', 'Tiago J.', 'Úrsula K.', 'Vasco Q.', 'Xavier U.', 'Zélia W.', 'Amílcar Y.',
  'Bruna Z.', 'Celeste R.', 'Duarte M.', 'Ermelinda S.', 'Filipe F.', 'Glória P.',
];
const REFERENCIAS = [
  'Junto à farmácia', 'Banco do jardim', 'Paragem do autocarro', 'Entrada do metro', 'Arcada do mercado',
  'Porta da igreja', 'Escadas da escola', 'Esquina da padaria', 'Debaixo da ponte pedonal', 'Ao lado do quiosque',
];

const pessoas: { id: number; lat: number; lng: number }[] = [];
for (const [i, nome] of NOMES.entries()) {
  const lat = BASE.lat + (aleatorio() - 0.4) * 0.012;
  const lng = BASE.lng + (aleatorio() - 0.5) * 0.016;
  const temTelefone = i % 3 === 0;
  const r: any = await query(
    `INSERT INTO pessoas (nome, latitude, longitude, ponto_referencia, telefone, ligar_antes_min)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      nome,
      lat.toFixed(6),
      lng.toFixed(6),
      REFERENCIAS[i % REFERENCIAS.length],
      temTelefone ? `000 000 ${String(i).padStart(3, '0')}` : null,
      temTelefone && i % 2 === 0 ? 10 : null,
    ],
  );
  pessoas.push({ id: r.insertId, lat, lng });
}

// As 27 primeiras entram na rota, por vizinho mais próximo a partir da Associação;
// as 3 últimas ficam fora, para testar a inclusão com sugestão de posição.
const naRota = pessoas.slice(0, 27);
const ordem: number[] = [];
let atual = BASE;
while (naRota.length) {
  let melhor = 0;
  for (let i = 1; i < naRota.length; i++) {
    const d = (p: { lat: number; lng: number }) => (p.lat - atual.lat) ** 2 + (p.lng - atual.lng) ** 2;
    if (d(naRota[i]) < d(naRota[melhor])) melhor = i;
  }
  const [p] = naRota.splice(melhor, 1);
  ordem.push(p.id);
  atual = p;
}
await query('DELETE FROM rota_modelo_itens WHERE rota_modelo_id = ?', [ROTA_MODELO_ID]);
await query('INSERT INTO rota_modelo_itens (rota_modelo_id, pessoa_id, posicao) VALUES ?', [
  ordem.map((id, i) => [ROTA_MODELO_ID, id, i + 1]),
]);
await query('UPDATE rotas_modelo SET versao = versao + 1, atualizado_em = UTC_TIMESTAMP() WHERE id = ?', [ROTA_MODELO_ID]);

const SENHA_TESTE = 'teste1234';
const hash = await bcrypt.hash(SENHA_TESTE, 12);
for (const [login, nome] of [['ana.teste', 'Ana (teste)'], ['rui.teste', 'Rui (teste)'], ['ines.teste', 'Inês (teste)']]) {
  await query(
    `INSERT INTO usuarios (nome, login, senha_hash, tipo) VALUES (?, ?, ?, 'voluntario')
     ON DUPLICATE KEY UPDATE senha_hash = VALUES(senha_hash), ativo = TRUE`,
    [nome, login, hash],
  );
}

console.log(`Demonstração pronta: ${pessoas.length} pessoas (${ordem.length} na rota), voluntários ana.teste / rui.teste / ines.teste com a palavra-passe "${SENHA_TESTE}".`);
await pool.end();
