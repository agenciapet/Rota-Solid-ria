import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import type { Associacao, Ponto } from '../lib/tipos';
import { MapaPonto } from '../components/MapaPonto';
import { Aviso, Botao, Campo, Carregando, Cartao } from '../components/ui';

export function AssociacaoPagina() {
  const [carregado, setCarregado] = useState(false);
  const [form, setForm] = useState({ nome: '', endereco: '', telefone: '', email: '' });
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [aGravar, setAGravar] = useState(false);

  useEffect(() => {
    api<{ associacao: Associacao | null }>('/associacao')
      .then(({ associacao: a }) => {
        if (a) {
          setForm({ nome: a.nome, endereco: a.endereco, telefone: a.telefone ?? '', email: a.email ?? '' });
          if (a.latitude != null && a.longitude != null) setPonto({ lat: a.latitude, lng: a.longitude });
        }
      })
      .catch((e) => setMensagem({ tipo: 'erro', texto: e.message }))
      .finally(() => setCarregado(true));
  }, []);

  async function gravar(e: FormEvent) {
    e.preventDefault();
    if (!ponto) return setMensagem({ tipo: 'erro', texto: 'Marque no mapa o ponto da Associação.' });
    setAGravar(true);
    setMensagem(null);
    try {
      await api('/associacao', { method: 'PUT', json: { ...form, latitude: ponto.lat, longitude: ponto.lng } });
      setMensagem({ tipo: 'ok', texto: 'Dados da Associação guardados.' });
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setAGravar(false);
    }
  }

  if (!carregado) return <Carregando />;
  const alterar = (campo: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [campo]: e.target.value });

  return (
    <form onSubmit={gravar} className="space-y-4">
      <h1 className="text-2xl font-semibold">Associação</h1>
      <Cartao titulo="Dados">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" value={form.nome} onChange={alterar('nome')} required className="sm:col-span-2" />
          <Campo rotulo="Morada" value={form.endereco} onChange={alterar('endereco')} required className="sm:col-span-2" />
          <Campo rotulo="Telefone" type="tel" value={form.telefone} onChange={alterar('telefone')} />
          <Campo rotulo="E-mail" type="email" value={form.email} onChange={alterar('email')} />
        </div>
      </Cartao>
      <Cartao titulo="Ponto no mapa">
        <p className="mb-3 text-sm text-slate-600">É o ponto de partida e de chegada da rota.</p>
        <MapaPonto valor={ponto} onChange={setPonto} />
      </Cartao>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
      <Botao type="submit" carregando={aGravar} className="w-full sm:w-auto">
        Guardar
      </Botao>
    </form>
  );
}
