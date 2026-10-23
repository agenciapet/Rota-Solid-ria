import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ProvedorSessao, useSessao } from './lib/sessao';
import { Layout } from './components/Layout';
import { Carregando } from './components/ui';
import { Login } from './pages/Login';
import { AssociacaoPagina } from './pages/AssociacaoPagina';
import { Pessoas } from './pages/Pessoas';
import { PessoaFicha } from './pages/PessoaFicha';
import { Voluntarios } from './pages/Voluntarios';
import { MontagemRota } from './pages/MontagemRota';
import { RotaDia } from './pages/RotaDia';
import { RelatorioPagina } from './pages/RelatorioPagina';

function ExigeLogin() {
  const { usuario, carregando } = useSessao();
  if (carregando) return <Carregando />;
  return usuario ? <Outlet /> : <Navigate to="/entrar" replace />;
}

function ExigeAdm() {
  const { usuario } = useSessao();
  return usuario?.tipo === 'adm' ? <Outlet /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ProvedorSessao>
      <BrowserRouter>
        <Routes>
          <Route path="/entrar" element={<Login />} />
          <Route element={<ExigeLogin />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/hoje" replace />} />
              <Route path="hoje" element={<RotaDia />} />
              <Route path="relatorios/:id" element={<RelatorioPagina />} />
              <Route element={<ExigeAdm />}>
                <Route path="rota" element={<MontagemRota />} />
                <Route path="associacao" element={<AssociacaoPagina />} />
                <Route path="pessoas" element={<Pessoas />} />
                <Route path="pessoas/nova" element={<PessoaFicha />} />
                <Route path="pessoas/:id" element={<PessoaFicha />} />
                <Route path="voluntarios" element={<Voluntarios />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProvedorSessao>
  );
}
