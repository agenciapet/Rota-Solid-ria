import { describe, expect, it } from 'vitest';
import { comprimento, distancia, formatarDistancia, percurso, sugerirPosicao } from './rota';

// Pontos numa linha leste-oeste em Lisboa, ~100 m entre cada um.
const p = (metrosLeste: number) => ({ lat: 38.72, lng: -9.14 + metrosLeste / 87_000 });

describe('distancia', () => {
  it('mede ~100 m entre pontos vizinhos', () => {
    expect(distancia(p(0), p(100))).toBeGreaterThan(95);
    expect(distancia(p(0), p(100))).toBeLessThan(105);
  });
});

describe('sugerirPosicao', () => {
  const base = p(0);
  const paragens = [p(100), p(200), p(300), p(400)];

  it('encaixa entre as duas paragens vizinhas', () => {
    expect(sugerirPosicao(paragens, p(250), base).indice).toBe(2);
  });

  it('desvio quase nulo quando o ponto está no caminho', () => {
    expect(sugerirPosicao(paragens, p(250), base).desvio).toBeLessThan(1);
  });

  it('pode sugerir a primeira posição', () => {
    expect(sugerirPosicao(paragens, p(50), base).indice).toBe(0);
  });

  it('considera o regresso à Associação', () => {
    // Para além da última paragem: o melhor é antes do regresso, no fim.
    expect(sugerirPosicao(paragens, p(500), base).indice).toBe(4);
  });

  it('rota vazia: primeira posição, ida e volta como desvio', () => {
    const r = sugerirPosicao([], p(100), base);
    expect(r.indice).toBe(0);
    expect(r.desvio).toBeCloseTo(2 * distancia(base, p(100)));
  });

  it('sem Associação: acrescenta no início ou no fim sem pontos imaginários', () => {
    expect(sugerirPosicao(paragens, p(500), null).indice).toBe(4);
    expect(sugerirPosicao(paragens, p(0), null).indice).toBe(0);
  });

  it('o desvio é a diferença real de comprimento do percurso', () => {
    const novo = { lat: 38.721, lng: p(250).lng };
    const { indice, desvio } = sugerirPosicao(paragens, novo, base);
    const depois = [...paragens.slice(0, indice), novo, ...paragens.slice(indice)];
    expect(comprimento(percurso(depois, base)) - comprimento(percurso(paragens, base))).toBeCloseTo(desvio);
  });
});

describe('formatarDistancia', () => {
  it('usa metros e quilómetros com vírgula', () => {
    expect(formatarDistancia(123)).toBe('120 m');
    expect(formatarDistancia(12_400)).toBe('12,4 km');
  });
});
