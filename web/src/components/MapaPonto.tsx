import { useEffect, useState } from 'react';
import { divIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { CENTRO_PADRAO, formatarPonto, lerCoordenadas } from '../lib/coordenadas';
import type { Ponto } from '../lib/tipos';
import { Botao } from './ui';

const iconePonto = divIcon({ className: '', html: '<div class="marcador-ponto"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
const iconeAssociacao = divIcon({ className: '', html: '<div class="marcador-associacao"></div>', iconSize: [26, 26], iconAnchor: [13, 13] });

function AoTocar({ onToque }: { onToque: (p: Ponto) => void }) {
  useMapEvents({ click: (e) => onToque({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Centrar({ ponto }: { ponto: Ponto | null }) {
  const mapa = useMap();
  useEffect(() => {
    // Sem animação: o Leaflet não cancela a animação de zoom se o mapa for desmontado a meio
    // (ex.: carregar em "Cadastrar" logo depois de colar as coordenadas).
    if (ponto) mapa.setView([ponto.lat, ponto.lng], Math.max(mapa.getZoom(), 17), { animate: false });
  }, [ponto, mapa]);
  return null;
}

/**
 * Marca um ponto de três formas, como pede a especificação:
 * tocar no mapa, usar a localização atual do telemóvel ou colar as coordenadas.
 */
export function MapaPonto({
  valor,
  onChange,
  referencia,
}: {
  valor: Ponto | null;
  onChange: (p: Ponto) => void;
  /** Ponto mostrado como contexto (a Associação), sem ser editável. */
  referencia?: Ponto | null;
}) {
  const [colado, setColado] = useState('');
  const [erro, setErro] = useState('');
  const [aLocalizar, setALocalizar] = useState(false);
  // Só recentra quando o ponto vem de fora do mapa (GPS ou coordenadas coladas).
  const [alvo, setAlvo] = useState<Ponto | null>(null);
  const inicial = valor ?? referencia ?? CENTRO_PADRAO;

  function definirDeFora(p: Ponto) {
    onChange(p);
    setAlvo(p);
    setErro('');
  }

  function usarLocalizacao() {
    if (!navigator.geolocation) return setErro('Este aparelho não permite obter a localização.');
    setALocalizar(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setALocalizar(false);
        definirDeFora({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setALocalizar(false);
        setErro('Não foi possível obter a localização. Verifique a permissão de localização.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function aplicarColado() {
    const p = lerCoordenadas(colado);
    if (!p) return setErro('Coordenadas não reconhecidas. Exemplo: 38.7223, -9.1393');
    definirDeFora(p);
    setColado('');
  }

  return (
    <div className="space-y-2">
      <div className="h-72 overflow-hidden rounded-lg border border-slate-300 sm:h-80">
        <MapContainer center={[inicial.lat, inicial.lng]} zoom={valor ? 17 : 15} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AoTocar onToque={onChange} />
          <Centrar ponto={alvo} />
          {referencia && <Marker position={[referencia.lat, referencia.lng]} icon={iconeAssociacao} interactive={false} />}
          {valor && (
            <Marker
              position={[valor.lat, valor.lng]}
              icon={iconePonto}
              draggable
              eventHandlers={{ dragend: (e) => {
                const ll = e.target.getLatLng();
                onChange({ lat: ll.lat, lng: ll.lng });
              } }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-xs text-slate-500">
        {valor ? `Ponto: ${formatarPonto(valor)} · arraste o marcador para afinar.` : 'Toque no mapa para marcar o ponto.'}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Botao type="button" variante="secundario" onClick={usarLocalizacao} carregando={aLocalizar}>
          Usar a minha localização
        </Botao>
        <div className="flex flex-1 gap-2">
          <input
            value={colado}
            onChange={(e) => setColado(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), aplicarColado())}
            placeholder="Colar coordenadas ou link do Maps"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base"
          />
          <Botao type="button" variante="secundario" onClick={aplicarColado} disabled={!colado.trim()}>
            Aplicar
          </Botao>
        </div>
      </div>
      {erro && <p className="text-sm text-red-700">{erro}</p>}
    </div>
  );
}
