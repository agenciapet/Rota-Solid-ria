import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from './db.js';
import { linkFoto } from './fotos.js';

export type StatusParada = 'na_fila' | 'em_espera' | 'a_caminho' | 'no_local' | 'concluida' | 'nao_visitada';
export type StatusRota = 'nao_iniciada' | 'em_andamento' | 'retorno' | 'concluida';
export type Papel = 'motorista' | 'relatorio' | 'acompanhante';

export const PAPEIS = ['motorista', 'relatorio', 'acompanhante'] as const;
const PENDENTES: StatusParada[] = ['na_fila', 'em_espera', 'a_caminho', 'no_local'];
export const pendente = (status: StatusParada) => PENDENTES.includes(status);

export function hojeEmLisboa(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
}

type Executor = Pool | PoolConnection;

/**
 * O estado completo da rota, tal como vai para os telemóveis. Leva só o que a equipa precisa
 * de cada pessoa (a ficha completa fica com o adm) e os últimos eventos, para os avisos curtos.
 */
export async function estadoRota(rotaId: number, ex: Executor = pool) {
  const [[rota]] = await ex.query<RowDataPacket[]>(
    'SELECT id, data, status, km_inicial, km_final, iniciada_em, concluida_em, versao_fila FROM rotas WHERE id = ?',
    [rotaId],
  );
  if (!rota) return null;

  const [equipe] = await ex.query<RowDataPacket[]>(
    `SELECT re.usuario_id, u.nome, re.papel FROM rota_equipe re JOIN usuarios u ON u.id = re.usuario_id
      WHERE re.rota_id = ? ORDER BY FIELD(re.papel, 'motorista', 'relatorio', 'acompanhante'), u.nome`,
    [rotaId],
  );
  const [paradas] = await ex.query<RowDataPacket[]>(
    `SELECT pa.id, pa.pessoa_id, pa.posicao, pa.status, pa.ligacao_feita, pa.encontrada, pa.deixou_comida,
            pa.observacao, pa.motivo_nao_visita, pa.chegada_em, pa.concluida_em, pa.preenchido_por,
            p.nome, p.latitude, p.longitude, p.ponto_referencia, p.foto, p.telefone, p.ligar_antes_min,
            (SELECT descricao FROM pedidos WHERE parada_origem_id = pa.id AND status <> 'cancelado'
              ORDER BY id DESC LIMIT 1) AS pedido
       FROM paradas pa JOIN pessoas p ON p.id = pa.pessoa_id
      WHERE pa.rota_id = ? ORDER BY pa.posicao`,
    [rotaId],
  );
  const [eventos] = await ex.query<RowDataPacket[]>(
    `SELECT e.id, e.tipo, e.usuario_id, u.nome AS usuario_nome, e.parada_id, e.dados, e.criado_em
       FROM eventos_rota e LEFT JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.rota_id = ? ORDER BY e.id DESC LIMIT 20`,
    [rotaId],
  );
  // Pedidos de rotas anteriores ainda abertos (ou respondidos nesta rota), para o lembrete no questionário.
  const [pedidos] = paradas.length
    ? await ex.query<RowDataPacket[]>(
        `SELECT pe.id, pe.pessoa_id, pe.descricao, pe.adiamentos, pe.levar_rota_id, pe.resposta, pe.resposta_parada_id,
                pe.parada_origem_id, r.data AS pedido_em
           FROM pedidos pe
           LEFT JOIN paradas po ON po.id = pe.parada_origem_id
           LEFT JOIN rotas r ON r.id = po.rota_id
          WHERE pe.pessoa_id IN (?) AND pe.status <> 'cancelado'
            AND (pe.status = 'aberto' OR pe.resposta_parada_id IN (?))
          ORDER BY r.data, pe.id`,
        [paradas.map((pa) => pa.pessoa_id), paradas.map((pa) => pa.id)],
      )
    : [[] as RowDataPacket[]];
  const [usuarios] = await ex.query<RowDataPacket[]>('SELECT id, nome FROM usuarios');
  const nomes = new Map(usuarios.map((u) => [u.id as number, u.nome as string]));
  const [[associacao]] = await ex.query<RowDataPacket[]>(
    'SELECT nome, endereco, latitude, longitude FROM associacao WHERE id = 1',
  );

  return {
    gerado_em: Date.now(),
    rota,
    equipe,
    paradas: paradas.map((pa) => ({
      id: pa.id,
      pessoa_id: pa.pessoa_id,
      posicao: pa.posicao,
      status: pa.status,
      ligacao_feita: pa.ligacao_feita,
      encontrada: pa.encontrada,
      deixou_comida: pa.deixou_comida,
      observacao: pa.observacao,
      pedido: pa.pedido,
      motivo_nao_visita: pa.motivo_nao_visita,
      chegada_em: pa.chegada_em,
      concluida_em: pa.concluida_em,
      // {campo: id} no banco → {campo: nome} para o ecrã ("preenchido por Rui")
      preenchido_por: Object.fromEntries(
        Object.entries((pa.preenchido_por ?? {}) as Record<string, number>).map(([campo, id]) => [campo, nomes.get(id) ?? '?']),
      ),
      pedidos_anteriores: pedidos
        .filter((pe) => pe.pessoa_id === pa.pessoa_id && pe.parada_origem_id !== pa.id)
        .map((pe) => ({
          id: pe.id,
          descricao: pe.descricao,
          pedido_em: pe.pedido_em,
          adiamentos: pe.adiamentos,
          a_levar: pe.levar_rota_id === rota.id,
          resposta: pe.resposta_parada_id === pa.id ? pe.resposta : null,
        })),
      pessoa: {
        id: pa.pessoa_id,
        nome: pa.nome,
        latitude: pa.latitude,
        longitude: pa.longitude,
        ponto_referencia: pa.ponto_referencia,
        foto_url: linkFoto(pa.foto),
        telefone: pa.telefone,
        ligar_antes_min: pa.ligar_antes_min,
      },
    })),
    eventos: eventos.reverse(),
    associacao: associacao ?? null,
  };
}

export type EstadoRota = NonNullable<Awaited<ReturnType<typeof estadoRota>>>;
