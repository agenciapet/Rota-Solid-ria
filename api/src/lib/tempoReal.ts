import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { usuarioDoToken } from './auth.js';

// A fila fica no servidor e é a mesma para todos os telemóveis: cada alteração é difundida
// a todos os clientes autenticados. Com uma rota de cada vez, não há salas: todos recebem tudo.
const clientes = new Map<WebSocket, { usuarioId: number; vivo: boolean }>();

export function iniciarTempoReal(servidor: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  servidor.on('upgrade', (req, socket, head) => {
    const caminho = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (caminho !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    // A primeira mensagem tem de ser a autenticação; sem ela em 5 s a ligação fecha.
    const prazo = setTimeout(() => ws.close(4001, 'Sem autenticação'), 5000);
    ws.once('message', async (dados) => {
      clearTimeout(prazo);
      let token = '';
      try {
        token = String(JSON.parse(String(dados)).token ?? '');
      } catch {
        /* mensagem inválida: trata-se como sem token */
      }
      const usuario = token ? await usuarioDoToken(token) : null;
      if (!usuario) {
        ws.close(4003, 'Sessão inválida');
        return;
      }
      clientes.set(ws, { usuarioId: usuario.id, vivo: true });
      ws.on('pong', () => {
        const c = clientes.get(ws);
        if (c) c.vivo = true;
      });
      ws.on('close', () => clientes.delete(ws));
      ws.send(JSON.stringify({ tipo: 'pronto' }));
    });
  });

  // Ligações que deixaram de responder (telemóvel sem rede) são fechadas para não acumular.
  setInterval(() => {
    for (const [ws, c] of clientes) {
      if (!c.vivo) {
        ws.terminate();
        clientes.delete(ws);
        continue;
      }
      c.vivo = false;
      ws.ping();
    }
  }, 30_000).unref();
}

export function difundir(mensagem: unknown): void {
  const texto = JSON.stringify(mensagem);
  for (const ws of clientes.keys()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(texto);
  }
}
