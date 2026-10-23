import type { EventoRota, Papel, Parada, StatusParada } from './tipos';

const PENDENTES: StatusParada[] = ['na_fila', 'em_espera', 'a_caminho', 'no_local'];
export const pendente = (p: Parada) => PENDENTES.includes(p.status);

/** A paragem em curso: no local, a caminho ou, se nenhuma, a primeira da fila. */
export function cabeca(paradas: Parada[]): Parada | null {
  return (
    paradas.find((p) => p.status === 'no_local') ??
    paradas.find((p) => p.status === 'a_caminho') ??
    paradas.find((p) => p.status === 'na_fila') ??
    null
  );
}

/** Quem vem a seguir à paragem em curso; é para esta pessoa que vale o aviso de ligação com antecedência. */
export function seguinte(paradas: Parada[], atual: Parada | null): Parada | null {
  return paradas.find((p) => p.status === 'na_fila' && p.id !== atual?.id) ?? null;
}

export function contador(paradas: Parada[]) {
  const total = paradas.length;
  const visitadas = paradas.filter((p) => p.status === 'concluida').length;
  const naoVisitadas = paradas.filter((p) => p.status === 'nao_visitada').length;
  return { total, visitadas, naoVisitadas, faltam: total - visitadas - naoVisitadas };
}

export function textoContador(paradas: Parada[]): string {
  const c = contador(paradas);
  const faltam = c.faltam === 0 ? 'não falta ninguém' : c.faltam === 1 ? 'falta 1' : `faltam ${c.faltam}`;
  return `${c.visitadas} de ${c.total} visitadas · ${faltam}`;
}

/** Link de navegação do Google Maps; não exige chave de API e abre o app no Android e no iPhone. */
export const linkMaps = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

export const NOME_PAPEL: Record<Papel, string> = { motorista: 'Motorista', relatorio: 'Relatório', acompanhante: 'Acompanhante' };

export const primeiroNome = (nome: string) => nome.split(' ')[0];

/** Aviso curto que a equipa vê quando outra pessoa mexe na fila: "Ana trocou a próxima para João". */
export function textoEvento(e: EventoRota): string | null {
  const quem = e.usuario_nome ? primeiroNome(e.usuario_nome) : 'Alguém';
  const pessoa = typeof e.dados?.pessoa === 'string' ? e.dados.pessoa : '';
  switch (e.tipo) {
    case 'iniciou':
      return `${quem} iniciou a rota`;
    case 'sim':
      return `${quem} confirmou ${pessoa}: a caminho`;
    case 'depois':
      return `${quem} deixou ${pessoa} para depois`;
    case 'ir_agora':
      return `${quem} trocou a próxima para ${pessoa}`;
    case 'trocar':
      return `${quem} devolveu ${pessoa} à fila`;
    case 'chegou':
      return `${quem} marcou a chegada a ${pessoa}`;
    case 'voltar':
      return `${quem} desfez a chegada a ${pessoa}`;
    case 'concluir_paragem':
      return `${quem} concluiu a paragem de ${pessoa}`;
    case 'ligacao':
      return `${quem} ligou a ${pessoa}`;
    case 'iniciar_retorno':
      return `${quem} encerrou as visitas: regresso à Associação`;
    case 'voltar_a_rota':
      return `${quem} retomou a rota`;
    case 'concluir_rota':
      return `${quem} concluiu a rota`;
    case 'equipe':
      return `${quem} alterou a equipa`;
    case 'entrou':
      return `${quem} entrou na equipa`;
    default:
      return null;
  }
}
