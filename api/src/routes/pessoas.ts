import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../lib/db.js';
import { assincrono, ErroHttp } from '../lib/erros.js';
import { apagarFoto, linkFoto, uploadFoto } from '../lib/fotos.js';
import { ROTA_MODELO_ID } from '../lib/rotaModelo.js';

// Montado atrás de exigirAdm: a ficha completa e o histórico ficam só com o adm (RGPD).
export const pessoasRouter = Router();

const CAMPOS = ['id', 'nome', 'latitude', 'longitude', 'endereco', 'ponto_referencia', 'foto', 'telefone', 'ligar_antes_min', 'ativa', 'criado_em', 'atualizado_em']
  .map((c) => `p.${c}`)
  .join(', ');
const SELECT_PESSOAS = `SELECT ${CAMPOS}, rmi.pessoa_id IS NOT NULL AS na_rota
  FROM pessoas p
  LEFT JOIN rota_modelo_itens rmi ON rmi.pessoa_id = p.id AND rmi.rota_modelo_id = ${ROTA_MODELO_ID}`;

type Pessoa = { id: number; foto: string | null; [k: string]: unknown };

function comLinkFoto<T extends Pessoa>(p: T) {
  const { foto, ...resto } = p;
  return { ...resto, na_rota: !!p.na_rota, foto_url: linkFoto(foto) };
}

async function buscar(id: number) {
  const p = await queryOne<Pessoa>(`${SELECT_PESSOAS} WHERE p.id = ?`, [id]);
  if (!p) throw new ErroHttp(404, 'Pessoa não encontrada');
  return p;
}

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const esquema = z.object({
  nome: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  endereco: textoOpcional(255),
  ponto_referencia: textoOpcional(255),
  telefone: textoOpcional(40),
  ligar_antes_min: z.number().int().min(1).max(240).nullish().transform((v) => v ?? null),
  ativa: z.boolean().optional(),
});

pessoasRouter.get(
  '/',
  assincrono(async (_req, res) => {
    const pessoas = await query<Pessoa>(`${SELECT_PESSOAS} ORDER BY p.ativa DESC, p.nome`);
    res.json({ pessoas: pessoas.map(comLinkFoto) });
  }),
);

pessoasRouter.get(
  '/:id',
  assincrono(async (req, res) => {
    const id = Number(req.params.id);
    const pessoa = await buscar(id);
    const visitas = await query(
      `SELECT r.data, pa.status, pa.encontrada, pa.deixou_comida, pa.observacao, pa.motivo_nao_visita
         FROM paradas pa JOIN rotas r ON r.id = pa.rota_id
        WHERE pa.pessoa_id = ? ORDER BY r.data DESC LIMIT 50`,
      [id],
    );
    const pedidos = await query(
      'SELECT id, descricao, status, adiamentos, criado_em FROM pedidos WHERE pessoa_id = ? ORDER BY criado_em DESC',
      [id],
    );
    res.json({ pessoa: comLinkFoto(pessoa), visitas, pedidos });
  }),
);

pessoasRouter.post(
  '/',
  assincrono(async (req, res) => {
    const d = esquema.parse(req.body);
    const r: any = await query(
      `INSERT INTO pessoas (nome, latitude, longitude, endereco, ponto_referencia, telefone, ligar_antes_min, ativa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.nome, d.latitude, d.longitude, d.endereco, d.ponto_referencia, d.telefone, d.ligar_antes_min, d.ativa ?? true],
    );
    res.status(201).json({ pessoa: comLinkFoto(await buscar(r.insertId)) });
  }),
);

pessoasRouter.patch(
  '/:id',
  assincrono(async (req, res) => {
    const id = Number(req.params.id);
    await buscar(id);
    const d = esquema.partial().parse(req.body);
    const entradas = Object.entries(d).filter(([, v]) => v !== undefined);
    if (entradas.length) {
      await query(`UPDATE pessoas SET ${entradas.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`, [
        ...entradas.map(([, v]) => v),
        id,
      ]);
    }
    res.json({ pessoa: comLinkFoto(await buscar(id)) });
  }),
);

pessoasRouter.post(
  '/:id/foto',
  uploadFoto,
  assincrono(async (req, res) => {
    const id = Number(req.params.id);
    if (!req.file) throw new ErroHttp(400, 'Nenhuma foto enviada');
    let anterior: Pessoa;
    try {
      anterior = await buscar(id);
    } catch (e) {
      apagarFoto(req.file.filename);
      throw e;
    }
    await query('UPDATE pessoas SET foto = ? WHERE id = ?', [req.file.filename, id]);
    apagarFoto(anterior.foto);
    res.json({ pessoa: comLinkFoto(await buscar(id)) });
  }),
);

pessoasRouter.delete(
  '/:id/foto',
  assincrono(async (req, res) => {
    const id = Number(req.params.id);
    const p = await buscar(id);
    await query('UPDATE pessoas SET foto = NULL WHERE id = ?', [id]);
    apagarFoto(p.foto);
    res.json({ pessoa: comLinkFoto({ ...p, foto: null }) });
  }),
);

// RGPD: direito de acesso/portabilidade — tudo o que existe sobre a pessoa.
pessoasRouter.get(
  '/:id/exportar',
  assincrono(async (req, res) => {
    const id = Number(req.params.id);
    const { foto, na_rota, ...pessoa } = await buscar(id);
    const visitas = await query(
      `SELECT r.data, pa.status, pa.ligacao_feita, pa.encontrada, pa.deixou_comida, pa.observacao,
              pa.motivo_nao_visita, pa.chegada_em, pa.concluida_em
         FROM paradas pa JOIN rotas r ON r.id = pa.rota_id WHERE pa.pessoa_id = ? ORDER BY r.data`,
      [id],
    );
    const pedidos = await query(
      'SELECT descricao, status, adiamentos, criado_em FROM pedidos WHERE pessoa_id = ? ORDER BY criado_em',
      [id],
    );
    res.setHeader('Content-Disposition', `attachment; filename="pessoa-${id}.json"`);
    res.json({ exportado_em: new Date().toISOString(), pessoa: { ...pessoa, na_rota: !!na_rota, tem_foto: !!foto }, visitas, pedidos });
  }),
);

// RGPD: direito ao apagamento. Remove a pessoa, as paradas, os pedidos e a foto.
pessoasRouter.delete(
  '/:id',
  assincrono(async (req, res) => {
    const id = Number(req.params.id);
    const p = await buscar(id);
    await query('DELETE FROM pessoas WHERE id = ?', [id]);
    apagarFoto(p.foto);
    res.status(204).end();
  }),
);
