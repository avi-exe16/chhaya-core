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

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function redisCommand(command: any[]) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + UPSTASH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
    });
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var activeClusters: ClusterItem[] | undefined;
}
globalThis.activeClusters = globalThis.activeClusters || [];

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
      return NextResponse.json({ error: 'Missing coordinates or photo proof.' }, { status: 400 });
    }

    const imageHash = crypto.createHash('sha256').update(image).digest('hex').slice(0, 16);

    let clusters: ClusterItem[] = [];
    const raw = await redisCommand(['GET', 'CHHAYA_CLUSTERS']);
    if (raw) {
      try { clusters = JSON.parse(raw); } catch {}
    }
    if (clusters.length === 0 && globalThis.activeClusters) {
      clusters = globalThis.activeClusters;
    }

    const matchedCluster = clusters.find((c) => {
      return calculateDistance(latitude, longitude, c.lat, c.lng) <= 50;
    });

    let clusterId: string;
    if (matchedCluster) {
      matchedCluster.reportsCount += 1;
      matchedCluster.lastUpdated = new Date().toISOString();
      matchedCluster.images = [image, ...matchedCluster.images.slice(0, 3)];
      matchedCluster.vps = Math.min(1.0, Number((matchedCluster.vps + 0.1).toFixed(2)));
      clusterId = matchedCluster.id;
    } else {
      clusterId = 'INC-' + Date.now().toString().slice(-4);
      const newCluster: ClusterItem = {
        id: clusterId,
        lat: latitude,
        lng: longitude,
        description: description || 'Civic infrastructure anomaly',
        reportsCount: 1,
        vps: 0.65,
        sai: 0.72,
        status: 'PENDING_ACTION',
        images: [image],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      clusters.unshift(newCluster);
    }

    await redisCommand(['SET', 'CHHAYA_CLUSTERS', JSON.stringify(clusters)]);
    globalThis.activeClusters = clusters;

    return NextResponse.json({
      success: true,
      clusterId,
      imageHash,
      merged: Boolean(matchedCluster),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal failure' }, { status: 500 });
  }
}

export async function GET() {
  let clusters: ClusterItem[] = [];
  const raw = await redisCommand(['GET', 'CHHAYA_CLUSTERS']);
  if (raw) {
    try { clusters = JSON.parse(raw); } catch {}
  }
  if (clusters.length === 0) {
    clusters = globalThis.activeClusters || [];
  }
  return NextResponse.json({ clusters }, { headers: { 'Cache-Control': 'no-store' } });
}
