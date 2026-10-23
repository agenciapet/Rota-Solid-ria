import { useEffect, useState } from 'react';
import { cabeca, pendente, seguinte, textoContador } from '../lib/fila';
import { useRotaDia } from '../lib/rotaDia';
import { useSessao } from '../lib/sessao';
import type { Parada } from '../lib/tipos';
import { Botao, Carregando, Cartao } from '../components/ui';
import { FormEquipa } from '../components/rota/Equipa';
import { Fila } from '../components/rota/Fila';
import { ACaminho, ProximaPessoa, Questionario } from '../components/rota/Paragem';
import { Retorno } from '../components/rota/Retorno';
import { Relatorio } from '../components/rota/Relatorio';

type Vista = 'principal' | 'fila' | 'equipa' | 'iniciar';

const dataLonga = (data: string) =>
  new Date(data + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

export function RotaDia() {
  const r = useRotaDia();
  const { usuario } = useSessao();
  const [vista, setVista] = useState<Vista>('principal');
  const [aCorrigir, setACorrigir] = useState<Parada | null>(null);

  const estado = r.estado;
  const rotaId = estado?.rota.id;
  const rotaStatus = estado?.rota.status;
  // Mudou a rota ou acabou: volta ao ecrã principal.
  useEffect(() => {
    setVista('principal');
    setACorrigir(null);
  }, [rotaId, rotaStatus]);

  if (estado === undefined) return <Carregando />;

  if (!estado || estado.rota.status === 'concluida') {
    if (vista === 'iniciar') {
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Iniciar rota</h1>
          <FormEquipa modo="iniciar" onSubmeter={r.iniciar} onCancelar={() => setVista('principal')} />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Olá, {usuario?.nome.split(' ')[0]}</h1>
        {r.erro && (
          <Cartao>
            <p className="text-red-700">{r.erro}</p>
            <Botao variante="secundario" className="mt-2" onClick={r.recarregar}>
              Tentar de novo
            </Botao>
          </Cartao>
        )}
        {estado ? (
          <>
            <Relatorio estado={estado} />
            <Botao variante="secundario" className="w-full" onClick={() => setVista('iniciar')} disabled={!r.ligado}>
              Iniciar outra rota hoje
            </Botao>
          </>
        ) : (
          <Cartao titulo="Rota de hoje">
            <p className="mb-4 text-slate-600">Ainda não há nenhuma rota a decorrer. Quem faz o relatório marca a equipa e o km inicial para começar.</p>
            <Botao className="min-h-14 w-full text-lg" onClick={() => setVista('iniciar')} disabled={!r.ligado}>
              Iniciar rota
            </Botao>
          </Cartao>
        )}
        {!r.ligado && <p className="text-center text-sm text-red-700">Sem ligação. A tentar ligar de novo…</p>}
      </div>
    );
  }

  const { rota, paradas, equipe } = estado;
  const bloqueado = !r.ligado || !r.membro;
  const atual = cabeca(paradas);
  const proxima = seguinte(paradas, atual);
  const faltamSoEmEspera = !atual && rota.status === 'em_andamento' && paradas.some(pendente);

  const irAgora = async (p: Parada) => {
    if (await r.agir('ir_agora', { parada_id: p.id })) setVista('principal');
  };
  const paradaAtualizada = aCorrigir ? paradas.find((p) => p.id === aCorrigir.id) : null;

  let conteudo: React.ReactNode;
  if (paradaAtualizada) {
    conteudo = (
      <Questionario
        edicao
        parada={paradaAtualizada}
        seguinte={null}
        bloqueado={bloqueado}
        onLigacao={() => {}}
        onResponder={(campo, valor) => r.responder(paradaAtualizada.id, campo, valor)}
        onPedido={(pedidoId, resposta) => r.responderPedido(paradaAtualizada.id, pedidoId, resposta)}
        onConcluir={() => {}}
        onVoltar={() => {}}
        onFechar={() => setACorrigir(null)}
      />
    );
  } else if (vista === 'equipa') {
    conteudo = (
      <FormEquipa
        modo="editar"
        equipeAtual={equipe}
        onSubmeter={async ({ equipe: nova }) => {
          const ok = await r.gravarEquipa(nova);
          if (ok) setVista('principal');
          return ok;
        }}
        onCancelar={() => setVista('principal')}
      />
    );
  } else if (vista === 'fila' || faltamSoEmEspera) {
    conteudo = (
      <Fila
        estado={estado}
        bloqueado={bloqueado}
        soEscolher={faltamSoEmEspera}
        onIrAgora={irAgora}
        onEditar={setACorrigir}
        onEncerrar={async () => {
          const restantes = paradas.filter(pendente).length;
          if (!confirm(restantes ? `Encerrar as visitas com ${restantes} pessoas por visitar?` : 'Encerrar as visitas e regressar à Associação?')) return;
          if (await r.agir('iniciar_retorno')) setVista('principal');
        }}
      />
    );
  } else if (rota.status === 'retorno') {
    conteudo = (
      <Retorno
        estado={estado}
        bloqueado={bloqueado}
        onConcluir={(dados) => r.agir('concluir_rota', dados)}
        onVoltarARota={() => r.agir('voltar_a_rota')}
      />
    );
  } else if (!atual) {
    conteudo = <Carregando />;
  } else if (atual.status === 'no_local') {
    conteudo = (
      <Questionario
        parada={atual}
        seguinte={proxima}
        bloqueado={bloqueado}
        onLigacao={(id) => r.ligacaoFeita(id)}
        onResponder={(campo, valor) => r.responder(atual.id, campo, valor)}
        onPedido={(pedidoId, resposta) => r.responderPedido(atual.id, pedidoId, resposta)}
        onConcluir={() => r.agir('concluir_paragem', { parada_id: atual.id })}
        onVoltar={() => r.agir('voltar', { parada_id: atual.id })}
        onFechar={() => {}}
      />
    );
  } else if (atual.status === 'a_caminho') {
    conteudo = (
      <ACaminho
        parada={atual}
        seguinte={proxima}
        papel={r.papel}
        bloqueado={bloqueado}
        onLigacao={(id) => r.ligacaoFeita(id)}
        onChegou={() => r.agir('chegou', { parada_id: atual.id })}
        onTrocar={async () => {
          if (await r.agir('trocar', { parada_id: atual.id })) setVista('fila');
        }}
      />
    );
  } else {
    conteudo = (
      <ProximaPessoa
        parada={atual}
        bloqueado={bloqueado}
        onLigacao={(id) => r.ligacaoFeita(id)}
        onSim={() => r.agir('sim', { parada_id: atual.id })}
        onDepois={() => r.agir('depois', { parada_id: atual.id })}
      />
    );
  }

  const emFila = vista === 'fila' && !paradaAtualizada;

  return (
    <div className="space-y-3">
      {!r.ligado && (
        <div role="alert" className="rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-medium text-white">
          Sem ligação. A tentar ligar de novo…
        </div>
      )}
      {r.ligado && !r.membro && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>Não está na equipa de hoje.</span>
          <button onClick={r.entrarNaEquipa} className="font-medium underline">
            Entrar como acompanhante
          </button>
        </div>
      )}

      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-semibold">{textoContador(paradas)}</p>
          <button type="button" onClick={() => setVista(vista === 'equipa' ? 'principal' : 'equipa')} className="block max-w-full truncate text-left text-xs text-slate-500 underline-offset-2 hover:underline">
            {dataLonga(rota.data)} · {equipe.map((m) => m.nome.split(' ')[0]).join(', ')}
          </button>
        </div>
        {rota.status === 'em_andamento' && !faltamSoEmEspera && (
          <Botao
            variante={emFila ? 'primario' : 'secundario'}
            className="shrink-0"
            onClick={() => {
              setACorrigir(null);
              setVista(emFila ? 'principal' : 'fila');
            }}
          >
            {emFila ? 'Voltar' : 'Ver fila'}
          </Botao>
        )}
        {rota.status === 'retorno' && (
          <Botao
            variante={emFila ? 'primario' : 'secundario'}
            className="shrink-0"
            onClick={() => {
              setACorrigir(null);
              setVista(emFila ? 'principal' : 'fila');
            }}
          >
            {emFila ? 'Voltar' : 'Ver visitas'}
          </Botao>
        )}
      </header>

      {conteudo}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[1200] flex flex-col items-center gap-2 px-4">
        {r.avisos.map((a) => (
          <div
            key={a.id}
            className={`max-w-md rounded-lg px-4 py-2 text-sm text-white shadow-lg ${a.tipo === 'erro' ? 'bg-red-700' : 'bg-slate-800'}`}
          >
            {a.texto}
          </div>
        ))}
      </div>
    </div>
  );
}
