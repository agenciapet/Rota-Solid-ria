import { Router } from 'express';
import type { ResultSetHeader } from 'mysql2/promise';
import { pool, query } from '../lib/db.js';
import { assincrono, ErroHttp } from '../lib/erros.js';
import { exigirAdm } from '../lib/auth.js';

// Montado atrás de exigirLogin.
export const pedidosRouter = Router();

// Pedidos abertos, para a equipa marcar o que leva no início da rota.
pedidosRouter.get(
  '/abertos',
  assincrono(async (_req, res) => {
    const pedidos = await query(
      `SELECT pe.id, pe.descricao, pe.adiamentos, p.id AS pessoa_id, p.nome AS pessoa_nome, p.ativa AS pessoa_ativa, r.data AS pedido_em
         FROM pedidos pe
         JOIN pessoas p ON p.id = pe.pessoa_id
         LEFT JOIN paradas po ON po.id = pe.parada_origem_id
         LEFT JOIN rotas r ON r.id = po.rota_id
        WHERE pe.status = 'aberto'
        ORDER BY r.data, p.nome, pe.id`,
    );
    res.json({ pedidos });
  }),
);

// O adm cancela um pedido que não será atendido.
pedidosRouter.post(
  '/:id/cancelar',
  exigirAdm,
  assincrono(async (req, res) => {
    const id = Number(req.params.id);
    const [r] = await pool.query<ResultSetHeader>("UPDATE pedidos SET status = 'cancelado' WHERE id = ? AND status = 'aberto'", [id]);
    if (!r.affectedRows) throw new ErroHttp(404, 'Pedido não encontrado ou já fechado');
    res.json({ ok: true });
  }),
);
