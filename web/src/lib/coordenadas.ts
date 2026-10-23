import type { Ponto } from './tipos';

// Aceita "38.7223, -9.1393", "38,7223 -9,1393" ou um link do Google Maps (…/@38.72,-9.13,17z ou ?q=38.72,-9.13).
export function lerCoordenadas(texto: string): Ponto | null {
  const t = texto.trim();
  let numeros: string[] | null = t.match(/-?\d{1,3}\.\d+/g);
  if (!numeros || numeros.length < 2) {
    numeros = t.match(/-?\d{1,3},\d+/g)?.map((n) => n.replace(',', '.')) ?? null;
  }
  if (!numeros || numeros.length < 2) return null;
  const lat = Number(numeros[0]);
  const lng = Number(numeros[1]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export const formatarPonto = (p: Ponto) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

// Centro padrão quando ainda não há Associação cadastrada: Lisboa.
export const CENTRO_PADRAO: Ponto = { lat: 38.7223, lng: -9.1393 };
