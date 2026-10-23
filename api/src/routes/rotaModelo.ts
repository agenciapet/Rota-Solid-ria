import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { query, queryOne, transacao } from '../lib/db.js';
import { assincrono, ErroHttp } from '../lib/erros.js';
import { ROTA_MODELO_ID } from '../lib/rotaModelo.js';

// Montado atrás de exigirAdm.
export const rotaModeloRouter = Router();

rotaModeloRouter.get(
  '/',
  assincrono(async (_req, res) => {
    const modelo = await queryOne<{ versao: number; atualizado_em: string | null }>(
      'SELECT versao, atualizado_em FROM rotas_modelo WHERE id = ?',
      [ROTA_MODELO_ID],
    );
    const itens = await query<{ pessoa_id: number }>(
      'SELECT pessoa_id FROM rota_modelo_itens WHERE rota_modelo_id = ? ORDER BY posicao',
      [ROTA_MODELO_ID],
    );
    res.json({ versao: modelo?.versao ?? 0, atualizado_em: modelo?.atualizado_em ?? null, ordem: itens.map((i) => i.pessoa_id) });
  }),
);

// Substitui a ordem inteira. Pessoas pausadas continuam na ordem (guardam o lugar)
// e só ficam de fora quando o dia de rota copia o modelo.
rotaModeloRouter.put(
  '/',
  assincrono(async (req, res) => {
    const { ordem, versao } = z
      .object({ ordem: z.array(z.number().int().positive()).max(500), versao: z.number().int().min(0) })
      .parse(req.body);
    if (new Set(ordem).size !== ordem.length) throw new ErroHttp(400, 'A mesma pessoa aparece duas vezes na rota');

    const resultado = await transacao(async (conn) => {
      const [modelo] = await conn.query<RowDataPacket[]>('SELECT versao FROM rotas_modelo WHERE id = ? FOR UPDATE', [
        ROTA_MODELO_ID,
      ]);
      if (modelo[0]?.versao !== versao) {
        throw new ErroHttp(409, 'A rota foi alterada noutro aparelho. Recarregue para ver a versão atual.');
      }
      // Quem foi apagado entretanto sai da ordem em silêncio.
      let final = ordem;
      if (ordem.length) {
        const [existentes] = await conn.query<RowDataPacket[]>('SELECT id FROM pessoas WHERE id IN (?)', [ordem]);
        const ids = new Set(existentes.map((e) => e.id as number));
        final = ordem.filter((id) => ids.has(id));
      }
      await conn.query('DELETE FROM rota_modelo_itens WHERE rota_modelo_id = ?', [ROTA_MODELO_ID]);
      if (final.length) {
        await conn.query('INSERT INTO rota_modelo_itens (rota_modelo_id, pessoa_id, posicao) VALUES ?', [
          final.map((id, i) => [ROTA_MODELO_ID, id, i + 1]),
        ]);
      }
      await conn.query('UPDATE rotas_modelo SET versao = versao + 1, atualizado_em = UTC_TIMESTAMP() WHERE id = ?', [
        ROTA_MODELO_ID,
      ]);
      return { versao: versao + 1, ordem: final };
    });
    res.json(resultado);
  }),
);
