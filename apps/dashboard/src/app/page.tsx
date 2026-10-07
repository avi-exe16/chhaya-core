'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import InspectionDrawer from '@/components/InspectionDrawer';

const ClusterMap = dynamic(
  () => import('@/components/ClusterMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-400 font-mono text-sm">
        Initializing Chhaya Spatial Intelligence Core...
      </div>
    ),
  }
);

export default function DashboardPage() {
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-zinc-950">
      <header className="absolute top-4 left-4 z-10 flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/90 px-4 py-2.5 backdrop-blur shadow-2xl">
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <div>
          <h1 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
            Chhaya Core Operator Console
          </h1>
          <p className="text-[10px] text-zinc-400 font-mono">
            Spatial Clustering • SHA-256 Audit Trail • Live
          </p>
        </div>
      </header>

      <ClusterMap onSelectCluster={(id) => setSelectedClusterId(id)} />

      <InspectionDrawer
        clusterId={selectedClusterId}
        onClose={() => setSelectedClusterId(null)}
      />
    </main>
  );
}
