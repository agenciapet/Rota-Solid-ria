import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { arrayMove } from '@dnd-kit/sortable';
import { api, ErroApi, urlFoto } from '../lib/api';
import { comprimento, formatarDistancia, percurso, sugerirPosicao } from '../lib/rota';
import type { Associacao, Pessoa, Ponto } from '../lib/tipos';
import { MapaRota, type ItemMapa } from '../components/MapaRota';
import { idLinha, ListaRota } from '../components/ListaRota';
import { Botao, Carregando, Etiqueta, Miniatura } from '../components/ui';

const pontoDe = (p: Pessoa): Ponto => ({ lat: p.latitude, lng: p.longitude });

type EstadoGravacao = 'guardado' | 'a_guardar' | 'erro' | 'conflito';

/**
 * Grava a ordem no servidor a cada alteração, uma gravação de cada vez.
 * Se o adm mexer enquanto uma gravação decorre, só a ordem mais recente é enviada a seguir.
 */
function useGravacaoOrdem() {
  const versao = useRef(0);
  const pendente = useRef<number[] | null>(null);
  const emCurso = useRef(false);
  const [estado, setEstado] = useState<EstadoGravacao>('guardado');

  const correr = useCallback(async () => {
    if (emCurso.current || !pendente.current) return;
    emCurso.current = true;
    const ordem = pendente.current;
    pendente.current = null;
    setEstado('a_guardar');
    let falhou = false;
    try {
      const r = await api<{ versao: number }>('/rota-modelo', { method: 'PUT', json: { ordem, versao: versao.current } });
      versao.current = r.versao;
    } catch (e) {
      falhou = true;
      pendente.current ??= ordem;
      setEstado(e instanceof ErroApi && e.status === 409 ? 'conflito' : 'erro');
    } finally {
      emCurso.current = false;
    }
    if (falhou) return;
    if (pendente.current) void correr();
    else setEstado('guardado');
  }, []);

  const guardar = useCallback(
    (ordem: number[]) => {
      pendente.current = ordem;
      void correr();
    },
    [correr],
  );

  const reiniciar = useCallback((novaVersao: number) => {
    versao.current = novaVersao;
    pendente.current = null;
    setEstado('guardado');
  }, []);

  return { estado, guardar, tentarDeNovo: correr, reiniciar };
}

interface Previa {
  id: number;
  /** Posição sugerida (numeração das paragens ativas). */
  sugerida: number;
  /** Ordem antes da prévia, para cancelar. */
  antes: number[];
}

