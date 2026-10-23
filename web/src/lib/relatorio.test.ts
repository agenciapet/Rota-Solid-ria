import { describe, expect, it } from 'vitest';
import { kmTexto, linhaPessoa, ordemDaVisita, textoWhatsApp, totais } from './relatorio';
import type { EstadoRota, Parada } from './tipos';

const parada = (dados: Partial<Parada> & { nome: string }): Parada =>
  ({
    id: Math.random(),
    posicao: 1,
    status: 'concluida',
    encontrada: true,
    deixou_comida: true,
    observacao: null,
    pedido: null,
    motivo_nao_visita: null,
    concluida_em: null,
    pedidos_anteriores: [],
    ...dados,
    pessoa: { nome: dados.nome },
  }) as unknown as Parada;

describe('linhaPessoa', () => {
  it('segue o formato do exemplo da especificação', () => {
    expect(linhaPessoa(parada({ nome: 'João' }))).toBe('João · encontrada · comida entregue');
    expect(linhaPessoa(parada({ nome: 'Maria', encontrada: false }))).toBe('Maria · não encontrada');
    expect(linhaPessoa(parada({ nome: 'Teresa', pedido: 'cobertor' }))).toBe('Teresa · encontrada · comida entregue · *Pedido: cobertor*');
    expect(linhaPessoa(parada({ nome: 'Manuel', observacao: 'mudou para a porta ao lado' }))).toBe(
      'Manuel · encontrada · comida entregue · Obs.: mudou para a porta ao lado',
    );
    expect(
      linhaPessoa(parada({ nome: 'António', pedidos_anteriores: [{ id: 1, descricao: 'meias', pedido_em: '2026-09-28', adiamentos: 0, a_levar: true, resposta: 'entregue' }] })),
    ).toBe('António · encontrada · comida entregue · Pedido entregue: meias');
    expect(linhaPessoa(parada({ nome: 'Carlos', status: 'nao_visitada', motivo_nao_visita: 'rua cortada' }))).toBe('Carlos · não visitada (rua cortada)');
  });
});

describe('ordemDaVisita e totais', () => {
  const lista = [
    parada({ nome: 'C', posicao: 3, status: 'nao_visitada' }),
    parada({ nome: 'B', posicao: 2, concluida_em: '2026-10-05T10:00:00.000Z' }),
    parada({ nome: 'A', posicao: 1, concluida_em: '2026-10-05T11:00:00.000Z', encontrada: false, deixou_comida: null }),
  ];
  it('ordena pela hora da visita e põe as não visitadas no fim', () => {
    expect(ordemDaVisita(lista).map((p) => p.pessoa.nome)).toEqual(['B', 'A', 'C']);
  });
  it('conta visitadas, encontradas e comidas', () => {
    expect(totais(lista)).toEqual({ total: 3, visitadas: 2, naoVisitadas: 1, encontradas: 1, naoEncontradas: 1, comidas: 1 });
  });
});

describe('textoWhatsApp', () => {
  it('monta o cabeçalho, os totais e as linhas numeradas', () => {
    const estado = {
      rota: { data: '2026-10-05', km_inicial: 45210, km_final: 45238 },
      equipe: [
        { nome: 'Ana Silva', papel: 'motorista' },
        { nome: 'Rui Costa', papel: 'relatorio' },
      ],
      paradas: [parada({ nome: 'João', concluida_em: '1' }), parada({ nome: 'Carlos', status: 'nao_visitada', motivo_nao_visita: 'rua cortada' })],
    } as unknown as EstadoRota;
    expect(textoWhatsApp(estado)).toBe(
      [
        '*Rota 05/10* (segunda)',
        'Equipa: Ana (motorista), Rui (relatório)',
        'Km: 45.210 a 45.238 · 28 km',
        'Visitadas: 1 de 2 · Encontradas: 1 · Comidas entregues: 1',
        '',
        '1. João · encontrada · comida entregue',
        '2. Carlos · não visitada (rua cortada)',
      ].join('\n'),
    );
  });
  it('formata os km com ponto de milhar', () => {
    expect(kmTexto(999)).toBe('999');
    expect(kmTexto(1234567)).toBe('1.234.567');
  });
});
