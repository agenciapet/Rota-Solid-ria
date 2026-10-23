import { Router, type Request } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { query, queryOne, transacao } from '../lib/db.js';
import { assincrono, ErroHttp } from '../lib/erros.js';
import { ROTA_MODELO_ID } from '../lib/rotaModelo.js';
import { estadoRota, hojeEmLisboa, PAPEIS, pendente, type StatusParada } from '../lib/rotas.js';
import { difundir } from '../lib/tempoReal.js';

// Montado atrás de exigirLogin. Qualquer membro da equipa pode avançar a fila (o papel não trava a rota);
// o adm pode sempre, para acompanhar e corrigir.
export const rotasRouter = Router();

/** A fila mudou entre o toque e a gravação: o telemóvel recebe o estado atual junto com o aviso. */
class FilaMudou extends ErroHttp {
  constructor(message = 'Outra pessoa já avançou a fila. O ecrã foi atualizado.') {
    super(409, message);
  }
}

const idDe = (valor: string | string[], nome = 'Rota') => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new ErroHttp(404, `${nome} não encontrada`);
  return n;
};

async function publicar(rotaId: number) {
  const estado = await estadoRota(rotaId);
  difundir({ tipo: 'rota', estado });
  return estado;
}

async function registrarEvento(
  conn: PoolConnection,
  rotaId: number,
  usuarioId: number,
  tipo: string,
  paradaId: number | null,
  dados: Record<string, unknown>,
) {
  await conn.query('INSERT INTO eventos_rota (rota_id, usuario_id, tipo, parada_id, dados) VALUES (?, ?, ?, ?, ?)', [
    rotaId,
    usuarioId,
    tipo,
    paradaId,
    JSON.stringify(dados),
  ]);
}

async function exigirMembro(req: Request, rotaId: number) {
  if (req.usuario!.tipo === 'adm') return;
  const m = await queryOne('SELECT 1 AS ok FROM rota_equipe WHERE rota_id = ? AND usuario_id = ?', [rotaId, req.usuario!.id]);
  if (!m) throw new ErroHttp(403, 'Não faz parte da equipa desta rota. Peça a um colega para o adicionar.');
}

// ---------- equipa ----------

const esquemaEquipe = z
  .array(z.object({ usuario_id: z.number().int().positive(), papel: z.enum(PAPEIS) }))
  .min(1)
  .max(20);
type Equipe = z.infer<typeof esquemaEquipe>;

function validarEquipe(equipe: Equipe) {
  const ids = equipe.map((m) => m.usuario_id);
  if (new Set(ids).size !== ids.length) throw new ErroHttp(400, 'A mesma pessoa aparece duas vezes na equipa');
  if (!equipe.some((m) => m.papel === 'motorista')) throw new ErroHttp(400, 'A equipa precisa de um motorista');
  if (!equipe.some((m) => m.papel === 'relatorio')) throw new ErroHttp(400, 'A equipa precisa de alguém no relatório');
}

async function gravarEquipe(conn: PoolConnection, rotaId: number, equipe: Equipe) {
  const ids = equipe.map((m) => m.usuario_id);
  const [ativos] = await conn.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE ativo AND id IN (?)', [ids]);
  if (ativos.length !== ids.length) throw new ErroHttp(400, 'Há alguém na equipa que já não tem conta ativa');
  await conn.query('DELETE FROM rota_equipe WHERE rota_id = ?', [rotaId]);
  await conn.query('INSERT INTO rota_equipe (rota_id, usuario_id, papel) VALUES ?', [
    equipe.map((m) => [rotaId, m.usuario_id, m.papel]),
  ]);
}

// ---------- consulta ----------

// A rota a decorrer; se não houver, a última de hoje (para mostrar o resumo depois de concluída).
rotasRouter.get(
  '/atual',
  assincrono(async (_req, res) => {
    const hoje = hojeEmLisboa();
    const emCurso = await queryOne<{ id: number }>(
      "SELECT id FROM rotas WHERE status IN ('em_andamento', 'retorno') ORDER BY id DESC LIMIT 1",
    );
    const id = emCurso?.id ?? (await queryOne<{ id: number }>('SELECT id FROM rotas WHERE data = ? ORDER BY id DESC LIMIT 1', [hoje]))?.id;
    res.json({ hoje, estado: id ? await estadoRota(id) : null });
  }),
);

