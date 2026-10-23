import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useSessao } from '../lib/sessao';
import type { TipoUsuario, Usuario } from '../lib/tipos';
import { Aviso, Botao, Campo, Carregando, Cartao, Etiqueta } from '../components/ui';

const VAZIO = { nome: '', login: '', senha: '', tipo: 'voluntario' as TipoUsuario };

// O papel na rota (motorista, relatório, acompanhante) é escolhido a cada rota;
// aqui só se define quem entra no sistema e se é administrador.
export function Voluntarios() {
  const { usuario: eu } = useSessao();
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [aGravar, setAGravar] = useState(false);

  const carregar = () =>
    api<{ usuarios: Usuario[] }>('/usuarios').then((r) => setUsuarios(r.usuarios)).catch((e) => setMensagem({ tipo: 'erro', texto: e.message }));
  useEffect(() => void carregar(), []);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setAGravar(true);
    setMensagem(null);
    try {
      await api('/usuarios', { method: 'POST', json: form });
      setMensagem({ tipo: 'ok', texto: `Conta de ${form.nome} criada. Envie-lhe o utilizador e a palavra-passe.` });
      setForm(VAZIO);
      carregar();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setAGravar(false);
    }
  }

  async function alterar(u: Usuario, dados: Partial<Usuario> & { senha?: string }, sucesso: string) {
    setMensagem(null);
    try {
      await api(`/usuarios/${u.id}`, { method: 'PATCH', json: dados });
      setMensagem({ tipo: 'ok', texto: sucesso });
      carregar();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: (err as Error).message });
    }
  }

  function redefinirSenha(u: Usuario) {
    const senha = prompt(`Nova palavra-passe para ${u.nome} (mínimo 8 caracteres):`);
    if (senha) alterar(u, { senha }, `Palavra-passe de ${u.nome} alterada.`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Voluntários</h1>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <Cartao titulo="Nova conta">
        <form onSubmit={criar} className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          <Campo
            rotulo="Utilizador"
            value={form.login}
            onChange={(e) => setForm({ ...form, login: e.target.value.toLowerCase() })}
            autoCapitalize="none"
            required
            ajuda="Letras, números, ponto ou hífen. Ex.: ana.silva"
          />
          <Campo
            rotulo="Palavra-passe inicial"
            type="text"
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            minLength={8}
            required
            autoComplete="new-password"
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Perfil</span>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoUsuario })}
              className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
            >
              <option value="voluntario">Voluntário</option>
              <option value="adm">Administrador</option>
            </select>
          </label>
          <Botao type="submit" carregando={aGravar} className="sm:col-span-2 sm:justify-self-start">
            Criar conta
          </Botao>
        </form>
      </Cartao>

      {!usuarios ? (
        <Carregando />
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {usuarios.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-medium ${u.ativo ? '' : 'text-slate-400 line-through'}`}>{u.nome}</span>
                  {u.tipo === 'adm' && <Etiqueta cor="verde">Administrador</Etiqueta>}
                  {!u.ativo && <Etiqueta>Desativado</Etiqueta>}
                </div>
                <p className="text-sm text-slate-500">{u.login}</p>
              </div>
              {u.id !== eu?.id && (
                <div className="flex flex-wrap gap-1">
                  <Botao variante="fantasma" onClick={() => redefinirSenha(u)}>
                    Palavra-passe
                  </Botao>
                  <Botao
                    variante="fantasma"
                    onClick={() => alterar(u, { tipo: u.tipo === 'adm' ? 'voluntario' : 'adm' }, `Perfil de ${u.nome} alterado.`)}
                  >
                    {u.tipo === 'adm' ? 'Tornar voluntário' : 'Tornar adm'}
                  </Botao>
                  <Botao
                    variante={u.ativo ? 'perigo' : 'secundario'}
                    onClick={() => alterar(u, { ativo: !u.ativo }, u.ativo ? `${u.nome} já não consegue entrar.` : `${u.nome} reativado.`)}
                  >
                    {u.ativo ? 'Desativar' : 'Reativar'}
                  </Botao>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
