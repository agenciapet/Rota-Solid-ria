import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useSessao } from '../lib/sessao';
import { Aviso, Botao, Campo } from '../components/ui';

export function Login() {
  const { usuario, entrar } = useSessao();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aEntrar, setAEntrar] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setAEntrar(true);
    try {
      await entrar(login.trim(), senha);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setAEntrar(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-marca-700 p-4">
      <form onSubmit={submeter} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center gap-2 pb-2">
          <img src="/icone.svg" alt="" className="h-16 w-16 rounded-xl" />
          <h1 className="text-xl font-semibold">Rota Solidária</h1>
        </div>
        <Campo rotulo="Utilizador" value={login} onChange={(e) => setLogin(e.target.value)} autoCapitalize="none" autoComplete="username" required />
        <Campo rotulo="Palavra-passe" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        {erro && <Aviso>{erro}</Aviso>}
        <Botao type="submit" className="w-full" carregando={aEntrar}>
          Entrar
        </Botao>
      </form>
    </div>
  );
}
