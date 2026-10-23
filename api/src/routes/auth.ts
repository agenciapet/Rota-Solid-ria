import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { queryOne } from '../lib/db.js';
import { assincrono, ErroHttp } from '../lib/erros.js';
import { emitirToken, exigirLogin } from '../lib/auth.js';

export const authRouter = Router();

// Conta só as tentativas falhadas: trava força bruta sem bloquear a equipa que entra a partir da mesma rede.
const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false });

authRouter.post(
  '/login',
  limiteLogin,
  assincrono(async (req, res) => {
    const { login, senha } = z.object({ login: z.string().trim().min(1), senha: z.string().min(1) }).parse(req.body);
    const u = await queryOne<{ id: number; nome: string; login: string; tipo: string; senha_hash: string; ativo: number }>(
      'SELECT id, nome, login, tipo, senha_hash, ativo FROM usuarios WHERE login = ?',
      [login.toLowerCase()],
    );
    if (!u || !u.ativo || !(await bcrypt.compare(senha, u.senha_hash))) {
      throw new ErroHttp(401, 'Utilizador ou palavra-passe incorretos');
    }
    res.json({ token: emitirToken(u.id), usuario: { id: u.id, nome: u.nome, login: u.login, tipo: u.tipo } });
  }),
);

authRouter.get('/me', exigirLogin, (req, res) => {
  res.json({ usuario: req.usuario });
});
