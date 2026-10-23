import mysql, { type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  uri: env.databaseUrl,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: ['DATE'],
  decimalNumbers: true,
  supportBigNumbers: true,
  // BOOLEAN no MySQL é TINYINT(1); devolve true/false em vez de 1/0.
  typeCast: (campo, proximo) => {
    if (campo.type === 'TINY' && campo.length === 1) {
      const v = campo.string();
      return v === null ? null : v === '1';
    }
    return proximo();
  },
});

// DATETIME não guarda fuso: escrevemos e lemos sempre em UTC, seja qual for o fuso do servidor MySQL.
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

export async function query<T = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function queryOne<T = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export async function transacao<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
