// Em produção VITE_API_URL aponta para a API na VPS; em desenvolvimento usa o proxy do Vite.
export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const CHAVE_TOKEN = 'rota.token';

export const token = {
  ler: () => localStorage.getItem(CHAVE_TOKEN),
  gravar: (t: string) => localStorage.setItem(CHAVE_TOKEN, t),
  apagar: () => localStorage.removeItem(CHAVE_TOKEN),
};

export class ErroApi extends Error {
  status: number;
  /** Corpo da resposta de erro; num 409 da fila traz o estado atual da rota. */
  dados: Record<string, unknown>;
  constructor(status: number, message: string, dados: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.dados = dados;
  }
}

// Em desenvolvimento passa pelo proxy do Vite (/api/ws); em produção liga direto à API.
export function wsUrl(): string {
  const u = new URL(API_URL + '/ws', window.location.href);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

let aoExpirarSessao: () => void = () => {};
export function definirAoExpirarSessao(fn: () => void) {
  aoExpirarSessao = fn;
}

export async function api<T = unknown>(caminho: string, opcoes: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...resto } = opcoes;
  const t = token.ler();
  let resposta: Response;
  try {
    resposta = await fetch(API_URL + caminho, {
      ...resto,
      headers: {
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : resto.body,
    });
  } catch {
    throw new ErroApi(0, 'Sem ligação. Verifique a internet e tente de novo.');
  }
  if (resposta.status === 204) return undefined as T;
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    if (resposta.status === 401 && t) aoExpirarSessao();
    const detalhes = Array.isArray(dados.detalhes) ? ` (${dados.detalhes.join('; ')})` : '';
    throw new ErroApi(resposta.status, (dados.erro ?? 'Erro inesperado') + detalhes, dados);
  }
  return dados as T;
}

export const urlFoto = (caminho: string | null) => (caminho ? API_URL + caminho : null);
