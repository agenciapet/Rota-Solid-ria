import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, definirAoExpirarSessao, token } from './api';
import type { Usuario } from './tipos';

interface Sessao {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (login: string, senha: string) => Promise<void>;
  sair: () => void;
}

const ContextoSessao = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(!!token.ler());

  const sair = useCallback(() => {
    token.apagar();
    setUsuario(null);
  }, []);

  useEffect(() => {
    definirAoExpirarSessao(sair);
    if (!token.ler()) return;
    api<{ usuario: Usuario }>('/auth/me')
      .then((r) => setUsuario(r.usuario))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [sair]);

  const entrar = useCallback(async (login: string, senha: string) => {
    const r = await api<{ token: string; usuario: Usuario }>('/auth/login', { method: 'POST', json: { login, senha } });
    token.gravar(r.token);
    setUsuario(r.usuario);
  }, []);

  return <ContextoSessao.Provider value={{ usuario, carregando, entrar, sair }}>{children}</ContextoSessao.Provider>;
}

export function useSessao() {
  const s = useContext(ContextoSessao);
  if (!s) throw new Error('useSessao fora do ProvedorSessao');
  return s;
}
