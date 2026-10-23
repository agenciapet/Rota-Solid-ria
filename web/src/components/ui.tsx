import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca-700 text-white hover:bg-marca-800 disabled:bg-slate-300',
  secundario: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  perigo: 'bg-white text-red-700 border border-red-300 hover:bg-red-50 disabled:text-red-300',
  fantasma: 'text-marca-700 hover:bg-marca-50',
};

export function Botao({
  variante = 'primario',
  className = '',
  carregando,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-medium transition-colors disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}

export function Campo({
  rotulo,
  ajuda,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; ajuda?: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</span>
      <input
        {...props}
        className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-100"
      />
      {ajuda && <span className="mt-1 block text-xs text-slate-500">{ajuda}</span>}
    </label>
  );
}

export function AreaTexto({ rotulo, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</span>
      <textarea
        {...props}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-100"
      />
    </label>
  );
}

export function Cartao({ titulo, acoes, children }: { titulo?: string; acoes?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {(titulo || acoes) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-lg font-semibold">{titulo}</h2>}
          {acoes}
        </div>
      )}
      {children}
    </section>
  );
}

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'ok' | 'info'; children: ReactNode }) {
  const cores = {
    erro: 'bg-red-50 text-red-800 border-red-200',
    ok: 'bg-marca-50 text-marca-800 border-marca-100',
    info: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${cores[tipo]}`}>
      {children}
    </div>
  );
}

export function Etiqueta({ cor = 'cinza', children }: { cor?: 'cinza' | 'verde' | 'ambar'; children: ReactNode }) {
  const cores = { cinza: 'bg-slate-100 text-slate-700', verde: 'bg-marca-100 text-marca-800', ambar: 'bg-amber-100 text-amber-800' };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cores[cor]}`}>{children}</span>;
}

export function Carregando() {
  return <p className="py-8 text-center text-slate-500">A carregar…</p>;
}

export function Miniatura({ url, nome, tamanho = 'h-14 w-14' }: { url: string | null; nome: string; tamanho?: string }) {
  return url ? (
    <img src={url} alt="" className={`${tamanho} shrink-0 rounded-lg object-cover`} loading="lazy" />
  ) : (
    <div className={`${tamanho} flex shrink-0 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-400`}>
      {nome[0]}
    </div>
  );
}