rotasRouter.get(
  '/:id',
  assincrono(async (req, res) => {
    const id = idDe(req.params.id);
    const estado = await estadoRota(id);
    if (!estado) throw new ErroHttp(404, 'Rota não encontrada');
    res.json({ estado });
  }),
);

// ---------- início ----------

// Copia a rota modelo no momento em que começa: o que acontece na execução não altera o modelo.
rotasRouter.post(
  '/',
  assincrono(async (req, res) => {
    const d = z
      .object({
        km_inicial: z.number().int().min(0).max(9_999_999),
        equipe: esquemaEquipe,
        // Pedidos abertos que a equipa marca como "a levar" hoje.
        pedidos_levar: z.array(z.number().int().positive()).max(500).optional(),
      })
      .parse(req.body);
    validarEquipe(d.equipe);

    const rotaId = await transacao(async (conn) => {
      // Uma rota de cada vez: o FOR UPDATE serializa dois "Iniciar" em simultâneo.
      const [emCurso] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM rotas WHERE status IN ('em_andamento', 'retorno') FOR UPDATE",
      );
      if (emCurso.length) throw new ErroHttp(409, 'Já há uma rota a decorrer. Recarregue o ecrã.');

      const [itens] = await conn.query<RowDataPacket[]>(
        `SELECT rmi.pessoa_id FROM rota_modelo_itens rmi JOIN pessoas p ON p.id = rmi.pessoa_id
          WHERE rmi.rota_modelo_id = ? AND p.ativa ORDER BY rmi.posicao`,
        [ROTA_MODELO_ID],
      );
      if (!itens.length) throw new ErroHttp(400, 'A rota modelo está vazia. Peça ao administrador para montar a rota.');

      const [r] = await conn.query<ResultSetHeader>(
        "INSERT INTO rotas (rota_modelo_id, data, status, km_inicial, iniciada_em) VALUES (?, ?, 'em_andamento', ?, UTC_TIMESTAMP())",
        [ROTA_MODELO_ID, hojeEmLisboa(), d.km_inicial],
      );
      const id = r.insertId;
      await conn.query('INSERT INTO paradas (rota_id, pessoa_id, posicao) VALUES ?', [
        itens.map((it, i) => [id, it.pessoa_id, i + 1]),
      ]);
      await gravarEquipe(conn, id, d.equipe);
      if (d.pedidos_levar?.length) {
        await conn.query("UPDATE pedidos SET levar_rota_id = ? WHERE id IN (?) AND status = 'aberto'", [id, d.pedidos_levar]);
      }
      await registrarEvento(conn, id, req.usuario!.id, 'iniciou', null, { km_inicial: d.km_inicial, pedidos_levar: d.pedidos_levar?.length ?? 0 });
      return id;
    });
    res.status(201).json({ estado: await publicar(rotaId) });
  }),
);

rotasRouter.put(
  '/:id/equipe',
  assincrono(async (req, res) => {
    const id = idDe(req.params.id);
    const { equipe } = z.object({ equipe: esquemaEquipe }).parse(req.body);
    validarEquipe(equipe);
    await exigirMembro(req, id);
    await transacao(async (conn) => {
      const [[rota]] = await conn.query<RowDataPacket[]>('SELECT status FROM rotas WHERE id = ? FOR UPDATE', [id]);
      if (!rota) throw new ErroHttp(404, 'Rota não encontrada');
      if (rota.status === 'concluida') throw new ErroHttp(400, 'A rota já foi concluída');
      await gravarEquipe(conn, id, equipe);
      await registrarEvento(conn, id, req.usuario!.id, 'equipe', null, {});
    });
    res.json({ estado: await publicar(id) });
  }),
);

// Quem ficou de fora da equipa do dia junta-se como acompanhante, sem depender de um colega.
rotasRouter.post(
  '/:id/equipe/entrar',
  assincrono(async (req, res) => {
    const id = idDe(req.params.id);
    const rota = await queryOne<{ status: string }>('SELECT status FROM rotas WHERE id = ?', [id]);
    if (!rota) throw new ErroHttp(404, 'Rota não encontrada');
    if (rota.status === 'concluida') throw new ErroHttp(400, 'A rota já foi concluída');
    await query("INSERT IGNORE INTO rota_equipe (rota_id, usuario_id, papel) VALUES (?, ?, 'acompanhante')", [id, req.usuario!.id]);
    await query("INSERT INTO eventos_rota (rota_id, usuario_id, tipo, dados) VALUES (?, ?, 'entrou', '{}')", [id, req.usuario!.id]);
    res.json({ estado: await publicar(id) });
  }),
);

