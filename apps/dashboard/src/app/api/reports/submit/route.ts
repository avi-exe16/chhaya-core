import { NextResponse } from 'next/server';
import crypto from 'crypto';

interface ClusterItem {
  id: string;
  lat: number;
  lng: number;
  description: string;
  reportsCount: number;
  vps: number;
  sai: number;
  status: string;
  images: string[];
  createdAt: string;
  lastUpdated: string;
}

// In-memory fallback backed by global node scope
declare global {
  // eslint-disable-next-line no-var
  var globalStore: ClusterItem[] | undefined;
}
if (!globalThis.globalStore) {
  globalThis.globalStore = [];
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { latitude, longitude, description, image } = body;

    if (!latitude || !longitude || !image) {
      return NextResponse.json({ error: 'Missing coordinates or image proof.' }, { status: 400 });
    }

    const clusters = globalThis.globalStore!;
    const matched = clusters.find((c) => calculateDistance(latitude, longitude, c.lat, c.lng) <= 60);
    let clusterId: string;

    if (matched) {
      matched.reportsCount += 1;
      matched.lastUpdated = new Date().toISOString();
      matched.images.unshift(image);
      matched.vps = Math.min(1.0, Number((matched.vps + 0.1).toFixed(2)));
      clusterId = matched.id;
    } else {
      clusterId = 'INC-' + Math.floor(1000 + Math.random() * 9000);
      const newCluster: ClusterItem = {
        id: clusterId,
        lat: Number(latitude),
        lng: Number(longitude),
        description: description || 'Civic infrastructure defect',
        reportsCount: 1,
        vps: 0.85,
        sai: 0.76,
        status: 'PENDING_ACTION',
        images: [image],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      clusters.unshift(newCluster);
    }

    return NextResponse.json({
      success: true,
      clusterId,
      merged: Boolean(matched),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ingress failure' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { clusters: globalThis.globalStore || [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
