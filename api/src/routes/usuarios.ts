import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne } from '../lib/db.js';
import { assincrono, ErroHttp } from '../lib/erros.js';

// Montado atrás de exigirAdm.
export const usuariosRouter = Router();

const CAMPOS = 'id, nome, login, tipo, ativo, criado_em';
const login = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,60}$/, 'use 3 a 60 letras, números, ponto, hífen ou _');
const senha = z.string().min(8, 'a palavra-passe precisa de pelo menos 8 caracteres').max(200);

usuariosRouter.get(
  '/',
  assincrono(async (_req, res) => {
    res.json({ usuarios: await query(`SELECT ${CAMPOS} FROM usuarios ORDER BY ativo DESC, nome`) });
  }),
);

usuariosRouter.post(
  '/',
  assincrono(async (req, res) => {
    const d = z
      .object({ nome: z.string().trim().min(1).max(120), login, senha, tipo: z.enum(['adm', 'voluntario']) })
      .parse(req.body);
    const hash = await bcrypt.hash(d.senha, 12);
    const r: any = await query('INSERT INTO usuarios (nome, login, senha_hash, tipo) VALUES (?, ?, ?, ?)', [
      d.nome,
      d.login,
      hash,
      d.tipo,
    ]);
    res.status(201).json({ usuario: await queryOne(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`, [r.insertId]) });
  }),
);

usuariosRouter.patch(
  '/:id',
  assincrono(async (req, res) => {
    const id = Number(req.params.id);
    const d = z
      .object({
        nome: z.string().trim().min(1).max(120).optional(),
        login: login.optional(),
        senha: senha.optional(),
        tipo: z.enum(['adm', 'voluntario']).optional(),
        ativo: z.boolean().optional(),
      })
      .parse(req.body);

    if (id === req.usuario!.id && (d.ativo === false || d.tipo === 'voluntario')) {
      throw new ErroHttp(400, 'Não pode desativar nem retirar o perfil de administrador da sua própria conta');
    }

    const sets: string[] = [];
    const valores: unknown[] = [];
    for (const campo of ['nome', 'login', 'tipo', 'ativo'] as const) {
      if (d[campo] !== undefined) {
        sets.push(`${campo} = ?`);
        valores.push(d[campo]);
      }
    }
    if (d.senha) {
      sets.push('senha_hash = ?');
      valores.push(await bcrypt.hash(d.senha, 12));
    }
    if (sets.length) await query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`, [...valores, id]);

    const u = await queryOne(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`, [id]);
    if (!u) throw new ErroHttp(404, 'Utilizador não encontrado');
    res.json({ usuario: u });
  }),
);