// ---------- fila ----------

/**
 * A pessoa passa a "a caminho" e as adiadas voltam à fila logo abaixo dela, na ordem original.
 * Exemplo: fila A, B, C; "Depois" em A mostra B; "Sim" em B deixa a fila em B, A, C.
 */
async function seguirPara(conn: PoolConnection, rotaId: number, paradaId: number) {
  await conn.query("UPDATE paradas SET status = 'a_caminho' WHERE id = ?", [paradaId]);
  const [todas] = await conn.query<RowDataPacket[]>('SELECT id, status FROM paradas WHERE rota_id = ? ORDER BY posicao', [rotaId]);
  const espera = todas.filter((p) => p.status === 'em_espera');
  if (!espera.length) return;
  const resto = todas.filter((p) => p.status !== 'em_espera');
  const i = resto.findIndex((p) => p.id === paradaId);
  const nova = [...resto.slice(0, i + 1), ...espera, ...resto.slice(i + 1)];
  for (const [indice, p] of nova.entries()) {
    await conn.query("UPDATE paradas SET posicao = ?, status = IF(status = 'em_espera', 'na_fila', status) WHERE id = ?", [
      indice + 1,
      p.id,
    ]);
  }
}

const TIPOS_ACAO = [
  'sim',
  'depois',
  'ir_agora',
  'trocar',
  'chegou',
  'voltar',
  'concluir_paragem',
  'iniciar_retorno',
  'voltar_a_rota',
  'concluir_rota',
] as const;

const esquemaAcao = z.object({
  tipo: z.enum(TIPOS_ACAO),
  versao: z.number().int().min(0),
  parada_id: z.number().int().positive().optional(),
  km_final: z.number().int().min(0).max(9_999_999).optional(),
  motivo: z.string().trim().max(255).optional(),
  devolucao: z.array(z.string().max(60)).max(20).optional(),
});

