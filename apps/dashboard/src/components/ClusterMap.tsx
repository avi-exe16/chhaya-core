'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface ClusterMapProps {
  onSelectCluster?: (clusterId: string) => void;
}

export default function ClusterMap({ onSelectCluster }: ClusterMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // 1. Initialize MapLibre GL with CORS-friendly dark CARTO tiles
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [77.4126, 23.2599], // Centroid over Bhopal
      zoom: 11,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', async () => {
      try {
        setLoading(true);
        setError(null);

        // 2. Fetch GeoJSON from Express API Gateway (Port 4000)
        const response = await fetch(`${baseUrl}/api/clusters`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`API responded with HTTP ${response.status}: ${response.statusText}`);
        }

        const geojsonData = await response.json();

        // 3. Mount GeoJSON Source
        map.addSource('clusters', {
          type: 'geojson',
          data: geojsonData,
        });

        // 4. Cluster Circle Severity Layer
        map.addLayer({
          id: 'cluster-circles',
          type: 'circle',
          source: 'clusters',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'incidentCount'], 1],
              1, 14,
              5, 24,
              15, 38,
            ],
            'circle-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'vpsScore'], 0],
              0.0, '#10b981', // emerald-500
              0.4, '#f59e0b', // amber-500
              0.7, '#ef4444', // red-500
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // 5. Incident Count Label Layer
        map.addLayer({
          id: 'cluster-counts',
          type: 'symbol',
          source: 'clusters',
          layout: {
            'text-field': ['coalesce', ['to-string', ['get', 'incidentCount']], '1'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        // 6. Interactive Click & Hover
        map.on('mouseenter', 'cluster-circles', () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'cluster-circles', () => {
          map.getCanvas().style.cursor = '';
        });

        map.on('click', 'cluster-circles', (e) => {
          if (!e.features || !e.features[0]) return;
          const clusterId = e.features[0].properties?.clusterId || e.features[0].id;
          if (clusterId && onSelectCluster) {
            onSelectCluster(String(clusterId));
          }
        });

        // Fit map bounds to active PostGIS incidents if available
        if (geojsonData.features && geojsonData.features.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          geojsonData.features.forEach((feat: any) => {
            if (feat.geometry?.coordinates) {
              bounds.extend(feat.geometry.coordinates as [number, number]);
            }
          });
          map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1000 });
        }

        setLoading(false);
      } catch (err: any) {
        console.error('[ClusterMap] Data ingestion error:', err);
        setError(err.message || 'Failed to fetch cluster telemetry from API');
        setLoading(false);
      }
    });

    return () => {
      map.remove();
    };
  }, [baseUrl, onSelectCluster]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-200 shadow-xl">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span className="font-mono text-xs">Streaming spatial cluster telemetry...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-6 left-6 right-6 z-20 mx-auto max-w-lg rounded-lg border border-red-800/80 bg-red-950/90 p-4 text-red-200 shadow-2xl backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-wider">Telemetry Gateway Error</p>
          <p className="mt-1 font-mono text-xs text-red-300">{error}</p>
          <p className="mt-2 text-[11px] text-zinc-400">
            Endpoint: <code className="text-zinc-200">{baseUrl}/api/v1/clusters/geojson</code>
          </p>
        </div>
      )}
    </div>
  );
}