'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ClusterFeature, ClusterFeatureCollection } from '../types/dashboard';

interface UseClustersOptions {
  statusFilter?: string;
  onlyHighSeverity?: boolean;
  refreshIntervalMs?: number;
}

export function useClusters({
  statusFilter = 'all',
  onlyHighSeverity = false,
  refreshIntervalMs = 4000,
}: UseClustersOptions = {}) {
  const [clusters, setClusters] = useState<ClusterFeature[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef<boolean>(true);

  const fetchClusters = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`/api/clusters?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`Gateway returned HTTP ${res.status}`);
      }

      const data: ClusterFeatureCollection = await res.json();
      let features = data.features || [];

      if (onlyHighSeverity) {
        features = features.filter(
          (f: ClusterFeature) => (f.properties?.vpsScore ?? 0) >= 0.4
        );
      }

      setClusters(features);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Telemetry link degraded');
    } finally {
      if (isInitialMount.current) {
        setIsLoading(false);
        isInitialMount.current = false;
      }
    }
  }, [statusFilter, onlyHighSeverity]);

  useEffect(() => {
    fetchClusters();
    const interval = setInterval(fetchClusters, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchClusters, refreshIntervalMs]);

  return { clusters, isLoading, error, refetch: fetchClusters };
}