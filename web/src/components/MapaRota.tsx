import { useEffect, useRef } from 'react';
import { divIcon, latLngBounds, type DivIcon } from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import { CENTRO_PADRAO } from '../lib/coordenadas';
import { percurso } from '../lib/rota';
import type { Pessoa, Ponto } from '../lib/tipos';

export interface ItemMapa {
  pessoa: Pessoa;
  /** Posição na rota; null para pausadas ou fora da rota (marcador cinzento, sem número). */
  numero: number | null;
}

const icones = new Map<string, DivIcon>();
function icone(numero: number | null, estado: '' | 'sel' | 'novo'): DivIcon {
  const chave = `${numero}-${estado}`;
  let i = icones.get(chave);
  if (!i) {
    i =
      numero === null
        ? divIcon({ className: '', html: `<div class="marcador-fora ${estado}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })
        : divIcon({ className: '', html: `<div class="marcador-num ${estado}">${numero}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
    icones.set(chave, i);
  }
  return i;
}
const iconeAssociacao = divIcon({ className: '', html: '<div class="marcador-associacao"></div>', iconSize: [26, 26], iconAnchor: [13, 13] });

const ponto = (p: Pessoa): Ponto => ({ lat: p.latitude, lng: p.longitude });

function AjustarVistaUmaVez({ pontos }: { pontos: Ponto[] }) {
  const mapa = useMap();
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current || pontos.length === 0) return;
    feito.current = true;
    mapa.fitBounds(latLngBounds(pontos.map((p) => [p.lat, p.lng])), { padding: [24, 24], maxZoom: 17, animate: false });
  }, [pontos, mapa]);
  return null;
}

function Focar({ alvo }: { alvo: { ponto: Ponto; vez: number } | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (alvo) mapa.panTo([alvo.ponto.lat, alvo.ponto.lng]);
  }, [alvo, mapa]);
  return null;
}

export function MapaRota({
  base,
  itens,
  selecionado,
  novoId,
  focar,
  onSelecionar,
}: {
  base: Ponto | null;
  itens: ItemMapa[];
  selecionado: number | null;
  novoId: number | null;
  focar: { ponto: Ponto; vez: number } | null;
  onSelecionar: (id: number) => void;
}) {
  const ativos = itens.filter((i) => i.numero !== null).sort((a, b) => a.numero! - b.numero!);
  const linha = percurso(ativos.map((i) => ponto(i.pessoa)), base).map((p) => [p.lat, p.lng] as [number, number]);
  const todos = [...(base ? [base] : []), ...itens.map((i) => ponto(i.pessoa))];
  const inicial = base ?? CENTRO_PADRAO;

  return (
    <MapContainer center={[inicial.lat, inicial.lng]} zoom={15} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AjustarVistaUmaVez pontos={todos} />
      <Focar alvo={focar} />
      {linha.length > 1 && <Polyline positions={linha} pathOptions={{ color: '#0f766e', weight: 3, opacity: 0.75 }} />}
      {base && <Marker position={[base.lat, base.lng]} icon={iconeAssociacao} title="Associação" zIndexOffset={-100} />}
      {itens.map(({ pessoa, numero }) => {
        const estado = pessoa.id === novoId ? 'novo' : pessoa.id === selecionado ? 'sel' : '';
        return (
          <Marker
            key={pessoa.id}
            position={[pessoa.latitude, pessoa.longitude]}
            icon={icone(numero, estado)}
            title={numero ? `${numero}. ${pessoa.nome}` : pessoa.nome}
            zIndexOffset={estado ? 1000 : numero === null ? -50 : 0}
            eventHandlers={{ click: () => onSelecionar(pessoa.id) }}
          />
        );
      })}
    </MapContainer>
  );
}
