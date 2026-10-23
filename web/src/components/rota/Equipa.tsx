import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { NOME_PAPEL } from '../../lib/fila';
import type { DadosInicio } from '../../lib/rotaDia';
import { useSessao } from '../../lib/sessao';
import { dataCurta } from '../../lib/relatorio';
import type { MembroEquipe, Papel, PedidoAberto } from '../../lib/tipos';
import { Aviso, Botao, Campo, Carregando, Cartao } from '../ui';

const PAPEIS: Papel[] = ['motorista', 'relatorio', 'acompanhante'];

/**
 * Equipa do dia com o papel de cada pessoa. No início da rota pede também o km inicial.
 * O papel vale só para esta rota: não fica fixo na conta do voluntário.
 */
export function FormEquipa({
  modo,
  equipeAtual,
  onSubmeter,
  onCancelar,
}: {
  modo: 'iniciar' | 'editar';
  equipeAtual?: MembroEquipe[];
  onSubmeter: (dados: DadosInicio) => Promise<boolean>;
  onCancelar?: () => void;
}) {
  const { usuario } = useSessao();
  const [usuarios, setUsuarios] = useState<{ id: number; nome: string }[] | null>(null);
  const [papeis, setPapeis] = useState<Record<number, Papel | undefined>>(() => {
    if (equipeAtual) return Object.fromEntries(equipeAtual.map((m) => [m.usuario_id, m.papel]));
    // Quem inicia a rota costuma ser o Relatório.
    return usuario?.tipo === 'voluntario' ? { [usuario.id]: 'relatorio' } : {};
  });
  const [km, setKm] = useState('');
  const [pedidos, setPedidos] = useState<PedidoAberto[]>([]);
  const [aLevar, setALevar] = useState<number[]>([]);
  const [erro, setErro] = useState('');
  const [aGravar, setAGravar] = useState(false);

  useEffect(() => {
    api<{ usuarios: { id: number; nome: string }[] }>('/usuarios/ativos')
      .then((r) => setUsuarios(r.usuarios))
      .catch((e) => setErro(e.message));
    if (modo === 'iniciar') {
      api<{ pedidos: PedidoAberto[] }>('/pedidos/abertos')
        .then((r) => setPedidos(r.pedidos.filter((p) => p.pessoa_ativa)))
        .catch(() => {});
    }
  }, [modo]);

  const equipe = Object.entries(papeis)
    .filter(([, papel]) => papel)
    .map(([id, papel]) => ({ usuario_id: Number(id), papel: papel! }));
  const temMotorista = equipe.some((m) => m.papel === 'motorista');
  const temRelatorio = equipe.some((m) => m.papel === 'relatorio');

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!temMotorista || !temRelatorio) return setErro('Escolha quem é o motorista e quem faz o relatório.');
    const kmInicial = Number(km.replace(/\D/g, ''));
    if (modo === 'iniciar' && (!km || !Number.isInteger(kmInicial))) return setErro('Indique o km do conta-quilómetros à partida.');
    setAGravar(true);
    const ok = await onSubmeter({ km_inicial: kmInicial, equipe, pedidos_levar: modo === 'iniciar' ? aLevar : undefined });
    setAGravar(false);
    if (!ok && modo === 'iniciar') setErro('Não foi possível iniciar a rota. Veja o aviso e tente de novo.');
  }

  if (!usuarios) return erro ? <Aviso>{erro}</Aviso> : <Carregando />;

  return (
    <form onSubmit={submeter} className="space-y-4">
      <Cartao titulo="Equipa do dia">
        <ul className="divide-y divide-slate-100">
          {usuarios.map((u) => (
            <li key={u.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium">
                {u.nome}
                {u.id === usuario?.id && <span className="ml-1 text-sm font-normal text-slate-500">(eu)</span>}
              </span>
              <div className="flex rounded-lg border border-slate-300 bg-white p-0.5" role="radiogroup" aria-label={`Papel de ${u.nome}`}>
                {PAPEIS.map((papel) => (
                  <button
                    key={papel}
                    type="button"
                    role="radio"
                    aria-checked={papeis[u.id] === papel}
                    onClick={() => setPapeis({ ...papeis, [u.id]: papeis[u.id] === papel ? undefined : papel })}
                    className={`min-h-9 flex-1 rounded-md px-2 text-sm font-medium sm:px-3 ${
                      papeis[u.id] === papel ? 'bg-marca-700 text-white' : 'text-slate-600'
                    }`}
                  >
                    {NOME_PAPEL[papel]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Toque outra vez no papel para tirar a pessoa da equipa. Precisa de um motorista e de alguém no relatório.</p>
      </Cartao>

      {modo === 'iniciar' && (
        <Cartao titulo="Quilómetros à partida">
          <Campo
            rotulo="Km do conta-quilómetros"
            inputMode="numeric"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder="Ex.: 45210"
            required
          />
        </Cartao>
      )}

      {modo === 'iniciar' && pedidos.length > 0 && (
        <Cartao titulo={`Pedidos abertos · ${pedidos.length}`}>
          <p className="mb-2 text-sm text-slate-600">Marque o que a equipa leva hoje. O lembrete aparece ao chegar a cada pessoa.</p>
          <ul className="divide-y divide-slate-100">
            {pedidos.map((pe) => (
              <li key={pe.id}>
                <label className="flex min-h-11 items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-marca-700"
                    checked={aLevar.includes(pe.id)}
                    onChange={(e) => setALevar(e.target.checked ? [...aLevar, pe.id] : aLevar.filter((id) => id !== pe.id))}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{pe.pessoa_nome}</span>: {pe.descricao}
                    <span className="block text-xs text-slate-500">
                      {pe.pedido_em && `pediu em ${dataCurta(pe.pedido_em)}`}
                      {pe.adiamentos > 0 && ` · adiado ${pe.adiamentos}×`}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Botao type="submit" className="min-h-14 flex-1 text-lg" carregando={aGravar}>
          {modo === 'iniciar' ? 'Iniciar rota' : 'Guardar equipa'}
        </Botao>
        {onCancelar && (
          <Botao type="button" variante="secundario" onClick={onCancelar}>
            Cancelar
          </Botao>
        )}
      </div>
    </form>
  );
}
