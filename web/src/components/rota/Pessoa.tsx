import { useState } from 'react';
import { urlFoto } from '../../lib/api';
import { dataCurta } from '../../lib/relatorio';
import type { Parada } from '../../lib/tipos';
import { Botao } from '../ui';

/** Cartão da pessoa nas telas da rota: foto do local, nome e ponto de referência. */
export function CartaoPessoa({
  parada,
  rotulo,
  compacto,
  semPedidos,
}: {
  parada: Parada;
  rotulo: string;
  compacto?: boolean;
  /** O questionário mostra os pedidos num bloco próprio. */
  semPedidos?: boolean;
}) {
  const p = parada.pessoa;
  const foto = urlFoto(p.foto_url);
  const pedidos = semPedidos ? [] : parada.pedidos_anteriores.filter((a) => a.resposta !== 'entregue');
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {foto ? (
        <img src={foto} alt="Foto do local" className={`w-full object-cover ${compacto ? 'h-36' : 'h-60'}`} />
      ) : (
        !compacto && <div className="flex h-28 items-center justify-center bg-slate-100 text-slate-400">Sem foto do local</div>
      )}
      <div className="p-4">
        <p className="text-xs font-semibold tracking-wide text-marca-700 uppercase">{rotulo}</p>
        <h2 className={`font-semibold ${compacto ? 'text-xl' : 'text-2xl'}`}>{p.nome}</h2>
        {p.ponto_referencia && <p className="mt-1 text-slate-700">{p.ponto_referencia}</p>}
        {pedidos.length > 0 && (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-sm text-amber-900">
            <span className="font-semibold">Pedido em aberto:</span>{' '}
            {pedidos.map((a) => `${a.descricao}${a.pedido_em ? ` (${dataCurta(a.pedido_em)})` : ''}${a.a_levar ? ' · a levar hoje' : ''}`).join('; ')}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Lembrete de ligação. "atual": quem tem telefone, antes de chegar. "seguinte": quem pede
 * antecedência aparece já na paragem anterior, porque o app não rastreia o carro.
 */
export function AvisoLigacao({
  parada,
  modo,
  bloqueado,
  onFeita,
}: {
  parada: Parada;
  modo: 'atual' | 'seguinte';
  bloqueado: boolean;
  onFeita: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const p = parada.pessoa;
  if (!p.telefone || parada.ligacao_feita) return null;
  if (modo === 'seguinte' && !p.ligar_antes_min) return null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(p.telefone!);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem acesso à área de transferência: o número está visível para marcar à mão */
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
      <p className="font-semibold text-amber-900">
        {modo === 'atual' ? 'Ligar antes de chegar' : `A seguir: ${p.nome.replace(/\.$/, '')}. Ligar agora, pede ${p.ligar_antes_min} minutos.`}
      </p>
      {modo === 'atual' && p.ligar_antes_min && <p className="text-sm text-amber-800">Pede {p.ligar_antes_min} minutos de antecedência.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={`tel:${p.telefone.replace(/\s+/g, '')}`}
          className="inline-flex min-h-11 items-center rounded-lg bg-amber-500 px-4 text-lg font-semibold text-slate-900"
        >
          {p.telefone}
        </a>
        <Botao type="button" variante="secundario" onClick={copiar}>
          {copiado ? 'Copiado' : 'Copiar'}
        </Botao>
        <Botao type="button" variante="secundario" onClick={onFeita} disabled={bloqueado}>
          Ligação feita
        </Botao>
      </div>
    </div>
  );
}