rotasRouter.post(
  '/:id/acoes',
  assincrono(async (req, res) => {
    const id = idDe(req.params.id);
    const d = esquemaAcao.parse(req.body);
    await exigirMembro(req, id);

    try {
      await transacao(async (conn) => {
        const [[rota]] = await conn.query<RowDataPacket[]>(
          'SELECT id, status, km_inicial, versao_fila FROM rotas WHERE id = ? FOR UPDATE',
          [id],
        );
        if (!rota) throw new ErroHttp(404, 'Rota não encontrada');
        if (rota.status === 'concluida') throw new ErroHttp(400, 'A rota já foi concluída');
        // Cada toque traz a versão que o telemóvel conhece; vale o primeiro, o segundo recebe o ecrã atualizado.
        if (rota.versao_fila !== d.versao) throw new FilaMudou();

        const [paradas] = await conn.query<RowDataPacket[]>(
          `SELECT pa.id, pa.status, pa.posicao, pa.encontrada, pa.deixou_comida, p.nome
             FROM paradas pa JOIN pessoas p ON p.id = pa.pessoa_id
            WHERE pa.rota_id = ? ORDER BY pa.posicao FOR UPDATE`,
          [id],
        );
        const parada = d.parada_id ? paradas.find((p) => p.id === d.parada_id) : undefined;
        const noLocal = paradas.find((p) => p.status === 'no_local');
        const aCaminho = paradas.find((p) => p.status === 'a_caminho');
        const cabeca = paradas.find((p) => p.status === 'na_fila');
        const pendentes = paradas.filter((p) => pendente(p.status));
        const dados: Record<string, unknown> = {};
        if (parada) dados.pessoa = parada.nome;

        const emAndamento = () => {
          if (rota.status !== 'em_andamento') throw new ErroHttp(400, 'A rota está no regresso à Associação');
        };
        const exigir = (estados: StatusParada[]) => {
          if (!parada || !estados.includes(parada.status)) throw new FilaMudou();
          return parada;
        };
        const exigirCabeca = () => {
          if (!parada || parada.id !== cabeca?.id || noLocal || aCaminho) throw new FilaMudou();
          return parada;
        };

        switch (d.tipo) {
          case 'sim': {
            emAndamento();
            await seguirPara(conn, id, exigirCabeca().id);
            break;
          }
          case 'depois': {
            emAndamento();
            await conn.query("UPDATE paradas SET status = 'em_espera' WHERE id = ?", [exigirCabeca().id]);
            break;
          }
          case 'ir_agora': {
            emAndamento();
            const p = exigir(['na_fila', 'em_espera']);
            if (noLocal) throw new ErroHttp(400, 'Conclua a paragem atual (ou toque em Voltar) antes de escolher outra pessoa');
            if (aCaminho) {
              await conn.query("UPDATE paradas SET status = 'na_fila' WHERE id = ?", [aCaminho.id]);
              dados.devolvida = aCaminho.nome;
            }
            await seguirPara(conn, id, p.id);
            break;
          }
          case 'trocar': {
            await conn.query("UPDATE paradas SET status = 'na_fila' WHERE id = ?", [exigir(['a_caminho']).id]);
            break;
          }
          case 'chegou': {
            await conn.query("UPDATE paradas SET status = 'no_local', chegada_em = UTC_TIMESTAMP() WHERE id = ?", [
              exigir(['a_caminho']).id,
            ]);
            break;
          }
          case 'voltar': {
            await conn.query("UPDATE paradas SET status = 'a_caminho', chegada_em = NULL WHERE id = ?", [exigir(['no_local']).id]);
            break;
          }
          case 'concluir_paragem': {
            const p = exigir(['no_local']);
            if (p.encontrada === null) throw new ErroHttp(400, 'Responda se a pessoa foi encontrada');
            if (p.encontrada && p.deixou_comida === null) throw new ErroHttp(400, 'Responda se deixou a comida');
            await conn.query("UPDATE paradas SET status = 'concluida', concluida_em = UTC_TIMESTAMP() WHERE id = ?", [p.id]);
            // Fila vazia: o destino passa a ser a Associação.
            if (!pendentes.some((x) => x.id !== p.id)) {
              await conn.query("UPDATE rotas SET status = 'retorno' WHERE id = ?", [id]);
              dados.fila_vazia = true;
            }
            break;
          }
          case 'iniciar_retorno': {
            emAndamento();
            if (noLocal || aCaminho) throw new ErroHttp(400, 'Conclua ou devolva à fila a paragem atual antes de encerrar a rota');
            await conn.query("UPDATE rotas SET status = 'retorno' WHERE id = ?", [id]);
            dados.por_visitar = pendentes.length;
            break;
          }
          case 'voltar_a_rota': {
            if (rota.status !== 'retorno') throw new ErroHttp(400, 'A rota não está no regresso à Associação');
            if (!pendentes.length) throw new ErroHttp(400, 'Não há pessoas por visitar');
            await conn.query("UPDATE rotas SET status = 'em_andamento' WHERE id = ?", [id]);
            break;
          }
          case 'concluir_rota': {
            if (rota.status !== 'retorno') throw new ErroHttp(400, 'Inicie o regresso à Associação antes de concluir a rota');
            if (d.km_final === undefined) throw new ErroHttp(400, 'Indique o km final');
            if (d.km_final < rota.km_inicial) {
              throw new ErroHttp(400, `O km final tem de ser igual ou superior ao inicial (${rota.km_inicial})`);
            }
            if (pendentes.length) {
              if (!d.motivo) throw new ErroHttp(400, 'Indique o motivo de as pessoas restantes não terem sido visitadas');
              await conn.query("UPDATE paradas SET status = 'nao_visitada', motivo_nao_visita = ? WHERE id IN (?)", [
                d.motivo,
                pendentes.map((p) => p.id),
              ]);
            }
            await conn.query("UPDATE rotas SET status = 'concluida', km_final = ?, concluida_em = UTC_TIMESTAMP() WHERE id = ?", [
              d.km_final,
              id,
            ]);
            Object.assign(dados, { km_final: d.km_final, nao_visitadas: pendentes.length, devolucao: d.devolucao ?? [] });
            break;
          }
        }

        await conn.query('UPDATE rotas SET versao_fila = versao_fila + 1 WHERE id = ?', [id]);
        await registrarEvento(conn, id, req.usuario!.id, d.tipo, parada?.id ?? null, dados);
      });
    } catch (e) {
      if (e instanceof FilaMudou) {
        res.status(409).json({ erro: e.message, estado: await estadoRota(id) });
        return;
      }
      throw e;
    }
    res.json({ estado: await publicar(id) });
  }),
);

