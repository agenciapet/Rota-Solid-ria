import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { EstadoRota } from '../lib/tipos';
import { Aviso, Carregando } from '../components/ui';
import { Relatorio } from '../components/rota/Relatorio';

/** Relatório de uma rota já concluída, por link; a rota a decorrer vive em /hoje. */
export function RelatorioPagina() {
  const { id } = useParams();
  const [estado, setEstado] = useState<EstadoRota | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api<{ estado: EstadoRota }>(`/rotas/${id}`)
      .then((r) => setEstado(r.estado))
      .catch((e) => setErro(e.message));
  }, [id]);

  if (erro) return <Aviso>{erro}</Aviso>;
  if (!estado) return <Carregando />;
  if (estado.rota.status !== 'concluida') {
    return (
      <Aviso tipo="info">
        Esta rota ainda está a decorrer.{' '}
        <Link to="/hoje" className="font-medium underline">
          Ver a rota de hoje
        </Link>
      </Aviso>
    );
  }
  return <Relatorio estado={estado} />;
}
