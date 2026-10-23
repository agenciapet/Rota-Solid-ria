import 'dotenv/config';

// Falha logo no arranque se faltar uma variável obrigatória; nunca usa valor por omissão para segredos.
function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente em falta: ${nome}`);
  return valor;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: obrigatoria('DATABASE_URL'),
  jwtSecret: obrigatoria('JWT_SECRET'),
  fotoSecret: obrigatoria('FOTO_SECRET'),
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  uploadsDir: process.env.UPLOADS_DIR ?? './uploads',
};
