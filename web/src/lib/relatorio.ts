import { NOME_PAPEL, primeiroNome } from './fila';
import type { EstadoRota, Parada } from './tipos';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** 45210 → "45.210", como no exemplo da especificação. */
export const kmTexto = (km: number) => String(km).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const dataCurta = (data: string | null) => {
  if (!data) return '';
  const [, m, d] = data.slice(0, 10).split('-');
  return `${d}/${m}`;
};

export function totais(paradas: Parada[]) {
  const concluidas = paradas.filter((p) => p.status === 'concluida');
  return {
    total: paradas.length,
    visitadas: concluidas.length,
    naoVisitadas: paradas.filter((p) => p.status === 'nao_visitada').length,
    encontradas: concluidas.filter((p) => p.encontrada).length,
    naoEncontradas: concluidas.filter((p) => p.encontrada === false).length,
    comidas: concluidas.filter((p) => p.deixou_comida).length,
  };
}

/** Uma linha por pessoa, na ordem da visita; as não visitadas no fim, pela ordem da fila. */
export function ordemDaVisita(paradas: Parada[]): Parada[] {
  const concluidas = paradas
    .filter((p) => p.status === 'concluida')
    .sort((a, b) => (a.concluida_em ?? '').localeCompare(b.concluida_em ?? '') || a.posicao - b.posicao);
  const restantes = paradas.filter((p) => p.status !== 'concluida').sort((a, b) => a.posicao - b.posicao);
  return [...concluidas, ...restantes];
}

export function estadoTexto(p: Parada): string {
  if (p.status === 'nao_visitada') return `não visitada${p.motivo_nao_visita ? ` (${p.motivo_nao_visita})` : ''}`;
  if (p.status !== 'concluida') return 'não visitada';
  if (p.encontrada) return p.deixou_comida ? 'encontrada · comida entregue' : 'encontrada · comida não entregue';
  return 'não encontrada';
}

export function linhaPessoa(p: Parada): string {
  const partes = [p.pessoa.nome, estadoTexto(p)];
  if (p.observacao) partes.push(`Obs.: ${p.observacao.replace(/\s+/g, ' ').trim()}`);
  if (p.pedido) partes.push(`*Pedido: ${p.pedido.replace(/\s+/g, ' ').trim()}*`);
  for (const a of p.pedidos_anteriores) {
    if (a.resposta) partes.push(`Pedido ${a.resposta}: ${a.descricao}`);
  }
  return partes.join(' · ');
}

/** O resumo já formatado para colar no grupo do WhatsApp; o envio é manual. */
export function textoWhatsApp(estado: EstadoRota): string {
  const { rota, equipe, paradas } = estado;
  const d = new Date(rota.data.slice(0, 10) + 'T12:00:00');
  const t = totais(paradas);
  const linhas = [
    `*Rota ${dataCurta(rota.data)}* (${DIAS[d.getDay()]})`,
    `Equipa: ${equipe.map((m) => `${primeiroNome(m.nome)} (${NOME_PAPEL[m.papel].toLowerCase()})`).join(', ')}`,
  ];
  if (rota.km_final !== null) linhas.push(`Km: ${kmTexto(rota.km_inicial)} a ${kmTexto(rota.km_final)} · ${rota.km_final - rota.km_inicial} km`);
  linhas.push(`Visitadas: ${t.visitadas} de ${t.total} · Encontradas: ${t.encontradas} · Comidas entregues: ${t.comidas}`, '');
  ordemDaVisita(paradas).forEach((p, i) => linhas.push(`${i + 1}. ${linhaPessoa(p)}`));
  return linhas.join('\n');
}