export function MontagemRota() {
  const [pessoas, setPessoas] = useState<Map<number, Pessoa> | null>(null);
  const [ordem, setOrdem] = useState<number[]>([]);
  const [base, setBase] = useState<Ponto | null>(null);
  const [erroCarga, setErroCarga] = useState('');
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [focar, setFocar] = useState<{ ponto: Ponto; vez: number } | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [historico, setHistorico] = useState<number[][]>([]);
  const [aviso, setAviso] = useState('');
  const [params, setParams] = useSearchParams();
  const gravacao = useGravacaoOrdem();
  const pessoasRef = useRef(pessoas);
  pessoasRef.current = pessoas;

  // ---- seleção sincronizada entre mapa e lista ----
  const selecionar = useCallback((id: number | null, origem: 'mapa' | 'lista', mapa?: Map<number, Pessoa>) => {
    setSelecionado(id);
    if (id === null) return;
    if (origem === 'mapa') {
      requestAnimationFrame(() => document.getElementById(idLinha(id))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    } else {
      const p = (mapa ?? pessoasRef.current)?.get(id);
      if (p) setFocar({ ponto: pontoDe(p), vez: Date.now() });
    }
  }, []);

  // ---- inclusão com sugestão de posição ----
  const iniciarPrevia = useCallback(
    (id: number, mapa: Map<number, Pessoa>, ordemAtual: number[], baseAtual: Ponto | null) => {
      const p = mapa.get(id);
      if (!p) return;
      if (ordemAtual.includes(id)) return selecionar(id, 'lista', mapa);

      const ativos = ordemAtual.filter((x) => mapa.get(x)?.ativa);
      const { indice } = sugerirPosicao(ativos.map((x) => pontoDe(mapa.get(x)!)), pontoDe(p), baseAtual);
      const posicao =
        indice < ativos.length
          ? ordemAtual.indexOf(ativos[indice])
          : ativos.length
            ? ordemAtual.indexOf(ativos[ativos.length - 1]) + 1
            : ordemAtual.length;
      const nova = [...ordemAtual];
      nova.splice(posicao, 0, id);
      setPrevia({ id, sugerida: indice + 1, antes: ordemAtual });
      setOrdem(nova);
      setAviso('');
      selecionar(id, 'lista', mapa);
      requestAnimationFrame(() => document.getElementById(idLinha(id))?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    },
    [selecionar],
  );

  // ---- carga ----
  const carregar = useCallback(async () => {
    setErroCarga('');
    try {
      const [p, r, a] = await Promise.all([
        api<{ pessoas: Pessoa[] }>('/pessoas'),
        api<{ versao: number; ordem: number[] }>('/rota-modelo'),
        api<{ associacao: Associacao | null }>('/associacao'),
      ]);
      const mapa = new Map(p.pessoas.map((x) => [x.id, x]));
      const ordemValida = r.ordem.filter((id) => mapa.has(id));
      const baseAtual =
        a.associacao?.latitude != null && a.associacao.longitude != null
          ? { lat: a.associacao.latitude, lng: a.associacao.longitude }
          : null;
      setPessoas(mapa);
      setOrdem(ordemValida);
      setBase(baseAtual);
      setHistorico([]);
      setPrevia(null);
      gravacao.reiniciar(r.versao);
      return { mapa, ordem: ordemValida, base: baseAtual };
    } catch (e) {
      setErroCarga((e as Error).message);
      return null;
    }
  }, [gravacao.reiniciar]);

  const pedidaPorLink = useRef(params.get('pessoa'));
  useEffect(() => {
    carregar().then((dados) => {
      const id = Number(pedidaPorLink.current);
      if (dados && id) iniciarPrevia(id, dados.mapa, dados.ordem, dados.base);
    });
  }, [carregar, iniciarPrevia]);

  // O aviso some sozinho para não roubar espaço à lista no telemóvel.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  // Avisa antes de sair com uma gravação por terminar.
  useEffect(() => {
    if (gravacao.estado === 'guardado' && !previa) return;
    const aoSair = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [gravacao.estado, previa]);

  // ---- derivados ----
  const numeros = useMemo(() => {
    const m = new Map<number, number>();
    let n = 0;
    for (const id of ordem) if (pessoas?.get(id)?.ativa) m.set(id, ++n);
    return m;
  }, [ordem, pessoas]);

  const paragens = useMemo(() => ordem.filter((id) => numeros.has(id)).map((id) => pontoDe(pessoas!.get(id)!)), [ordem, numeros, pessoas]);
  const total = comprimento(percurso(paragens, base));
  const desvioPrevia = useMemo(() => {
    if (!previa || !numeros.has(previa.id) || !pessoas) return null;
    const sem = ordem.filter((id) => id !== previa.id && numeros.has(id)).map((id) => pontoDe(pessoas.get(id)!));
    return total - comprimento(percurso(sem, base));
  }, [previa, ordem, numeros, pessoas, base, total]);

  const foraDaRota = useMemo(
    () =>
      [...(pessoas?.values() ?? [])]
        .filter((p) => !ordem.includes(p.id))
        .sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome, 'pt')),
    [pessoas, ordem],
  );
  const pausadas = ordem.length - numeros.size;

  const itensMapa: ItemMapa[] = useMemo(
    () => [
      ...foraDaRota.map((p) => ({ pessoa: p, numero: null })),
      ...ordem.map((id) => ({ pessoa: pessoas!.get(id)!, numero: numeros.get(id) ?? null })),
    ],
    [foraDaRota, ordem, numeros, pessoas],
  );

  // ---- alterações ----
  function alterarOrdem(nova: number[]) {
    if (previa) return setOrdem(nova); // durante a prévia só grava ao confirmar
    setHistorico((h) => [...h.slice(-49), ordem]);
    setOrdem(nova);
    gravacao.guardar(nova);
  }

  function limparLink() {
    if (params.has('pessoa')) setParams({}, { replace: true });
    pedidaPorLink.current = null;
  }

  function confirmarPrevia() {
    if (!previa) return;
    setHistorico((h) => [...h.slice(-49), previa.antes]);
    gravacao.guardar(ordem);
    const nome = pessoas!.get(previa.id)!.nome;
    const n = numeros.get(previa.id);
    setAviso(n ? `${nome} entrou na rota na posição ${n}.` : `${nome} entrou na rota (pausada).`);
    setPrevia(null);
    limparLink();
  }

  function cancelarPrevia() {
    if (!previa) return;
    setOrdem(previa.antes);
    setPrevia(null);
    setSelecionado(null);
    limparLink();
  }

  function desfazer() {
    const anterior = historico.at(-1);
    if (!anterior) return;
    setHistorico((h) => h.slice(0, -1));
    setOrdem(anterior);
    gravacao.guardar(anterior);
    setAviso('');
  }

  function moverPara(id: number) {
    const max = numeros.size;
    const resposta = prompt(`Mover ${pessoas!.get(id)!.nome} para a posição (1 a ${max}):`);
    const alvo = Number(resposta);
    if (!resposta || !Number.isInteger(alvo) || alvo < 1) return;
    const sem = ordem.filter((x) => x !== id);
    const ativosSem = sem.filter((x) => numeros.has(x));
    const posicao = alvo - 1 < ativosSem.length ? sem.indexOf(ativosSem[alvo - 1]) : sem.length;
    const nova = [...sem];
    nova.splice(posicao, 0, id);
    alterarOrdem(nova);
  }

  function retirar(id: number) {
    if (previa?.id === id) return cancelarPrevia();
    alterarOrdem(ordem.filter((x) => x !== id));
    setSelecionado(null);
    setAviso(`${pessoas!.get(id)!.nome} saiu da rota. Continua cadastrada e aparece a cinzento no mapa.`);
  }

  async function alternarPausa(p: Pessoa) {
    try {
      const r = await api<{ pessoa: Pessoa }>(`/pessoas/${p.id}`, { method: 'PATCH', json: { ativa: !p.ativa } });
      setPessoas((m) => new Map(m!).set(p.id, r.pessoa));
      setAviso(r.pessoa.ativa ? `${p.nome} voltou à rota.` : `${p.nome} está pausada: mantém o lugar e o histórico, mas não entra nas próximas rotas.`);
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  // ---- ecrã ----
  if (erroCarga)
    return (
      <div className="p-4">
        <p className="mb-3 text-red-700">{erroCarga}</p>
        <Botao onClick={carregar}>Tentar de novo</Botao>
      </div>
    );
  if (!pessoas) return <Carregando />;

  const pessoaPrevia = previa ? pessoas.get(previa.id)! : null;

  const acoes = (id: number) => {
    const p = pessoas.get(id)!;
    const i = ordem.indexOf(id);
    return (
      <div className="flex flex-wrap gap-1 px-3 pb-3 pl-12">
        <Botao variante="secundario" className="min-h-9 px-3 text-sm" disabled={i === 0} onClick={() => alterarOrdem(arrayMove(ordem, i, i - 1))} aria-label="Subir uma posição">
          ↑
        </Botao>
        <Botao variante="secundario" className="min-h-9 px-3 text-sm" disabled={i === ordem.length - 1} onClick={() => alterarOrdem(arrayMove(ordem, i, i + 1))} aria-label="Descer uma posição">
          ↓
        </Botao>
        <Botao variante="secundario" className="min-h-9 px-3 text-sm" onClick={() => moverPara(id)}>
          Mover para…
        </Botao>
        {previa?.id !== id && (
          <Botao variante="secundario" className="min-h-9 px-3 text-sm" onClick={() => alternarPausa(p)}>
            {p.ativa ? 'Pausar' : 'Retomar'}
          </Botao>
        )}
        <Botao variante="perigo" className="min-h-9 px-3 text-sm" onClick={() => retirar(id)}>
          Retirar da rota
        </Botao>
        <Link to={`/pessoas/${id}`} className="inline-flex min-h-9 items-center px-2 text-sm font-medium text-marca-700">
          Ficha ›
        </Link>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="relative z-0 h-[42%] shrink-0 border-b border-slate-300 lg:h-full lg:flex-1 lg:border-r lg:border-b-0">
        <MapaRota
          base={base}
          itens={itensMapa}
          selecionado={selecionado}
          novoId={previa?.id ?? null}
          focar={focar}
          onSelecionar={(id) => selecionar(selecionado === id ? null : id, 'mapa')}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:w-[440px] lg:flex-none">
        {/* Barra de estado: resumo e gravação, ou a prévia da inclusão */}
        <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5">
          {pessoaPrevia && previa ? (
            <div className="space-y-2">
              <p className="font-semibold">Incluir {pessoaPrevia.nome}</p>
              <p className="text-sm text-slate-700">
                Sugestão: <strong>posição {previa.sugerida}</strong>, onde o desvio é menor.
                {numeros.has(previa.id) && numeros.get(previa.id) !== previa.sugerida && (
                  <> Agora está na posição <strong>{numeros.get(previa.id)}</strong>.</>
                )}
                {desvioPrevia !== null && <> A rota aumenta cerca de {formatarDistancia(Math.max(0, desvioPrevia))}.</>}
              </p>
              <p className="text-xs text-slate-500">
                A sugestão usa linha reta e não vê ruas de sentido único nem becos. Arraste na lista para escolher outra posição.
              </p>
              <div className="flex gap-2">
                <Botao className="min-h-10 flex-1" onClick={confirmarPrevia}>
                  Confirmar
                </Botao>
                <Botao variante="secundario" className="min-h-10" onClick={cancelarPrevia}>
                  Cancelar
                </Botao>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {numeros.size} {numeros.size === 1 ? 'paragem' : 'paragens'}
                  {paragens.length > 0 && <span className="font-normal text-slate-500"> · ≈ {formatarDistancia(total)} em linha reta</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {[pausadas && `${pausadas} pausada${pausadas > 1 ? 's' : ''}`, foraDaRota.length && `${foraDaRota.length} fora da rota`]
                    .filter(Boolean)
                    .join(' · ') || 'Segundas, quintas e sextas'}
                  {' · '}
                  <EstadoGravacaoTexto estado={gravacao.estado} onTentar={gravacao.tentarDeNovo} onRecarregar={carregar} />
                </p>
              </div>
              <Botao variante="secundario" className="min-h-10 px-3 text-sm" onClick={desfazer} disabled={!historico.length}>
                Desfazer
              </Botao>
            </div>
          )}
          {aviso && !previa && <p className="mt-2 rounded-md bg-marca-50 px-2 py-1.5 text-sm text-marca-800">{aviso}</p>}
          {!base && (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-sm text-amber-800">
              Falta o ponto da Associação: a linha só sai e volta a ela depois de o <Link to="/associacao" className="underline">marcar</Link>.
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {ordem.length === 0 ? (
            <p className="px-4 py-6 text-center text-slate-500">
              A rota está vazia. {foraDaRota.length ? 'Inclua pessoas a partir da lista abaixo.' : ''}
            </p>
          ) : (
            <ListaRota
              ordem={ordem}
              pessoas={pessoas}
              numeros={numeros}
              selecionado={selecionado}
              novoId={previa?.id ?? null}
              onSelecionar={(id) => selecionar(selecionado === id ? null : id, 'lista')}
              onReordenar={alterarOrdem}
              acoes={acoes}
            />
          )}

          {foraDaRota.length > 0 && (
            <section className="pt-4">
              <h2 className="px-3 pb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">Fora da rota</h2>
              <ul className="divide-y divide-slate-200 border-y border-slate-200">
                {foraDaRota.map((p) => (
                  <li key={p.id} id={idLinha(p.id)} className={selecionado === p.id ? 'bg-marca-50' : 'bg-white'}>
                    <div className="flex items-center gap-3 px-3 py-1.5">
                      <button type="button" onClick={() => selecionar(selecionado === p.id ? null : p.id, 'lista')} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <Miniatura url={urlFoto(p.foto_url)} nome={p.nome} tamanho="h-11 w-11" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5 font-medium">
                            {p.nome}
                            {!p.ativa && <Etiqueta>Pausada</Etiqueta>}
                          </span>
                          <span className="block truncate text-sm text-slate-500">{p.ponto_referencia || p.endereco || 'Sem ponto de referência'}</span>
                        </span>
                      </button>
                      <Botao variante="secundario" className="min-h-10 px-3 text-sm" disabled={!!previa} onClick={() => iniciarPrevia(p.id, pessoas, ordem, base)}>
                        Incluir
                      </Botao>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="p-3">
            <Link to="/pessoas/nova" className="flex min-h-11 items-center justify-center rounded-lg border border-dashed border-slate-300 font-medium text-marca-700 hover:bg-white">
              + Cadastrar pessoa nova
            </Link>
          </div>
          {selecionado === null && ordem.length > 0 && (
            <p className="px-3 pb-4 text-center text-xs text-slate-500">Toque numa pessoa para ver as ações. Arraste pela pega ⋮⋮ para mudar a ordem.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EstadoGravacaoTexto({ estado, onTentar, onRecarregar }: { estado: EstadoGravacao; onTentar: () => void; onRecarregar: () => void }) {
  if (estado === 'guardado') return <span className="text-marca-700">Guardado</span>;
  if (estado === 'a_guardar') return <span>A guardar…</span>;
  if (estado === 'conflito')
    return (
      <span className="text-red-700">
        Alterada noutro aparelho.{' '}
        <button onClick={onRecarregar} className="font-medium underline">
          Recarregar
        </button>
      </span>
    );
  return (
    <span className="text-red-700">
      Não foi possível guardar.{' '}
      <button onClick={onTentar} className="font-medium underline">
        Tentar de novo
      </button>
    </span>
  );
}
