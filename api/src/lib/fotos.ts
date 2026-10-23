import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from './env.js';
import { ErroHttp } from './erros.js';

// As fotos do local nunca ficam públicas: ficam fora da pasta servida e só abrem
// com um link assinado que expira.
const VALIDADE_LINK_SEG = 60 * 60;
const TIPOS: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

export const pastaFotos = path.resolve(env.uploadsDir, 'fotos');
fs.mkdirSync(pastaFotos, { recursive: true });

export const uploadFoto = multer({
  storage: multer.diskStorage({
    destination: pastaFotos,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + TIPOS[file.mimetype]),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (TIPOS[file.mimetype]) cb(null, true);
    else cb(new ErroHttp(400, 'Formato de imagem não suportado (use JPG, PNG ou WebP)'));
  },
}).single('foto');

function assinatura(nome: string, expira: number): string {
  return crypto.createHmac('sha256', env.fotoSecret).update(`${nome}:${expira}`).digest('base64url');
}

export function linkFoto(nome: string | null): string | null {
  if (!nome) return null;
  const expira = Math.floor(Date.now() / 1000) + VALIDADE_LINK_SEG;
  return `/fotos/${nome}?exp=${expira}&sig=${assinatura(nome, expira)}`;
}

export function caminhoFotoValida(nome: string, exp: string, sig: string): string | null {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(nome)) return null;
  const expira = Number(exp);
  if (!Number.isFinite(expira) || expira < Date.now() / 1000) return null;
  const esperado = Buffer.from(assinatura(nome, expira));
  const recebido = Buffer.from(sig ?? '');
  if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
  return path.join(pastaFotos, nome);
}

export function apagarFoto(nome: string | null): void {
  if (nome) fs.rm(path.join(pastaFotos, nome), { force: true }, () => {});
}
