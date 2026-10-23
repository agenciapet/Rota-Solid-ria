import { NavLink, Outlet, useMatch } from 'react-router-dom';
import { useSessao } from '../lib/sessao';

const LINKS_ADM = [
  { para: '/hoje', texto: 'Hoje' },
  { para: '/rota', texto: 'Rota' },
  { para: '/pessoas', texto: 'Pessoas' },
  { para: '/voluntarios', texto: 'Equipa' },
  { para: '/associacao', texto: 'Associação' },
];

export function Layout() {
  const { usuario, sair } = useSessao();
  const links = usuario?.tipo === 'adm' ? LINKS_ADM : [{ para: '/hoje', texto: 'Rota de hoje' }];
  // A montagem da rota ocupa o ecrã inteiro (mapa + lista), sem margens nem rolagem da página.
  const telaCheia = useMatch('/rota') !== null;

  return (
    <div className={telaCheia ? 'flex h-dvh flex-col' : 'flex min-h-full flex-col'}>
      <header className="sticky top-0 z-[1100] bg-marca-700 text-white shadow pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-2 py-2 sm:gap-3 sm:px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold" aria-label="Início">
            <img src="/icone.svg" alt="" className="hidden h-8 w-8 rounded-md sm:block" />
            <span className="hidden md:inline">Rota Solidária</span>
          </NavLink>
          <nav className="flex flex-1 gap-0.5 overflow-x-auto sm:gap-1">
            {links.map((l) => (
              <NavLink
                key={l.para}
                to={l.para}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-1 py-2 text-sm font-medium sm:px-3 ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
                }
              >
                {l.texto}
              </NavLink>
            ))}
          </nav>
          <button onClick={sair} className="flex items-center rounded-md px-2 py-2 text-sm hover:bg-white/10 sm:px-3" title={`Sair (${usuario?.nome})`} aria-label="Sair">
            <svg viewBox="0 0 24 24" className="h-5 w-5 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>
      {telaCheia ? (
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:py-6">
          <Outlet />
        </main>
      )}
    </div>
  );
}
