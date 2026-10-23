import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, API_URL, token, urlFoto } from '../lib/api';
import { reduzirImagem } from '../lib/imagem';
import type { Associacao, Pessoa, Ponto } from '../lib/tipos';
import { MapaPonto } from '../components/MapaPonto';
import { Aviso, Botao, Campo, Carregando, Cartao, Etiqueta } from '../components/ui';

interface Visita {
  data: string;
  status: string;
  encontrada: boolean | null;
  deixou_comida: boolean | null;
  observacao: string | null;
  motivo_nao_visita: string | null;
}
interface Pedido {
  id: number;
  descricao: string;
  status: 'aberto' | 'entregue' | 'cancelado';
  adiamentos: number;
  criado_em: string;
}

const VAZIO = { nome: '', endereco: '', ponto_referencia: '', telefone: '', ligar_antes_min: '' };
const dataPt = (iso: string) => new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-PT');

export function PessoaFicha() {
  const { id } = useParams();
  const nova = id === undefined;
  const navegar = useNavigate();

  const [carregado, setCarregado] = useState(nova);
  const [form, setForm] = useState(VAZIO);
  const [ativa, setAtiva] = useState(true);
  const [naRota, setNaRota] = useState(false);
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [associacao, setAssociacao] = useState<Ponto | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoNova, setFotoNova] = useState<Blob | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const entradaFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ associacao: Associacao | null }>('/associacao').then(({ associacao: a }) => {
      if (a?.latitude != null && a.longitude != null) setAssociacao({ lat: a.latitude, lng: a.longitude });
    });
    if (nova) return;
    api<{ pessoa: Pessoa; visitas: Visita[]; pedidos: Pedido[] }>(`/pessoas/${id}`)
      .then(({ pessoa: p, visitas, pedidos }) => {
        setForm({
          nome: p.nome,
          endereco: p.endereco ?? '',
          ponto_referencia: p.ponto_referencia ?? '',
          telefone: p.telefone ?? '',
          ligar_antes_min: p.ligar_antes_min ? String(p.ligar_antes_min) : '',
        });
        setAtiva(p.ativa);
        setNaRota(p.na_rota);
        setPonto({ lat: p.latitude, lng: p.longitude });
        setFotoUrl(urlFoto(p.foto_url));
        setVisitas(visitas);
        setPedidos(pedidos);
      })
      .catch((e) => setMensagem({ tipo: 'erro', texto: e.message }))
      .finally(() => setCarregado(true));
  }, [id, nova]);

  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);

  async function escolherFoto(ficheiro: File | undefined) {
    if (!ficheiro) return;
    const reduzida = await reduzirImagem(ficheiro);
    setFotoNova(reduzida);
    setPrevia(URL.createObjectURL(reduzida));
  }

  async function enviarFoto(pessoaId: number, blob: Blob) {
    const dados = new FormData();
    dados.append('foto', blob, 'foto.jpg');
    const r = await api<{ pessoa: Pessoa }>(`/pessoas/${pessoaId}/foto`, { method: 'POST', body: dados });
    setFotoUrl(urlFoto(r.pessoa.foto_url));
    setFotoNova(null);
    setPrevia(null);
  }

  async function gravar(e: FormEvent) {
    e.preventDefault();
    if (!ponto) return setMensagem({ tipo: 'erro', texto: 'Marque no mapa onde a pessoa costuma estar.' });
    setAGravar(true);
    setMensagem(null);
    const corpo = {
      ...form,
      ligar_antes_min: form.telefone && form.ligar_antes_min ? Number(form.ligar_antes_min) : null,
      latitude: ponto.lat,
      longitude: ponto.lng,
      ativa,
    };
    try {
      const r = nova
        ? await api<{ pessoa: Pessoa }>('/pessoas', { method: 'POST', json: corpo })
        : await api<{ pessoa: Pessoa }>(`/pessoas/${id}`, { method: 'PATCH', json: corpo });
      if (fotoNova) await enviarFoto(r.pessoa.id, fotoNova);
      // Pessoa nova segue para a montagem, onde o sistema sugere a posição na rota.
      if (nova) return navegar(`/rota?pessoa=${r.pessoa.id}`);
      setAtiva(r.pessoa.ativa);
      setMensagem({ tipo: 'ok', texto: 'Alterações guardadas.' });
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setAGravar(false);
    }
  }

  async function cancelarPedido(p: Pedido) {
    if (!confirm(`Cancelar o pedido "${p.descricao}"? Deixa de aparecer à equipa.`)) return;
    try {
      await api(`/pedidos/${p.id}/cancelar`, { method: 'POST', json: {} });
      setPedidos(pedidos.map((x) => (x.id === p.id ? { ...x, status: 'cancelado' } : x)));
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: (e as Error).message });
    }
  }

  async function removerFoto() {
    if (!confirm('Remover a foto do local?')) return;
    await api(`/pessoas/${id}/foto`, { method: 'DELETE' });
    setFotoUrl(null);
  }

  async function exportar() {
    // Usa fetch com o token (o link direto não levaria a autenticação).
    const r = await fetch(`${API_URL}/pessoas/${id}/exportar`, { headers: { Authorization: `Bearer ${token.ler()}` } });
    const url = URL.createObjectURL(await r.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: `pessoa-${id}.json` });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function apagar() {
    const confirmacao = prompt(
      `Isto apaga definitivamente ${form.nome}, a foto, o histórico de visitas e os pedidos.\n\nPara confirmar, escreva APAGAR:`,
    );
    if (confirmacao?.trim().toUpperCase() !== 'APAGAR') return;
    await api(`/pessoas/${id}`, { method: 'DELETE' });
    navegar('/pessoas', { replace: true });
  }

  if (!carregado) return <Carregando />;
  const alterar = (campo: keyof typeof VAZIO) => (e: { target: { value: string } }) => setForm({ ...form, [campo]: e.target.value });
  const imagem = previa ?? fotoUrl;

  return (
    <div className="space-y-4">
      <button onClick={() => navegar('/pessoas')} className="text-sm font-medium text-marca-700">
        ‹ Pessoas
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{nova ? 'Nova pessoa' : form.nome}</h1>
        {!nova && !ativa && <Etiqueta>Pausada</Etiqueta>}
      </div>
      {!nova && (
        <Link
          to={`/rota?pessoa=${id}`}
          className={`flex min-h-11 items-center justify-between rounded-lg border px-3 text-sm font-medium ${
            naRota ? 'border-slate-200 bg-white text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <span>{naRota ? 'Está na rota' : 'Fora da rota'}</span>
          <span className="text-marca-700">{naRota ? 'Ver na rota ›' : 'Incluir na rota ›'}</span>
        </Link>
      )}

      <form onSubmit={gravar} className="space-y-4">
        <Cartao titulo="Dados">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome" value={form.nome} onChange={alterar('nome')} required className="sm:col-span-2" />
            <Campo rotulo="Ponto de referência" value={form.ponto_referencia} onChange={alterar('ponto_referencia')} placeholder="Ex.: banco da praça, junto à farmácia" className="sm:col-span-2" />
            <Campo rotulo="Morada (opcional)" value={form.endereco} onChange={alterar('endereco')} className="sm:col-span-2" />
            <Campo rotulo="Telefone" type="tel" value={form.telefone} onChange={alterar('telefone')} ajuda="Com telefone, a equipa recebe o lembrete para ligar antes de chegar." />
            <Campo
              rotulo="Ligar com antecedência (minutos)"
              type="number"
              inputMode="numeric"
              min={1}
              max={240}
              value={form.ligar_antes_min}
              onChange={alterar('ligar_antes_min')}
              disabled={!form.telefone}
              ajuda="Ex.: 10 se a pessoa precisa de 10 minutos para chegar ao ponto. O aviso aparece já na paragem anterior."
            />
          </div>
          {!nova && (
            <label className="mt-4 flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={!ativa} onChange={(e) => setAtiva(!e.target.checked)} className="h-5 w-5 accent-marca-700" />
              <span>
                <span className="font-medium">Pausar</span>
                <span className="block text-sm text-slate-500">Sai da rota sem perder o histórico.</span>
              </span>
            </label>
          )}
        </Cartao>

        <Cartao titulo="Ponto no mapa">
          <MapaPonto valor={ponto} onChange={setPonto} referencia={associacao} />
        </Cartao>

        <Cartao titulo="Foto do local">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {imagem ? (
              <img src={imagem} alt="Foto do local" className="max-h-64 w-full rounded-lg object-cover sm:w-80" />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 sm:w-80">
                Sem foto
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input ref={entradaFoto} type="file" accept="image/*" hidden onChange={(e) => escolherFoto(e.target.files?.[0])} />
              <Botao type="button" variante="secundario" onClick={() => entradaFoto.current?.click()}>
                {imagem ? 'Trocar foto' : 'Tirar ou escolher foto'}
              </Botao>
              {previa && <p className="text-sm text-amber-700">A foto nova é enviada ao guardar.</p>}
              {fotoUrl && !previa && (
                <Botao type="button" variante="fantasma" onClick={removerFoto}>
                  Remover foto
                </Botao>
              )}
            </div>
          </div>
        </Cartao>

        {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
        <Botao type="submit" carregando={aGravar} className="w-full sm:w-auto">
          {nova ? 'Cadastrar e escolher posição na rota' : 'Guardar alterações'}
        </Botao>
      </form>

      {!nova && (
        <>
          <Cartao titulo="Pedidos">
            {pedidos.length === 0 ? (
              <p className="text-sm text-slate-500">Sem pedidos.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pedidos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {p.descricao} <span className="text-sm text-slate-500">· {dataPt(p.criado_em)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Etiqueta cor={p.status === 'aberto' ? 'ambar' : p.status === 'entregue' ? 'verde' : 'cinza'}>
                        {p.status}
                        {p.status === 'aberto' && p.adiamentos > 0 && ` · adiado ${p.adiamentos}×`}
                      </Etiqueta>
                      {p.status === 'aberto' && (
                        <Botao type="button" variante="fantasma" className="min-h-8 px-2 text-sm" onClick={() => cancelarPedido(p)}>
                          Cancelar
                        </Botao>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao titulo="Histórico de visitas">
            {visitas.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda sem visitas registadas.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {visitas.map((v, i) => (
                  <li key={i} className="py-2">
                    <span className="font-medium">{dataPt(v.data)}</span> ·{' '}
                    {v.status === 'nao_visitada'
                      ? `não visitada${v.motivo_nao_visita ? ` (${v.motivo_nao_visita})` : ''}`
                      : v.encontrada === false
                        ? 'não encontrada'
                        : `encontrada${v.deixou_comida ? ' · comida entregue' : ''}`}
                    {v.observacao && <span className="text-slate-500"> · {v.observacao}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao titulo="Dados pessoais (RGPD)">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Botao type="button" variante="secundario" onClick={exportar}>
                Exportar dados
              </Botao>
              <Botao type="button" variante="perigo" onClick={apagar}>
                Apagar pessoa e histórico
              </Botao>
            </div>
          </Cartao>
        </>
      )}
    </div>
  );
}