// ---------- questionário ----------

// Cada campo grava ao ser preenchido e aparece aos outros com o nome de quem preencheu.
// Não usa a versão da fila: responder não compete com avançar a fila.
const esquemaResposta = z.object({
  campo: z.enum(['encontrada', 'deixou_comida', 'observacao', 'pedido']),
  valor: z.union([z.boolean(), z.string().max(2000), z.null()]),
});

rotasRouter.patch(
  '/:id/paradas/:pid/questionario',
  assincrono(async (req, res) => {
    const id = idDe(req.params.id);
    const pid = idDe(req.params.pid, 'Paragem');
    const { campo, valor } = esquemaResposta.parse(req.body);
    await exigirMembro(req, id);

    const booleano = campo === 'encontrada' || campo === 'deixou_comida';
    if (booleano ? typeof valor === 'string' : typeof valor === 'boolean') throw new ErroHttp(400, 'Valor inválido para este campo');
    const v = typeof valor === 'string' ? valor.trim() || null : valor;

    await transacao(async (conn) => {
      const [[rota]] = await conn.query<RowDataPacket[]>('SELECT status FROM rotas WHERE id = ? FOR UPDATE', [id]);
      if (!rota) throw new ErroHttp(404, 'Rota não encontrada');
      if (rota.status === 'concluida' && req.usuario!.tipo !== 'adm') {
        throw new ErroHttp(400, 'A rota já foi concluída: só o administrador pode corrigir as respostas');
      }
      const [[parada]] = await conn.query<RowDataPacket[]>(
        'SELECT id, pessoa_id, status FROM paradas WHERE id = ? AND rota_id = ? FOR UPDATE',
        [pid, id],
      );
      if (!parada) throw new ErroHttp(404, 'Paragem não encontrada');
      if (!['no_local', 'concluida'].includes(parada.status)) throw new ErroHttp(400, 'O questionário só abre depois de chegar ao local');

      if (campo === 'pedido') {
        // "Fez algum pedido?" cria um pedido aberto; limpar o campo apaga-o enquanto ainda estiver aberto.
        const [[existente]] = await conn.query<RowDataPacket[]>(
          "SELECT id, status FROM pedidos WHERE parada_origem_id = ? AND status <> 'cancelado' ORDER BY id DESC LIMIT 1 FOR UPDATE",
          [pid],
        );
        if (v) {
          if (existente) await conn.query('UPDATE pedidos SET descricao = ? WHERE id = ?', [v, existente.id]);
          else {
            await conn.query("INSERT INTO pedidos (pessoa_id, descricao, status, parada_origem_id) VALUES (?, ?, 'aberto', ?)", [
              parada.pessoa_id,
              v,
              pid,
            ]);
          }
        } else if (existente?.status === 'aberto') {
          await conn.query('DELETE FROM pedidos WHERE id = ?', [existente.id]);
        }
      } else {
        await conn.query(`UPDATE paradas SET ${campo} = ? WHERE id = ?`, [v, pid]);
        if (campo === 'encontrada' && v !== true) await conn.query('UPDATE paradas SET deixou_comida = NULL WHERE id = ?', [pid]);
      }

      const caminho = `$.${campo}`;
      if (v === null) {
        await conn.query('UPDATE paradas SET preenchido_por = JSON_REMOVE(COALESCE(preenchido_por, JSON_OBJECT()), ?) WHERE id = ?', [
          caminho,
          pid,
        ]);
      } else {
        await conn.query('UPDATE paradas SET preenchido_por = JSON_SET(COALESCE(preenchido_por, JSON_OBJECT()), ?, ?) WHERE id = ?', [
          caminho,
          req.usuario!.id,
          pid,
        ]);
      }
    });
    res.json({ estado: await publicar(id) });
  }),
);

// ---------- pedidos de rotas anteriores ----------

