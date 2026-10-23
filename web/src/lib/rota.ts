import type { Ponto } from './tipos';

const RAIO_TERRA_M = 6_371_000;
const rad = (graus: number) => (graus * Math.PI) / 180;

/** Distância em linha reta (haversine), em metros. */
export function distancia(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.sqrt(h));
}

/** Comprimento do percurso que liga os pontos pela ordem dada. */
export function comprimento(pontos: Ponto[]): number {
  let total = 0;
  for (let i = 1; i < pontos.length; i++) total += distancia(pontos[i - 1], pontos[i]);
  return total;
}

/** Percurso completo: sai da Associação, passa pelas paragens e volta a ela. */
export function percurso(paragens: Ponto[], base: Ponto | null): Ponto[] {
  return base ? [base, ...paragens, base] : paragens;
}

/**
 * Sugere onde encaixar um ponto novo: entre as duas paragens vizinhas em que o desvio é menor.
 * Devolve o índice de inserção em `paragens` (0 = primeira paragem) e o desvio em metros.
 * Usa linha reta, por isso não vê ruas de sentido único: a decisão final é do adm.
 */
export function sugerirPosicao(paragens: Ponto[], novo: Ponto, base: Ponto | null): { indice: number; desvio: number } {
  const n = paragens.length;
  if (n === 0) return { indice: 0, desvio: base ? 2 * distancia(base, novo) : 0 };

  let melhor = { indice: n, desvio: Infinity };
  for (let i = 0; i <= n; i++) {
    const antes = i === 0 ? base : paragens[i - 1];
    const depois = i === n ? base : paragens[i];
    let desvio: number;
    if (antes && depois) desvio = distancia(antes, novo) + distancia(novo, depois) - distancia(antes, depois);
    else if (antes) desvio = distancia(antes, novo); // sem Associação: acrescentar no fim
    else desvio = distancia(novo, depois!); // sem Associação: acrescentar no início
    if (desvio < melhor.desvio) melhor = { indice: i, desvio };
  }
  return melhor;
}

export function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`;
  return `${(metros / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} km`;
}
