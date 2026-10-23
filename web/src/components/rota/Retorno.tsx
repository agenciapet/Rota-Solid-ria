import { useState } from 'react';
import { contador, linkMaps, pendente } from '../../lib/fila';
import type { EstadoRota } from '../../lib/tipos';
import { Aviso, Botao, Campo, Cartao } from '../ui';

const LISTA_DEVOLUCAO = ['Telemóvel da Associação', 'Chaves', 'Geleira', 'Coletes'];

export const formatarKm = (km: number) => km.toLocaleString('pt-PT');

export function Retorno({
  estado,
  bloqueado,
  onConcluir,
  onVoltarARota,
}: {
  estado: EstadoRota;
  bloqueado: boolean;
  onConcluir: (dados: { km_final: number; motivo?: string; devolucao: string[] }) => Promise<boolean>;
  onVoltarARota: () => void;
}) {
  const { associacao, paradas, rota } = estado;
  const porVisitar = paradas.filter(pendente);
  const [km, setKm] = useState('');
  const [motivo, setMotivo] = useState('');
  const [devolvidos, setDevolvidos] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [aGravar, setAGravar] = useState(false);

  async function concluir() {
    setErro('');
    const kmFinal = Number(km.replace(/\D/g, ''));
    if (!km || !Number.isInteger(kmFinal)) return setErro('Indique o km do conta-quilómetros à chegada.');
    if (kmFinal < rota.km_inicial) return setErro(`O km final tem de ser igual ou superior ao inicial (${formatarKm(rota.km_inicial)}).`);
    if (porVisitar.length && !motivo.trim()) return setErro('Indique o motivo de as pessoas restantes não terem sido visitadas.');
    if (!confirm('Concluir a rota? Depois disto só o administrador pode corrigir as respostas.')) return;
    setAGravar(true);
    await onConcluir({ km_final: kmFinal, motivo: motivo.trim() || undefined, devolucao: devolvidos });
    setAGravar(false);
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-marca-700 uppercase">Regresso</p>
        <h2 className="text-2xl font-semibold">{associacao?.nome ?? 'Associação'}</h2>
        {associacao?.endereco && <p className="mt-1 text-slate-700">{associacao.endereco}</p>}
      </section>
      {associacao?.latitude != null && associacao.longitude != null && (
        <a
          href={linkMaps(associacao.latitude, associacao.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center justify-center rounded-lg bg-marca-700 text-lg font-semibold text-white"
        >
          Abrir no Google Maps
        </a>
      )}

      {porVisitar.length > 0 && (
        <Cartao titulo={`${porVisitar.length} ${porVisitar.length === 1 ? 'pessoa não visitada' : 'pessoas não visitadas'}`}>
          <p className="mb-2 text-sm text-slate-600">{porVisitar.map((p) => p.pessoa.nome).join(', ')}</p>
          <Campo rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: rua cortada, chuva forte" maxLength={255} />
          <Botao type="button" variante="secundario" className="mt-3" onClick={onVoltarARota} disabled={bloqueado}>
            Afinal, voltar à rota
          </Botao>
        </Cartao>
      )}

      <Cartao titulo="Devolução na Associação">
        <ul className="space-y-1">
          {LISTA_DEVOLUCAO.map((item) => (
            <li key={item}>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-marca-700"
                  checked={devolvidos.includes(item)}
                  onChange={(e) => setDevolvidos(e.target.checked ? [...devolvidos, item] : devolvidos.filter((d) => d !== item))}
                />
                <span>{item}</span>
              </label>
            </li>
          ))}
        </ul>
      </Cartao>

      <Cartao titulo="Quilómetros à chegada">
        <Campo
          rotulo="Km do conta-quilómetros"
          inputMode="numeric"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder={`À partida: ${formatarKm(rota.km_inicial)}`}
          ajuda={`Visitadas: ${contador(paradas).visitadas} de ${paradas.length}`}
        />
      </Cartao>

      {erro && <Aviso>{erro}</Aviso>}
      <Botao className="min-h-16 w-full text-xl" onClick={concluir} disabled={bloqueado} carregando={aGravar}>
        Concluir rota
      </Botao>
    </div>
  );
}
