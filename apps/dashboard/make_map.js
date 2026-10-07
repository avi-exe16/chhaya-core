const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src', 'components', 'ClusterMap.tsx');

const content = `'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapType } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface ClusterMapProps {
  onSelectCluster: (clusterId: string) => void;
}

export default function ClusterMap({ onSelectCluster }: ClusterMapProps) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [77.4126, 23.2599],
      zoom: 12,
    });

    mapRef.current = mapInstance;

    mapInstance.on('load', async () => {
      const apiKey = process.env.NEXT_PUBLIC_MUNICIPAL_API_KEY || '';
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

      try {
        const response = await fetch(\`\${baseUrl}/api/v1/clusters/geojson\`, {
          headers: { Authorization: \`Bearer \${apiKey}\` },
        });
        const geojsonData = await response.json();

        mapInstance.addSource('clusters', {
          type: 'geojson',
          data: geojsonData,
        });

        mapInstance.addLayer({
          id: 'cluster-glow',
          type: 'circle',
          source: 'clusters',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'saiScore'],
              0.1,
              14,
              1.0,
              30,
            ],
            'circle-color': [
              'interpolate',
              ['linear'],
              ['get', 'vpsScore'],
              0.0,
              '#3b82f6',
              0.5,
              '#f59e0b',
              0.8,
              '#ef4444',
            ],
            'circle-opacity': 0.35,
            'circle-blur': 0.6,
          },
        });

        mapInstance.addLayer({
          id: 'cluster-point',
          type: 'circle',
          source: 'clusters',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'incidentCount'],
              1,
              6,
              10,
              16,
            ],
            'circle-color': [
              'interpolate',
              ['linear'],
              ['get', 'vpsScore'],
              0.0,
              '#60a5fa',
              0.5,
              '#fbbf24',
              0.8,
              '#f87171',
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        mapInstance.on('click', 'cluster-point', (e) => {
          if (!e.features || e.features.length === 0) return;
          const clusterId = e.features[0].properties?.clusterId;
          if (clusterId) {
            onSelectCluster(String(clusterId));
          }
        });

        mapInstance.on('mouseenter', 'cluster-point', () => {
          mapInstance.getCanvas().style.cursor = 'pointer';
        });

        mapInstance.on('mouseleave', 'cluster-point', () => {
          mapInstance.getCanvas().style.cursor = '';
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load spatial clusters:', err);
        setIsLoading(false);
      }
    });

    return () => {
      mapInstance.remove();
      mapRef.current = null;
    };
  }, [onSelectCluster]);

  return (