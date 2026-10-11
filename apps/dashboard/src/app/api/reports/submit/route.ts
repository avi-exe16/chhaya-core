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

interface AuditItem {
  sequence: number;
  action: string;
  clusterId: string;
  imageHash: string;
  prevHash: string;
  entryHash: string;
  timestamp: string;
}

declare global {
  // eslint-disable-next-line no-var
  var activeClusters: ClusterItem[] | undefined;
  // eslint-disable-next-line no-var
  var auditLedger: AuditItem[] | undefined;
}

globalThis.activeClusters = globalThis.activeClusters || [];
globalThis.auditLedger = globalThis.auditLedger || [];

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
      return NextResponse.json({ error: 'Missing mandatory fields' }, { status: 400 });
    }
    const imageHash = crypto.createHash('sha256').update(image).digest('hex').slice(0, 16);
    const clusters = globalThis.activeClusters!;
    const matchedCluster = clusters.find((c) => {
      return calculateDistance(latitude, longitude, c.lat, c.lng) <= 50;
    });
    let clusterId: string;
    if (matchedCluster) {
      matchedCluster.reportsCount += 1;
      matchedCluster.lastUpdated = new Date().toISOString();
      matchedCluster.images.push(image);
      matchedCluster.vps = Math.min(1.0, matchedCluster.vps + 0.1);
      clusterId = matchedCluster.id;
    } else {
      clusterId = 'CLUST-' + Date.now().toString().slice(-4);
      const newCluster: ClusterItem = {
        id: clusterId,
        lat: latitude,
        lng: longitude,
        description: description || 'Civic infrastructure report',
        reportsCount: 1,
        vps: 0.65,
        sai: 0.72,
        status: 'PENDING_ACTION',
        images: [image],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      clusters.push(newCluster);
    }
    const ledger = globalThis.auditLedger!;
    const prevHash = ledger.length > 0 ? ledger[ledger.length - 1].entryHash : '0'.repeat(64);
    const seq = ledger.length + 1;
    const entryHash = crypto
      .createHash('sha256')
      .update(seq + '|REPORT_INGEST|' + clusterId + '|' + imageHash + '|' + prevHash)
      .digest('hex');
    ledger.push({
      sequence: seq,
      action: 'REPORT_INGEST',
      clusterId,
      imageHash,
      prevHash,
      entryHash,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({
      success: true,
      clusterId,
      auditHash: entryHash,
      merged: Boolean(matchedCluster),
    });
  } catch {
    return NextResponse.json({ error: 'Internal processing failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    clusters: globalThis.activeClusters || [],
    ledger: globalThis.auditLedger || [],
  });
}
