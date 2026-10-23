import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ErroApi, token, wsUrl } from './api';
import { textoEvento } from './fila';
import { useSessao } from './sessao';
import type { CampoQuestionario, EstadoRota, Papel, TipoAcao } from './tipos';

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'info' | 'erro';
}

export interface DadosInicio {
  km_inicial: number;
  equipe: { usuario_id: number; papel: Papel }[];
  pedidos_levar?: number[];
}

/**
 * Liga o telemóvel à rota do dia: carrega o estado, recebe cada alteração pelo WebSocket
 * e envia as ações com a versão da fila. Nada fica guardado só no aparelho.
 */
export function useRotaDia() {
  const { usuario } = useSessao();
  const meuId = usuario!.id;
  const souAdm = usuario!.tipo === 'adm';

  // undefined = ainda a carregar; null = não há rota hoje
  const [estado, setEstado] = useState<EstadoRota | null | undefined>(undefined);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const [erro, setErro] = useState('');
  const [ligado, setLigado] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const ultimoEvento = useRef<number | null>(null);

  const avisar = useCallback((texto: string, tipo: Aviso['tipo'] = 'info') => {
    const id = Date.now() + Math.random();
    setAvisos((lista) => [...lista.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), tipo === 'erro' ? 7000 : 5000);
  }, []);

  const aplicar = useCallback(
    (novo: EstadoRota | null) => {
      const atual = estadoRef.current;
      // Uma resposta atrasada não pode sobrepor-se a um estado mais recente vindo pelo WebSocket.
      if (novo && atual && atual.rota.id === novo.rota.id && novo.gerado_em < atual.gerado_em) return;
      setEstado(novo);
      estadoRef.current = novo;
      const visto = ultimoEvento.current;
      const maximo = novo ? Math.max(0, ...novo.eventos.map((e) => e.id)) : 0;
      // Avisos só para toques de outras pessoas, e nunca no primeiro carregamento.
      if (visto !== null && novo) {
        for (const e of novo.eventos) {
          if (e.id > visto && e.usuario_id !== meuId) {
            const texto = textoEvento(e);
            if (texto) avisar(texto);
          }
        }
      }
      ultimoEvento.current = Math.max(visto ?? 0, maximo);
    },
    [avisar, meuId],
  );

  const recarregar = useCallback(async () => {
    try {
      const r = await api<{ estado: EstadoRota | null }>('/rotas/atual');
      aplicar(r.estado);
      setErro('');
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [aplicar]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let tentativas = 0;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let desmontado = false;

    const fechar = () => {
      if (!ws) return;
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      ws.close();
      ws = null;
    };
    const ligar = () => {
      fechar();
      clearTimeout(temporizador);
      if (desmontado) return;
      const socket = new WebSocket(wsUrl());
      ws = socket;
      socket.onopen = () => socket.send(JSON.stringify({ tipo: 'auth', token: token.ler() }));
      socket.onmessage = (ev) => {
        const m = JSON.parse(ev.data as string) as { tipo: string; estado?: EstadoRota | null };
        if (m.tipo === 'pronto') {
          tentativas = 0;
          setLigado(true);
          void recarregar();
        } else if (m.tipo === 'rota' && m.estado !== undefined) {
          aplicar(m.estado);
        }
      };
      socket.onclose = () => {
        setLigado(false);
        if (desmontado) return;
        // Reconecta sozinho, com espera crescente até 15 s.
        temporizador = setTimeout(ligar, Math.min(15_000, 1000 * 2 ** Math.min(tentativas++, 4)));
      };
      socket.onerror = () => socket.close();
    };
    const aoFicarOnline = () => {
      setOnline(true);
      tentativas = 0;
      ligar();
    };
    const aoFicarOffline = () => setOnline(false);
    const aoVoltarAoEcra = () => {
      if (document.visibilityState !== 'visible') return;
      if (ws?.readyState === WebSocket.OPEN) void recarregar();
      else {
        tentativas = 0;
        ligar();
      }
    };

    ligar();
    void recarregar();
    window.addEventListener('online', aoFicarOnline);
    window.addEventListener('offline', aoFicarOffline);
    document.addEventListener('visibilitychange', aoVoltarAoEcra);
    // Os links das fotos expiram ao fim de 1 h; recarregar de vez em quando renova-os.
    const renovacao = setInterval(() => void recarregar(), 40 * 60 * 1000);

    return () => {
      desmontado = true;
      clearTimeout(temporizador);
      clearInterval(renovacao);
      fechar();
      window.removeEventListener('online', aoFicarOnline);
      window.removeEventListener('offline', aoFicarOffline);
      document.removeEventListener('visibilitychange', aoVoltarAoEcra);
    };
  }, [aplicar, recarregar]);

  const tratarErro = useCallback(
    (e: unknown) => {
      if (e instanceof ErroApi && e.status === 409 && e.dados.estado) aplicar(e.dados.estado as EstadoRota);
      avisar((e as Error).message, 'erro');
      return false;
    },
    [aplicar, avisar],
  );

  const agir = useCallback(
    async (tipo: TipoAcao, extras: Record<string, unknown> = {}) => {
      const atual = estadoRef.current;
      if (!atual) return false;
      try {
        const r = await api<{ estado: EstadoRota }>(`/rotas/${atual.rota.id}/acoes`, {
          method: 'POST',
          json: { tipo, versao: atual.rota.versao_fila, ...extras },
        });
        aplicar(r.estado);
        return true;
      } catch (e) {
        return tratarErro(e);
      }
    },
    [aplicar, tratarErro],
  );

  const responder = useCallback(
    async (paradaId: number, campo: CampoQuestionario, valor: boolean | string | null) => {
      const atual = estadoRef.current;
      if (!atual) return false;
      try {
        const r = await api<{ estado: EstadoRota }>(`/rotas/${atual.rota.id}/paradas/${paradaId}/questionario`, {
          method: 'PATCH',
          json: { campo, valor },
        });
        aplicar(r.estado);
        return true;
      } catch (e) {
        return tratarErro(e);
      }
    },
    [aplicar, tratarErro],
  );

  const responderPedido = useCallback(
    async (paradaId: number, pedidoId: number, resposta: 'entregue' | 'adiado' | null) => {
      const atual = estadoRef.current;
      if (!atual) return false;
      try {
        const r = await api<{ estado: EstadoRota }>(`/rotas/${atual.rota.id}/paradas/${paradaId}/pedidos/${pedidoId}`, {
          method: 'POST',
          json: { resposta },
        });
        aplicar(r.estado);
        return true;
      } catch (e) {
        return tratarErro(e);
      }
    },
    [aplicar, tratarErro],
  );

  const ligacaoFeita = useCallback(
    async (paradaId: number, feita = true) => {
      const atual = estadoRef.current;
      if (!atual) return false;
      try {
        const r = await api<{ estado: EstadoRota }>(`/rotas/${atual.rota.id}/paradas/${paradaId}/ligacao`, {
          method: 'POST',
          json: { feita },
        });
        aplicar(r.estado);
        return true;
      } catch (e) {
        return tratarErro(e);
      }
    },
    [aplicar, tratarErro],
  );

  const iniciar = useCallback(
    async (dados: DadosInicio) => {
      try {
        const r = await api<{ estado: EstadoRota }>('/rotas', { method: 'POST', json: dados });
        aplicar(r.estado);
        return true;
      } catch (e) {
        if (e instanceof ErroApi && e.status === 409) void recarregar();
        avisar((e as Error).message, 'erro');
        return false;
      }
    },
    [aplicar, avisar, recarregar],
  );

  const gravarEquipa = useCallback(
    async (equipe: DadosInicio['equipe']) => {
      const atual = estadoRef.current;
      if (!atual) return false;
      try {
        const r = await api<{ estado: EstadoRota }>(`/rotas/${atual.rota.id}/equipe`, { method: 'PUT', json: { equipe } });
        aplicar(r.estado);
        return true;
      } catch (e) {
        return tratarErro(e);
      }
    },
    [aplicar, tratarErro],
  );

  const entrarNaEquipa = useCallback(async () => {
    const atual = estadoRef.current;
    if (!atual) return false;
    try {
      const r = await api<{ estado: EstadoRota }>(`/rotas/${atual.rota.id}/equipe/entrar`, { method: 'POST', json: {} });
      aplicar(r.estado);
      return true;
    } catch (e) {
      return tratarErro(e);
    }
  }, [aplicar, tratarErro]);

  const papel = estado?.equipe.find((m) => m.usuario_id === meuId)?.papel ?? null;

  return {
    estado,
    erro,
    /** Com ligação ao servidor: sem ela os botões ficam bloqueados. */
    ligado: ligado && online,
    avisos,
    papel,
    membro: papel !== null || souAdm,
    agir,
    responder,
    responderPedido,
    ligacaoFeita,
    iniciar,
    gravarEquipa,
    entrarNaEquipa,
    recarregar,
    avisar,
  };
}

export type RotaDiaApi = ReturnType<typeof useRotaDia>;
