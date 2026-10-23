import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../lib/db.js';
import { assincrono } from '../lib/erros.js';
import { exigirAdm } from '../lib/auth.js';

export const associacaoRouter = Router();

const CAMPOS = 'nome, endereco, latitude, longitude, telefone, email';

// Qualquer membro lê: o endereço é o ponto de partida e de chegada da rota.
associacaoRouter.get(
  '/',
  assincrono(async (_req, res) => {
    res.json({ associacao: (await queryOne(`SELECT ${CAMPOS} FROM associacao WHERE id = 1`)) ?? null });
  }),
);

const esquema = z.object({
  nome: z.string().trim().min(1).max(150),
  endereco: z.string().trim().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  telefone: z.string().trim().max(40).nullish(),
  email: z.string().trim().email().max(150).nullish().or(z.literal('')),
});

associacaoRouter.put(
  '/',
  exigirAdm,
  assincrono(async (req, res) => {
    const d = esquema.parse(req.body);
    const valores = [d.nome, d.endereco, d.latitude, d.longitude, d.telefone || null, d.email || null];
    await query(
      `INSERT INTO associacao (id, ${CAMPOS}) VALUES (1, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), endereco = VALUES(endereco), latitude = VALUES(latitude),
         longitude = VALUES(longitude), telefone = VALUES(telefone), email = VALUES(email)`,
      valores,
    );
    res.json({ associacao: await queryOne(`SELECT ${CAMPOS} FROM associacao WHERE id = 1`) });
  }),
);
