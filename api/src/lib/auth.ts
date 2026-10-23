import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from './env.js';
import { queryOne } from './db.js';
import { ErroHttp } from './erros.js';

export type TipoUsuario = 'adm' | 'voluntario';
export interface UsuarioSessao {
  id: number;
  nome: string;
  login: string;
  tipo: TipoUsuario;
}

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: UsuarioSessao;
  }
}

const VALIDADE = '30d';

export function emitirToken(usuarioId: number): string {
  return jwt.sign({ sub: String(usuarioId) }, env.jwtSecret, { expiresIn: VALIDADE });
}

export async function usuarioDoToken(token: string): Promise<UsuarioSessao | null> {
  try {
    const { sub } = jwt.verify(token, env.jwtSecret) as { sub: string };
    // Relê do banco a cada pedido: desativar um voluntário corta o acesso na hora.
    const u = await queryOne<UsuarioSessao & { ativo: number }>(
      'SELECT id, nome, login, tipo, ativo FROM usuarios WHERE id = ?',
      [Number(sub)],
    );
    if (!u || !u.ativo) return null;
    return { id: u.id, nome: u.nome, login: u.login, tipo: u.tipo };
  } catch {
    return null;
  }
}

export const exigirLogin: RequestHandler = async (req, _res, next) => {
  const cabecalho = req.headers.authorization ?? '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
  const usuario = token ? await usuarioDoToken(token) : null;
  if (!usuario) return next(new ErroHttp(401, 'Sessão expirada. Entre novamente.'));
  req.usuario = usuario;
  next();
};

export const exigirAdm: RequestHandler = (req, _res, next) => {
  if (req.usuario?.tipo !== 'adm') return next(new ErroHttp(403, 'Apenas o administrador pode fazer isto'));
  next();
};
