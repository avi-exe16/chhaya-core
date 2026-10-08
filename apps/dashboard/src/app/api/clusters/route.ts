import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.INTERNAL_BACKEND_URL || 'http://127.0.0.1:4000';
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const url = queryString ? `${backendUrl}/api/clusters?${queryString}` : `${backendUrl}/api/clusters`;

    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned status ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to connect to backend on 127.0.0.1:4000' },
      { status: 502 }
    );
  }
}