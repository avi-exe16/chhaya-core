'use client';

import { useEffect, useRef, useState } from 'react';
import { Map, NavigationControl, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface ClusterMapProps {
  onClusterSelect?: (clusterId: string) => void;
  refreshTrigger?: number;
  statusFilter?: string;
  onlyHighSeverity?: boolean;
}

export default function ClusterMap({
  onClusterSelect,
  refreshTrigger = 0,
  statusFilter = 'all',
  onlyHighSeverity = false,
}: ClusterMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const onSelectRef = useRef(onClusterSelect);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onClusterSelect;
  }, [onClusterSelect]);

  // 1. Initialize Map instance once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      const instance = new Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'carto-dark': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
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
        center: [72.8777, 19.076], // Default center: Mumbai
        zoom: 11,
      });

      instance.addControl(new NavigationControl(), 'top-left');

      instance.on('load', () => {
        if (!instance.getSource('clusters')) {
          instance.addSource('clusters', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          // Outer pulse glow
          instance.addLayer({
            id: 'clusters-glow',
            type: 'circle',
            source: 'clusters',
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['coalesce', ['get', 'incidentCount'], 1],
                1, 14,
                5, 22,
                10, 32,
              ],
              'circle-color': [
                'match',
                ['get', 'status'],
                'triaged', '#38bdf8',
                'dispatched', '#818cf8',
                'resolved', '#34d399',
                'rejected', '#f87171',
                '#f59e0b',
              ],
              'circle-opacity': 0.25,
            },
          });

          // Core marker dot
          instance.addLayer({
            id: 'clusters-point',
            type: 'circle',
            source: 'clusters',
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['coalesce', ['get', 'incidentCount'], 1],
                1, 6,
                5, 10,
                10, 16,
              ],
              'circle-color': [
                'match',
                ['get', 'status'],
                'triaged', '#0284c7',
                'dispatched', '#4f46e5',
                'resolved', '#059669',
                'rejected', '#dc2626',
                '#d97706',
              ],
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff',
            },
          });

          // Label
          instance.addLayer({
            id: 'clusters-label',
            type: 'symbol',
            source: 'clusters',
            layout: {
              'text-field': ['to-string', ['coalesce', ['get', 'incidentCount'], '']],
              'text-size': 10,
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#ffffff',
            },
          });

          instance.on('mouseenter', 'clusters-point', () => {
            instance.getCanvas().style.cursor = 'pointer';
          });
          instance.on('mouseleave', 'clusters-point', () => {
            instance.getCanvas().style.cursor = '';
          });

          instance.on('click', 'clusters-point', (e) => {
            if (!e.features || e.features.length === 0) return;
            const props = e.features[0].properties;
            if (props && props.clusterId && onSelectRef.current) {
              onSelectRef.current(props.clusterId);
            }
          });
        }

        setMapLoaded(true);
      });

      map.current = instance;
    } catch (err: any) {
      setError(err.message || 'Failed to initialize map');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 2. Pure data update loop with client-side & server-side filter support
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    let active = true;

    async function updateClusterData() {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') {
          params.append('status', statusFilter);
        }

        const url = params.toString() ? `/api/clusters?${params.toString()}` : '/api/clusters';
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`API responded with HTTP ${response.status}: ${response.statusText}`);
        }

        const geojsonData = await response.json();
        if (!active || !map.current) return;

        // Apply client-side filters (such as High Severity VPS >= 0.4)
        let filteredFeatures = geojsonData.features || [];
        if (statusFilter !== 'all') {
          filteredFeatures = filteredFeatures.filter(
            (f: any) => f.properties?.status === statusFilter
          );
        }
        if (onlyHighSeverity) {
          filteredFeatures = filteredFeatures.filter(
            (f: any) => (f.properties?.vpsScore ?? 0) >= 0.4
          );
        }

        const source = map.current.getSource('clusters') as GeoJSONSource | undefined;
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features: filteredFeatures,
          });
        }
      } catch (err: any) {
        if (active) setError(err.message || 'Failed to update cluster layer');
      }
    }

    updateClusterData();

    return () => {
      active = false;
    };
  }, [mapLoaded, refreshTrigger, statusFilter, onlyHighSeverity]);

  return (
    <div className="relative h-full w-full">
      {error && (
        <div className="absolute top-4 left-4 z-10 rounded border border-rose-800 bg-rose-950/90 px-3 py-2 font-mono text-xs text-rose-300 backdrop-blur">
          {error}
        </div>
      )}
      <div ref={mapContainer} className="h-full w-full bg-zinc-950" />
    </div>
  );
}