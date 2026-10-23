import { describe, expect, it } from 'vitest';
import { cabeca, contador, seguinte, textoContador, textoEvento } from './fila';
import type { Parada, StatusParada } from './tipos';

const parada = (id: number, status: StatusParada): Parada =>
  ({ id, status, posicao: id, pessoa: { id, nome: `P${id}` } }) as unknown as Parada;

describe('cabeca', () => {
  it('é a primeira da fila quando ninguém está a caminho', () => {
    expect(cabeca([parada(1, 'concluida'), parada(2, 'em_espera'), parada(3, 'na_fila')])?.id).toBe(3);
  });
  it('é quem está no local ou a caminho, mesmo com outras antes na fila', () => {
    expect(cabeca([parada(1, 'na_fila'), parada(2, 'a_caminho')])?.id).toBe(2);
    expect(cabeca([parada(1, 'na_fila'), parada(2, 'no_local'), parada(3, 'a_caminho')])?.id).toBe(2);
  });
  it('é nula quando só restam pessoas em espera', () => {
    expect(cabeca([parada(1, 'concluida'), parada(2, 'em_espera')])).toBeNull();
  });
});

describe('seguinte', () => {
  it('salta a paragem em curso', () => {
    const lista = [parada(1, 'a_caminho'), parada(2, 'na_fila'), parada(3, 'na_fila')];
    expect(seguinte(lista, cabeca(lista))?.id).toBe(2);
  });
});

describe('contador', () => {
  const lista = [parada(1, 'concluida'), parada(2, 'nao_visitada'), parada(3, 'em_espera'), parada(4, 'na_fila')];
  it('conta visitadas e quem falta', () => {
    expect(contador(lista)).toEqual({ total: 4, visitadas: 1, naoVisitadas: 1, faltam: 2 });
    expect(textoContador(lista)).toBe('1 de 4 visitadas · faltam 2');
  });
  it('tem singular e fim de fila', () => {
    expect(textoContador([parada(1, 'concluida'), parada(2, 'na_fila')])).toBe('1 de 2 visitadas · falta 1');
    expect(textoContador([parada(1, 'concluida')])).toBe('1 de 1 visitadas · não falta ninguém');
  });
});

describe('textoEvento', () => {
  it('descreve a troca com o primeiro nome de quem tocou', () => {
    expect(textoEvento({ id: 1, tipo: 'ir_agora', usuario_id: 2, usuario_nome: 'Ana Silva', parada_id: 3, dados: { pessoa: 'João' }, criado_em: '' })).toBe(
      'Ana trocou a próxima para João',
    );
  });
  it('ignora eventos sem texto', () => {
    expect(textoEvento({ id: 1, tipo: 'outro', usuario_id: null, usuario_nome: null, parada_id: null, dados: null, criado_em: '' })).toBeNull();
  });
});
