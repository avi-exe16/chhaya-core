'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClusterFeature } from '../types/dashboard';
import { Layers, Satellite } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

export interface ClusterMapProps {
  clusters: ClusterFeature[];
  selectedClusterId: string | null;
  onClusterSelect: (clusterId: string) => void;
}

type BasemapScheme = 'roadmap' | 'hybrid';

const MAP_TILES: Record<BasemapScheme, { url: string; subdomains: string[] }> = {
  roadmap: {
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  },
  hybrid: {
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  },
};

const STATUS_THEMES: Record<string, { fill: string; ring: string }> = {
  pending: { fill: '#EF4444', ring: 'rgba(239, 68, 68, 0.4)' },
  triaged: { fill: '#3B82F6', ring: 'rgba(59, 130, 246, 0.4)' },
  dispatched: { fill: '#F59E0B', ring: 'rgba(245, 158, 11, 0.4)' },
  resolved: { fill: '#10B981', ring: 'rgba(16, 185, 129, 0.4)' },
};

function createPinIcon(L: any, count: number, status: string, isSelected: boolean) {
  const theme = STATUS_THEMES[status] || STATUS_THEMES.pending;
  const markerHtml = `
    <div class="relative flex items-center justify-center cursor-pointer select-none group" style="width: 38px; height: 46px;">
      <div class="absolute -inset-1 rounded-full ${isSelected ? 'animate-ping' : ''}" style="background-color: ${theme.ring}; opacity: 0.75;"></div>
      <svg viewBox="0 0 24 32" width="38" height="46" class="transition-transform duration-200 group-hover:scale-110 drop-shadow-md">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="${theme.fill}" stroke="#FFFFFF" stroke-width="${isSelected ? '2.5' : '1.5'}"/>
        <circle cx="12" cy="11" r="6" fill="#FFFFFF"/>
      </svg>
      <span class="absolute top-[5px] text-[10px] font-black font-mono text-zinc-900 pointer-events-none">
        ${count}
      </span>
    </div>
  `;

  return L.divIcon({
    html: markerHtml,
    className: 'bg-transparent border-0',
    iconSize: [38, 46],
    iconAnchor: [19, 46],
  });
}

export default function ClusterMap({
  clusters,
  selectedClusterId,
  onClusterSelect,
}: ClusterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const leafletInstance = useRef<any>(null);
  const markersMap = useRef<Map<string, { marker: any; status: string; isSelected: boolean }>>(new Map());
  const [basemap, setBasemap] = useState<BasemapScheme>('roadmap');
  const initialFitDone = useRef(false);

  // Initialize Map Once
  useEffect(() => {
    let active = true;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import('leaflet');
      if (!active || !containerRef.current) return;

      leafletInstance.current = L;

      const map = L.map(containerRef.current, {
        center: [19.076, 72.8777],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
        doubleClickZoom: false,
      });

      const tiles = L.tileLayer(MAP_TILES.roadmap.url, {
        maxZoom: 20,
        subdomains: MAP_TILES.roadmap.subdomains,
      }).addTo(map);

      tileLayerRef.current = tiles;
      markersGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      L.control.zoom({ position: 'bottomright' }).addTo(map);
    }

    initMap();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Basemap Switcher
  const toggleBasemap = async (scheme: BasemapScheme) => {
    if (!mapRef.current || scheme === basemap) return;
    const L = leafletInstance.current;
    if (!L) return;

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = L.tileLayer(MAP_TILES[scheme].url, {
      maxZoom: 20,
      subdomains: MAP_TILES[scheme].subdomains,
    }).addTo(mapRef.current);

    setBasemap(scheme);
  };

  // Synchronize Markers Dynamically
  useEffect(() => {
    const L = leafletInstance.current;
    const group = markersGroupRef.current;
    const map = mapRef.current;
    if (!L || !group || !map) return;

    const currentIds = new Set<string>();
    const bounds: [number, number][] = [];

    clusters.forEach((feat) => {
      const [lng, lat] = feat.geometry.coordinates;
      bounds.push([lat, lng]);

      const { clusterId, incidentCount, status } = feat.properties;
      currentIds.add(clusterId);
      const isSelected = selectedClusterId === clusterId;

      const existing = markersMap.current.get(clusterId);
      if (existing) {
        // If status or selection changed, update icon without destroying marker
        if (existing.status !== status || existing.isSelected !== isSelected) {
          existing.marker.setIcon(createPinIcon(L, incidentCount, status, isSelected));
          existing.status = status;
          existing.isSelected = isSelected;
        }
        return;
      }

      // Create new marker
      const marker = L.marker([lat, lng], {
        icon: createPinIcon(L, incidentCount, status, isSelected),
      });

      marker.on('click', (e: any) => {
        if (e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
          L.DomEvent.preventDefault(e.originalEvent);
        }
        onClusterSelect(clusterId);
      });

      group.addLayer(marker);
      markersMap.current.set(clusterId, { marker, status, isSelected });
    });

    // Remove pruned markers
    markersMap.current.forEach((val, id) => {
      if (!currentIds.has(id)) {
        group.removeLayer(val.marker);
        markersMap.current.delete(id);
      }
    });

    if (!initialFitDone.current && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 14 });
      initialFitDone.current = true;
    }
  }, [clusters, selectedClusterId, onClusterSelect]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950 font-sans">
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-1.5 backdrop-blur-md shadow-2xl">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="font-mono text-xs font-semibold text-zinc-200">
            {clusters.length} Active Targets
          </span>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-[1000] flex rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-1 backdrop-blur-md shadow-2xl">
        <button
          type="button"
          onClick={() => toggleBasemap('roadmap')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
            basemap === 'roadmap'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Roadmap
        </button>
        <button
          type="button"
          onClick={() => toggleBasemap('hybrid')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
            basemap === 'hybrid'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Satellite className="h-3.5 w-3.5" />
          Satellite
        </button>
      </div>

      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}