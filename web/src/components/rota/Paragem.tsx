import { useEffect, useRef, useState } from 'react';
import { linkMaps } from '../../lib/fila';
import { dataCurta } from '../../lib/relatorio';
import type { CampoQuestionario, Papel, Parada } from '../../lib/tipos';
import { Botao } from '../ui';
import { AvisoLigacao, CartaoPessoa } from './Pessoa';

interface Base {
  parada: Parada;
  bloqueado: boolean;
  onLigacao: (paradaId: number) => void;
}

export function ProximaPessoa({ parada, bloqueado, onLigacao, onSim, onDepois }: Base & { onSim: () => void; onDepois: () => void }) {
  return (
    <div className="space-y-3">
      <CartaoPessoa parada={parada} rotulo="Próxima pessoa" />
      <AvisoLigacao parada={parada} modo="atual" bloqueado={bloqueado} onFeita={() => onLigacao(parada.id)} />
      <p className="text-center font-medium text-slate-700">Ir a esta pessoa agora?</p>
      <div className="grid grid-cols-2 gap-3">
        <Botao className="min-h-16 text-xl" onClick={onSim} disabled={bloqueado}>
          Sim
        </Botao>
        <Botao variante="secundario" className="min-h-16 text-xl" onClick={onDepois} disabled={bloqueado}>
          Depois
        </Botao>
      </div>
      <p className="text-center text-xs text-slate-500">"Depois" deixa a pessoa em espera; ela volta à fila logo a seguir à próxima confirmada.</p>
    </div>
  );
}

