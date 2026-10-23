import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { env } from './lib/env.js';
import { pool } from './lib/db.js';
import { assincrono, ErroHttp, tratadorDeErros } from './lib/erros.js';
import { exigirAdm, exigirLogin } from './lib/auth.js';
import { caminhoFotoValida } from './lib/fotos.js';
import { authRouter } from './routes/auth.js';
import { associacaoRouter } from './routes/associacao.js';
import { usuariosRouter } from './routes/usuarios.js';
import { pessoasRouter } from './routes/pessoas.js';
import { rotaModeloRouter } from './routes/rotaModelo.js';
import { rotasRouter } from './routes/rotas.js';
import { pedidosRouter } from './routes/pedidos.js';
import { iniciarTempoReal } from './lib/tempoReal.js';
import { query } from './lib/db.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json({ limit: '200kb' }));

app.get('/saude', assincrono(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
}));

app.use('/auth', authRouter);
app.use('/associacao', exigirLogin, associacaoRouter);
// Quem pode entrar na equipa do dia: só id e nome, acessível a todos os voluntários.
app.get('/usuarios/ativos', exigirLogin, assincrono(async (_req, res) => {
  res.json({ usuarios: await query('SELECT id, nome FROM usuarios WHERE ativo ORDER BY nome') });
}));
app.use('/usuarios', exigirLogin, exigirAdm, usuariosRouter);
app.use('/pessoas', exigirLogin, exigirAdm, pessoasRouter);
app.use('/rota-modelo', exigirLogin, exigirAdm, rotaModeloRouter);
app.use('/rotas', exigirLogin, rotasRouter);
app.use('/pedidos', exigirLogin, pedidosRouter);

// Foto do local: só com link assinado e dentro da validade.
app.get('/fotos/:nome', (req, res, next) => {
  const caminho = caminhoFotoValida(req.params.nome, String(req.query.exp ?? ''), String(req.query.sig ?? ''));
  if (!caminho) return next(new ErroHttp(403, 'Link da foto inválido ou expirado'));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(caminho, (err) => err && next(new ErroHttp(404, 'Foto não encontrada')));
});

app.use((_req, _res, next) => next(new ErroHttp(404, 'Rota não encontrada')));
app.use(tratadorDeErros);

export const servidor = http.createServer(app);
iniciarTempoReal(servidor);
servidor.listen(env.port, () => console.log(`API a correr em http://localhost:${env.port}`));
