import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, urlFoto } from '../lib/api';
import type { Pessoa } from '../lib/tipos';
import { Aviso, Carregando, Etiqueta, Miniatura } from '../components/ui';

type Filtro = 'ativas' | 'pausadas' | 'todas';

export function Pessoas() {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('ativas');

  useEffect(() => {
    api<{ pessoas: Pessoa[] }>('/pessoas').then((r) => setPessoas(r.pessoas)).catch((e) => setErro(e.message));
  }, []);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt');
    return (pessoas ?? []).filter(
      (p) =>
        (filtro === 'todas' || (filtro === 'ativas') === p.ativa) &&
        (!termo || `${p.nome} ${p.ponto_referencia ?? ''} ${p.endereco ?? ''}`.toLocaleLowerCase('pt').includes(termo)),
    );
  }, [pessoas, busca, filtro]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Pessoas</h1>
        <Link to="/pessoas/nova" className="inline-flex min-h-11 items-center rounded-lg bg-marca-700 px-4 font-medium text-white hover:bg-marca-800">
          + Nova pessoa
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar por nome ou referência"
          className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base"
        />
        <div className="flex rounded-lg border border-slate-300 bg-white p-1">
          {(['ativas', 'pausadas', 'todas'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize ${filtro === f ? 'bg-marca-700 text-white' : 'text-slate-600'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {!pessoas && !erro && <Carregando />}
      {pessoas && (
        <>
          <p className="text-sm text-slate-500">
            {visiveis.length} de {pessoas.length} pessoas
          </p>
          {visiveis.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-500">
              {pessoas.length ? 'Nenhuma pessoa corresponde à procura.' : 'Ainda não há pessoas cadastradas.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {visiveis.map((p) => (
                <li key={p.id}>
                  <Link to={`/pessoas/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                    <Miniatura url={urlFoto(p.foto_url)} nome={p.nome} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.nome}</span>
                        {!p.ativa && <Etiqueta>Pausada</Etiqueta>}
                        {!p.na_rota && <Etiqueta cor="ambar">Fora da rota</Etiqueta>}
                        {p.telefone && <Etiqueta cor="verde">{p.ligar_antes_min ? `Ligar ${p.ligar_antes_min} min antes` : 'Tem telefone'}</Etiqueta>}
                      </div>
                      <p className="truncate text-sm text-slate-500">{p.ponto_referencia || p.endereco || 'Sem ponto de referência'}</p>
                    </div>
                    <span aria-hidden className="text-slate-400">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
