import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const backendUrl = process.env.INTERNAL_BACKEND_URL || 'http://127.0.0.1:4000';
    const res = await fetch(`${backendUrl}/api/clusters`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `Backend returned ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to connect to backend' }, { status: 502 });
  }
}
