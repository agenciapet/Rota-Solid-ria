import type { ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { urlFoto } from '../lib/api';
import type { Pessoa } from '../lib/tipos';
import { Etiqueta, Miniatura } from './ui';

export const idLinha = (pessoaId: number) => `linha-pessoa-${pessoaId}`;

function Pega() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
      {[5, 10, 15].flatMap((y) => [7, 13].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  );
}

function LinhaRota({
  pessoa,
  numero,
  selecionado,
  novo,
  onSelecionar,
  acoes,
}: {
  pessoa: Pessoa;
  numero: number | undefined;
  selecionado: boolean;
  novo: boolean;
  onSelecionar: () => void;
  acoes: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: pessoa.id });
  const fundo = novo ? 'bg-amber-50' : selecionado ? 'bg-marca-50' : 'bg-white';

  return (
    <li
      ref={setNodeRef}
      id={idLinha(pessoa.id)}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${fundo} ${isDragging ? 'relative z-10 shadow-lg ring-1 ring-slate-300' : ''}`}
    >
      <div className="flex items-center gap-1 py-1.5 pr-3 pl-1">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar ${pessoa.nome}`}
          className="flex h-12 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-400 active:cursor-grabbing"
        >
          <Pega />
        </button>
        <button type="button" onClick={onSelecionar} aria-pressed={selecionado} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              numero === undefined ? 'bg-slate-200 text-slate-500' : novo ? 'bg-amber-500 text-slate-900' : 'bg-marca-700 text-white'
            }`}
          >
            {numero ?? '–'}
          </span>
          <Miniatura url={urlFoto(pessoa.foto_url)} nome={pessoa.nome} tamanho="h-11 w-11" />
          <span className="min-w-0 flex-1">
            <span className={`flex flex-wrap items-center gap-1.5 font-medium ${pessoa.ativa ? '' : 'text-slate-400'}`}>
              {pessoa.nome}
              {!pessoa.ativa && <Etiqueta>Pausada</Etiqueta>}
              {novo && <Etiqueta cor="ambar">Nova</Etiqueta>}
            </span>
            <span className="block truncate text-sm text-slate-500">{pessoa.ponto_referencia || pessoa.endereco || 'Sem ponto de referência'}</span>
          </span>
        </button>
      </div>
      {selecionado && acoes}
    </li>
  );
}

export function ListaRota({
  ordem,
  pessoas,
  numeros,
  selecionado,
  novoId,
  onSelecionar,
  onReordenar,
  acoes,
}: {
  ordem: number[];
  pessoas: Map<number, Pessoa>;
  numeros: Map<number, number>;
  selecionado: number | null;
  novoId: number | null;
  onSelecionar: (id: number) => void;
  onReordenar: (nova: number[]) => void;
  acoes: (id: number) => ReactNode;
}) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function aoLargar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReordenar(arrayMove(ordem, ordem.indexOf(Number(active.id)), ordem.indexOf(Number(over.id))));
  }

  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={aoLargar}>
      <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-slate-200 border-b border-slate-200">
          {ordem.map((id) => {
            const pessoa = pessoas.get(id);
            if (!pessoa) return null;
            return (
              <LinhaRota
                key={id}
                pessoa={pessoa}
                numero={numeros.get(id)}
                selecionado={selecionado === id}
                novo={novoId === id}
                onSelecionar={() => onSelecionar(id)}
                acoes={acoes(id)}
              />
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