// "Entregue" fecha o pedido; "Adiado" mantém-no aberto e o lembrete volta na próxima rota.
// Tocar outra vez na mesma resposta anula-a. Se a pessoa não for encontrada, não precisa de resposta.
rotasRouter.post(
  '/:id/paradas/:pid/pedidos/:pedidoId',
  assincrono(async (req, res) => {
    const id = idDe(req.params.id);
    const pid = idDe(req.params.pid, 'Paragem');
    const pedidoId = idDe(req.params.pedidoId, 'Pedido');
    const { resposta } = z.object({ resposta: z.enum(['entregue', 'adiado']).nullable() }).parse(req.body);
    await exigirMembro(req, id);

    await transacao(async (conn) => {
      const [[rota]] = await conn.query<RowDataPacket[]>('SELECT status FROM rotas WHERE id = ? FOR UPDATE', [id]);
      if (!rota) throw new ErroHttp(404, 'Rota não encontrada');
      if (rota.status === 'concluida' && req.usuario!.tipo !== 'adm') {
        throw new ErroHttp(400, 'A rota já foi concluída: só o administrador pode corrigir as respostas');
      }
      const [[parada]] = await conn.query<RowDataPacket[]>(
        'SELECT id, pessoa_id, status FROM paradas WHERE id = ? AND rota_id = ? FOR UPDATE',
        [pid, id],
      );
      if (!parada) throw new ErroHttp(404, 'Paragem não encontrada');
      if (!['no_local', 'concluida'].includes(parada.status)) throw new ErroHttp(400, 'Os pedidos respondem-se depois de chegar ao local');
      const [[pedido]] = await conn.query<RowDataPacket[]>(
        'SELECT id, status, resposta, resposta_parada_id, adiamentos FROM pedidos WHERE id = ? AND pessoa_id = ? FOR UPDATE',
        [pedidoId, parada.pessoa_id],
      );
      if (!pedido) throw new ErroHttp(404, 'Pedido não encontrado');
      if (pedido.status === 'cancelado') throw new ErroHttp(400, 'Este pedido foi cancelado pelo administrador');
      const respondidoAqui = pedido.resposta_parada_id === pid;
      if (pedido.status === 'entregue' && !respondidoAqui) throw new ErroHttp(400, 'Este pedido já foi entregue numa rota anterior');
      if (respondidoAqui && pedido.resposta === resposta) return;

      // Anula a resposta anterior desta paragem antes de aplicar a nova.
      let adiamentos = pedido.adiamentos as number;
      if (respondidoAqui && pedido.resposta === 'adiado') adiamentos = Math.max(0, adiamentos - 1);
      if (resposta === 'adiado') adiamentos += 1;
      await conn.query(
        `UPDATE pedidos SET status = ?, parada_entrega_id = ?, resposta = ?, resposta_parada_id = ?, adiamentos = ? WHERE id = ?`,
        [
          resposta === 'entregue' ? 'entregue' : 'aberto',
          resposta === 'entregue' ? pid : null,
          resposta,
          resposta ? pid : null,
          adiamentos,
          pedidoId,
        ],
      );
    });
    res.json({ estado: await publicar(id) });
  }),
);

// ---------- ligação ----------

rotasRouter.post(
  '/:id/paradas/:pid/ligacao',
  assincrono(async (req, res) => {
    const id = idDe(req.params.id);
    const pid = idDe(req.params.pid, 'Paragem');
    const { feita } = z.object({ feita: z.boolean() }).parse(req.body);
    await exigirMembro(req, id);
    const parada = await queryOne<{ nome: string }>(
      'SELECT p.nome FROM paradas pa JOIN pessoas p ON p.id = pa.pessoa_id WHERE pa.id = ? AND pa.rota_id = ?',
      [pid, id],
    );
    if (!parada) throw new ErroHttp(404, 'Paragem não encontrada');
    await query('UPDATE paradas SET ligacao_feita = ? WHERE id = ?', [feita, pid]);
    if (feita) {
      await query("INSERT INTO eventos_rota (rota_id, usuario_id, tipo, parada_id, dados) VALUES (?, ?, 'ligacao', ?, ?)", [
        id,
        req.usuario!.id,
        pid,
        JSON.stringify({ pessoa: parada.nome }),
      ]);
    }
    res.json({ estado: await publicar(id) });
  }),
);
