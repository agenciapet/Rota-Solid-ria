import { urlFoto } from '../../lib/api';
import { cabeca } from '../../lib/fila';
import type { EstadoRota, Parada } from '../../lib/tipos';
import { Botao, Etiqueta, Miniatura } from '../ui';

function Linha({ parada, direita, destaque, onClick }: { parada: Parada; direita?: React.ReactNode; destaque?: boolean; onClick?: () => void }) {
  const p = parada.pessoa;
  const conteudo = (
    <>
      <Miniatura url={urlFoto(p.foto_url)} nome={p.nome} tamanho="h-11 w-11" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{p.nome}</span>
        <span className="block truncate text-sm text-slate-500">
          {parada.status === 'concluida'
            ? parada.encontrada
              ? `Encontrada${parada.deixou_comida ? ' · comida entregue' : ''}${parada.pedido ? ` · pedido: ${parada.pedido}` : ''}`
              : 'Não encontrada'
            : parada.status === 'nao_visitada'
              ? `Não visitada${parada.motivo_nao_visita ? ` · ${parada.motivo_nao_visita}` : ''}`
              : p.ponto_referencia || 'Sem ponto de referência'}
        </span>
      </span>
    </>
  );
  return (
    <li className={`flex items-center gap-3 px-3 py-2 ${destaque ? 'bg-marca-50' : 'bg-white'}`}>
      {onClick ? (
        <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {conteudo}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{conteudo}</div>
      )}
      {direita}
    </li>
  );
}

function Seccao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-1 pb-1.5 text-sm font-semibold tracking-wide text-slate-500 uppercase">{titulo}</h2>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">{children}</ul>
    </section>
  );
}

/** Quem falta, quem está em espera e quem já foi visitado; "Ir agora" em qualquer pessoa. */
export function Fila({
  estado,
  bloqueado,
  soEscolher,
  onIrAgora,
  onEditar,
  onEncerrar,
}: {
  estado: EstadoRota;
  bloqueado: boolean;
  /** Todas as que faltam estão em espera: a equipa tem de escolher. */
  soEscolher?: boolean;
  onIrAgora: (parada: Parada) => void;
  onEditar: (parada: Parada) => void;
  onEncerrar: () => void;
}) {
  const { paradas, rota } = estado;
  const atual = cabeca(paradas);
  const porVisitar = paradas.filter((p) => p.status === 'na_fila');
  const emEspera = paradas.filter((p) => p.status === 'em_espera');
  const emCurso = paradas.filter((p) => p.status === 'a_caminho' || p.status === 'no_local');
  const feitas = paradas.filter((p) => p.status === 'concluida' || p.status === 'nao_visitada');
  const emAndamento = rota.status === 'em_andamento';
  const podeEditar = rota.status !== 'concluida';

  const irAgora = (p: Parada) => (
    <Botao variante={p.id === atual?.id ? 'primario' : 'secundario'} className="min-h-10 shrink-0 px-3 text-sm" disabled={bloqueado || !emAndamento} onClick={() => onIrAgora(p)}>
      Ir agora
    </Botao>
  );

  return (
    <div className="space-y-4">
      {soEscolher && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Todas as pessoas que faltam ficaram para depois. Escolha quem visitar a seguir.
        </p>
      )}
      {emCurso.length > 0 && (
        <Seccao titulo="Em curso">
          {emCurso.map((p) => (
            <Linha key={p.id} parada={p} destaque direita={<Etiqueta cor="verde">{p.status === 'no_local' ? 'No local' : 'A caminho'}</Etiqueta>} />
          ))}
        </Seccao>
      )}
      {porVisitar.length > 0 && (
        <Seccao titulo={`Por visitar · ${porVisitar.length}`}>
          {porVisitar.map((p) => (
            <Linha key={p.id} parada={p} destaque={p.id === atual?.id} direita={irAgora(p)} />
          ))}
        </Seccao>
      )}
      {emEspera.length > 0 && (
        <Seccao titulo={`Em espera · ${emEspera.length}`}>
          {emEspera.map((p) => (
            <Linha key={p.id} parada={p} direita={irAgora(p)} />
          ))}
        </Seccao>
      )}
      {feitas.length > 0 && (
        <Seccao titulo={`Visitadas · ${feitas.length}`}>
          {feitas.map((p) => (
            <Linha
              key={p.id}
              parada={p}
              onClick={podeEditar && p.status === 'concluida' ? () => onEditar(p) : undefined}
              direita={p.status === 'concluida' ? <Etiqueta cor={p.encontrada ? 'verde' : 'cinza'}>{p.encontrada ? 'Encontrada' : 'Não encontrada'}</Etiqueta> : <Etiqueta>Não visitada</Etiqueta>}
            />
          ))}
        </Seccao>
      )}
      {emAndamento && (
        <div className="pt-2">
          <Botao variante="perigo" className="w-full" disabled={bloqueado || emCurso.length > 0} onClick={onEncerrar}>
            Encerrar visitas e regressar à Associação
          </Botao>
          {emCurso.length > 0 && <p className="mt-1 text-center text-xs text-slate-500">Conclua ou devolva à fila a paragem em curso primeiro.</p>}
          {porVisitar.length + emEspera.length > 0 && emCurso.length === 0 && (
            <p className="mt-1 text-center text-xs text-slate-500">
              As {porVisitar.length + emEspera.length} pessoas que faltam entram no relatório como "não visitadas".
            </p>
          )}
        </div>
      )}
    </div>
  );
}
