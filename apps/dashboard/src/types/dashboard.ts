export type IncidentStatus = 'pending' | 'triaged' | 'dispatched' | 'resolved';

export interface IncidentReport {
  id: string;
  source: string;
  rawText?: string;
  imagePhash?: string;
  timestamp?: string;
}

export interface ClusterProperties {
  clusterId: string;
  incidentCount: number;
  vpsScore: number;
  saiScore: number;
  headline?: string | null;
  assetCategory?: string;
  sowMemo?: string | null;
  status: IncidentStatus;
  createdAt: string;
}

export interface ClusterFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: ClusterProperties;
}

export interface ClusterFeatureCollection {
  type: 'FeatureCollection';
  features: ClusterFeature[];
}