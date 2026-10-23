import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { NOME_PAPEL } from '../../lib/fila';
import { dataCurta, estadoTexto, kmTexto, ordemDaVisita, textoWhatsApp, totais } from '../../lib/relatorio';
import { useSessao } from '../../lib/sessao';
import type { EstadoRota } from '../../lib/tipos';
import { Botao, Cartao, Etiqueta } from '../ui';

const dataLonga = (data: string) =>
  new Date(data.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Relatório da rota concluída: cabeçalho, totais, uma linha por pessoa e o texto pronto para o WhatsApp. */
export function Relatorio({ estado }: { estado: EstadoRota }) {
  const { usuario } = useSessao();
  const { rota, equipe, paradas } = estado;
  const t = totais(paradas);
  const texto = textoWhatsApp(estado);
  const [copiado, setCopiado] = useState(false);
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const areaTexto = useRef<HTMLTextAreaElement>(null);
  const distancia = rota.km_final !== null ? rota.km_final - rota.km_inicial : null;
  const linhas = ordemDaVisita(paradas);
  const respondidos = paradas.flatMap((p) => p.pedidos_anteriores.filter((a) => a.resposta).map((a) => ({ ...a, pessoa: p.pessoa.nome })));
  const novos = paradas.filter((p) => p.pedido);
  const podePartilhar = typeof navigator.share === 'function';

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem acesso à área de transferência (ex.: http na rede local): mostra o texto para copiar à mão.
      setMostrarTexto(true);
      requestAnimationFrame(() => areaTexto.current?.select());
    }
  }

  async function partilhar() {
    try {
      await navigator.share({ text: texto });
    } catch {
      /* cancelado */
    }
  }

  return (
    <div className="space-y-3">
      <Cartao titulo="Relatório da rota">
        <p className="text-slate-700">{dataLonga(rota.data)}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-slate-500">Equipa</dt>
          <dd>{equipe.map((m) => `${m.nome} (${NOME_PAPEL[m.papel].toLowerCase()})`).join(', ')}</dd>
          <dt className="text-slate-500">Km</dt>
          <dd>
            {kmTexto(rota.km_inicial)} a {rota.km_final !== null ? kmTexto(rota.km_final) : '—'}
            {distancia !== null && <strong> · {distancia} km</strong>}
          </dd>
        </dl>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Visitadas', `${t.visitadas} de ${t.total}`],
            ['Encontradas', t.encontradas],
            ['Não encontradas', t.naoEncontradas],
            ['Comidas entregues', t.comidas],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{rotulo}</p>
              <p className="text-xl font-semibold">{valor}</p>
            </div>
          ))}
        </div>
        {t.naoVisitadas > 0 && (
          <p className="mt-2 text-sm text-slate-600">
            {t.naoVisitadas} {t.naoVisitadas === 1 ? 'pessoa não visitada' : 'pessoas não visitadas'}.
          </p>
        )}
      </Cartao>

      <Cartao titulo="Mensagem para o WhatsApp">
        <p className="mb-3 text-sm text-slate-600">O texto já vem formatado com os totais e uma linha por pessoa. O envio para o grupo é manual.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Botao className="min-h-12 flex-1" onClick={copiar}>
            {copiado ? 'Copiado!' : 'Copiar texto'}
          </Botao>
          {podePartilhar && (
            <Botao variante="secundario" className="min-h-12" onClick={partilhar}>
              Partilhar…
            </Botao>
          )}
          <Botao variante="fantasma" className="min-h-12" onClick={() => setMostrarTexto(!mostrarTexto)}>
            {mostrarTexto ? 'Esconder' : 'Ver texto'}
          </Botao>
        </div>
        {mostrarTexto && (
          <textarea
            ref={areaTexto}
            readOnly
            value={texto}
            rows={Math.min(24, texto.split('\n').length + 1)}
            onFocus={(e) => e.target.select()}
            className="mt-3 block w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs"
          />
        )}
      </Cartao>

      <Cartao titulo={`Pessoas · ${linhas.length}`}>
        <ol className="divide-y divide-slate-100">
          {linhas.map((p, i) => {
            const pedidoNovo = !!p.pedido;
            const respostas = p.pedidos_anteriores.filter((a) => a.resposta);
            return (
              <li key={p.id} className={`flex gap-3 py-2.5 ${pedidoNovo ? '-mx-2 rounded-lg bg-amber-50 px-2' : ''}`}>
                <span className="w-6 shrink-0 pt-0.5 text-right text-sm text-slate-400">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {usuario?.tipo === 'adm' ? (
                      <Link to={`/pessoas/${p.pessoa_id}`} className="font-medium text-marca-700 hover:underline">
                        {p.pessoa.nome}
                      </Link>
                    ) : (
                      <span className="font-medium">{p.pessoa.nome}</span>
                    )}
                    <Etiqueta cor={p.status === 'concluida' && p.encontrada ? 'verde' : 'cinza'}>{estadoTexto(p)}</Etiqueta>
                  </div>
                  {p.observacao && <p className="text-sm text-slate-600">Obs.: {p.observacao}</p>}
                  {pedidoNovo && <p className="text-sm font-semibold text-amber-900">Pedido: {p.pedido}</p>}
                  {respostas.map((a) => (
                    <p key={a.id} className="text-sm text-slate-700">
                      Pedido {a.resposta}: {a.descricao}
                      {a.pedido_em && <span className="text-slate-500"> (pediu em {dataCurta(a.pedido_em)})</span>}
                    </p>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </Cartao>

      {(respondidos.length > 0 || novos.length > 0) && (
        <Cartao titulo="Pedidos nesta rota">
          {respondidos.filter((a) => a.resposta === 'entregue').length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-slate-500">Entregues</h3>
              <ul className="mb-3 list-inside list-disc text-sm">
                {respondidos.filter((a) => a.resposta === 'entregue').map((a) => (
                  <li key={a.id}>
                    {a.pessoa}: {a.descricao}
                  </li>
                ))}
              </ul>
            </>
          )}
          {respondidos.filter((a) => a.resposta === 'adiado').length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-slate-500">Adiados (voltam a lembrar na próxima rota)</h3>
              <ul className="mb-3 list-inside list-disc text-sm">
                {respondidos.filter((a) => a.resposta === 'adiado').map((a) => (
                  <li key={a.id}>
                    {a.pessoa}: {a.descricao}
                  </li>
                ))}
              </ul>
            </>
          )}
          {novos.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-slate-500">Novos pedidos</h3>
              <ul className="list-inside list-disc text-sm">
                {novos.map((p) => (
                  <li key={p.id}>
                    {p.pessoa.nome}: {p.pedido}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Cartao>
      )}
    </div>
  );
}
