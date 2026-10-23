import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class ErroHttp extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Encaminha erros de handlers assíncronos para o tratador central.
export const assincrono =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const tratadorDeErros: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ erro: 'Dados inválidos', detalhes: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    return;
  }
  if (err instanceof ErroHttp) {
    res.status(err.status).json({ erro: err.message });
    return;
  }
  if (err?.code === 'ER_DUP_ENTRY') {
    res.status(409).json({ erro: 'Já existe um registo com esses dados' });
    return;
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ erro: 'Ficheiro demasiado grande (máx. 8 MB)' });
    return;
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno' });
};