export function ACaminho({
  parada,
  seguinte,
  papel,
  bloqueado,
  onLigacao,
  onChegou,
  onTrocar,
}: Base & { seguinte: Parada | null; papel: Papel | null; onChegou: () => void; onTrocar: () => void }) {
  const p = parada.pessoa;
  const motorista = papel === 'motorista';
  return (
    <div className="space-y-3">
      <CartaoPessoa parada={parada} rotulo="A caminho" compacto />
      <a
        href={linkMaps(p.latitude, p.longitude)}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex min-h-14 items-center justify-center gap-2 rounded-lg text-lg font-semibold ${
          motorista ? 'bg-marca-700 text-white' : 'border border-slate-300 bg-white text-slate-800'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 11l19-9-9 19-2-8-8-2z" />
        </svg>
        Abrir no Google Maps
      </a>
      <AvisoLigacao parada={parada} modo="atual" bloqueado={bloqueado} onFeita={() => onLigacao(parada.id)} />
      {seguinte && <AvisoLigacao parada={seguinte} modo="seguinte" bloqueado={bloqueado} onFeita={() => onLigacao(seguinte.id)} />}
      <Botao className="min-h-16 w-full text-xl" onClick={onChegou} disabled={bloqueado}>
        Chegámos ao local
      </Botao>
      <Botao variante="secundario" className="w-full" onClick={onTrocar} disabled={bloqueado}>
        Trocar pessoa
      </Botao>
    </div>
  );
}

function PerguntaSimNao({
  rotulo,
  valor,
  quem,
  bloqueado,
  onChange,
}: {
  rotulo: string;
  valor: boolean | null;
  quem?: string;
  bloqueado: boolean;
  onChange: (v: boolean) => void;
}) {
  const opcao = (v: boolean, texto: string) => (
    <button
      type="button"
      disabled={bloqueado}
      onClick={() => onChange(v)}
      aria-pressed={valor === v}
      className={`min-h-12 flex-1 rounded-lg border text-lg font-medium disabled:opacity-60 ${
        valor === v ? 'border-marca-700 bg-marca-700 text-white' : 'border-slate-300 bg-white text-slate-800'
      }`}
    >
      {texto}
    </button>
  );
  return (
    <div>
      <p className="mb-1.5 font-medium">
        {rotulo}
        {quem && <span className="ml-2 text-xs font-normal text-slate-500">· {quem}</span>}
      </p>
      <div className="flex gap-2">
        {opcao(true, 'Sim')}
        {opcao(false, 'Não')}
      </div>
    </div>
  );
}

/** Campo de texto que grava sozinho: ao parar de escrever e ao sair do campo. */
function CampoTexto({
  rotulo,
  ajuda,
  valorRemoto,
  quem,
  bloqueado,
  onGravar,
}: {
  rotulo: string;
  ajuda?: string;
  valorRemoto: string | null;
  quem?: string;
  bloqueado: boolean;
  onGravar: (v: string) => void;
}) {
  const [valor, setValor] = useState(valorRemoto ?? '');
  const [sujo, setSujo] = useState(false);
  const focado = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  // O que os outros escrevem só entra quando este campo não está a ser editado.
  useEffect(() => {
    if (!focado.current && !sujo) setValor(valorRemoto ?? '');
  }, [valorRemoto, sujo]);

  function gravar(v: string) {
    clearTimeout(temporizador.current);
    setSujo(false);
    if (v.trim() !== (valorRemoto ?? '').trim()) onGravar(v);
  }

  return (
    <label className="block">
      <span className="mb-1 block font-medium">
        {rotulo}
        {quem && <span className="ml-2 text-xs font-normal text-slate-500">· {quem}</span>}
      </span>
      <textarea
        value={valor}
        rows={2}
        disabled={bloqueado}
        onFocus={() => (focado.current = true)}
        onChange={(e) => {
          setValor(e.target.value);
          setSujo(true);
          clearTimeout(temporizador.current);
          temporizador.current = setTimeout(() => gravar(e.target.value), 900);
        }}
        onBlur={(e) => {
          focado.current = false;
          gravar(e.target.value);
        }}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-100 disabled:bg-slate-50"
      />
      {ajuda && <span className="mt-1 block text-xs text-slate-500">{ajuda}</span>}
    </label>
  );
}

export function Questionario({
  parada,
  seguinte,
  bloqueado,
  edicao,
  onLigacao,
  onResponder,
  onPedido,
  onConcluir,
  onVoltar,
  onFechar,
}: Base & {
  seguinte: Parada | null;
  /** A corrigir uma paragem já concluída (a partir da fila). */
  edicao?: boolean;
  onResponder: (campo: CampoQuestionario, valor: boolean | string | null) => void;
  onPedido: (pedidoId: number, resposta: 'entregue' | 'adiado' | null) => void;
  onConcluir: () => void;
  onVoltar: () => void;
  onFechar: () => void;
}) {
  const quem = parada.preenchido_por;
  const podeConcluir = parada.encontrada !== null && (parada.encontrada === false || parada.deixou_comida !== null);

  return (
    <div className="space-y-3">
      <CartaoPessoa parada={parada} rotulo={edicao ? 'Corrigir respostas' : 'No local'} compacto semPedidos />
      {parada.pedidos_anteriores.length > 0 && (
        <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
          {parada.pedidos_anteriores.map((a) => (
            <div key={a.id}>
              <p className="font-semibold text-amber-900">
                Pediu{a.pedido_em ? ` em ${dataCurta(a.pedido_em)}` : ''}: {a.descricao}
              </p>
              {(a.a_levar || a.adiamentos > 0) && (
                <p className="text-xs text-amber-800">
                  {[a.a_levar && 'marcado como "a levar" hoje', a.adiamentos > 0 && `adiado ${a.adiamentos}×`].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="mt-1.5 flex gap-2">
                {(['entregue', 'adiado'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={bloqueado}
                    aria-pressed={a.resposta === r}
                    onClick={() => onPedido(a.id, a.resposta === r ? null : r)}
                    className={`min-h-11 flex-1 rounded-lg border font-medium capitalize disabled:opacity-60 ${
                      a.resposta === r ? 'border-amber-600 bg-amber-500 text-slate-900' : 'border-amber-300 bg-white text-slate-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {parada.encontrada === false && (
            <p className="text-xs text-amber-800">Pessoa não encontrada: o pedido continua aberto sem precisar de resposta.</p>
          )}
        </section>
      )}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <PerguntaSimNao
          rotulo="Foi encontrada no local?"
          valor={parada.encontrada}
          quem={quem.encontrada}
          bloqueado={bloqueado}
          onChange={(v) => onResponder('encontrada', v)}
        />
        {parada.encontrada && (
          <PerguntaSimNao
            rotulo="Deixou a comida?"
            valor={parada.deixou_comida}
            quem={quem.deixou_comida}
            bloqueado={bloqueado}
            onChange={(v) => onResponder('deixou_comida', v)}
          />
        )}
        <CampoTexto
          rotulo="Observação"
          valorRemoto={parada.observacao}
          quem={quem.observacao}
          bloqueado={bloqueado}
          onGravar={(v) => onResponder('observacao', v || null)}
        />
        <CampoTexto
          rotulo="Fez algum pedido?"
          ajuda="Ex.: cobertor, meias. Fica como pedido aberto e lembra a equipa na próxima rota."
          valorRemoto={parada.pedido}
          quem={quem.pedido}
          bloqueado={bloqueado}
          onGravar={(v) => onResponder('pedido', v || null)}
        />
        <p className="text-xs text-slate-500">Cada resposta grava na hora e aparece a toda a equipa com o nome de quem respondeu.</p>
      </section>
      {seguinte && !edicao && <AvisoLigacao parada={seguinte} modo="seguinte" bloqueado={bloqueado} onFeita={() => onLigacao(seguinte.id)} />}
      {edicao ? (
        <Botao variante="secundario" className="w-full" onClick={onFechar}>
          Fechar
        </Botao>
      ) : (
        <>
          <Botao className="min-h-16 w-full text-xl" onClick={onConcluir} disabled={bloqueado || !podeConcluir}>
            Concluir paragem
          </Botao>
          {!podeConcluir && <p className="text-center text-xs text-slate-500">Responda às perguntas de Sim/Não para concluir.</p>}
          <Botao variante="secundario" className="w-full" onClick={onVoltar} disabled={bloqueado}>
            Voltar (afinal não chegámos)
          </Botao>
        </>
      )}
    </div>
  );
}
