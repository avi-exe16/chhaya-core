'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import InspectionDrawer from '@/components/InspectionDrawer';

const ClusterMap = dynamic(() => import('@/components/ClusterMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950 font-mono text-xs text-zinc-500">
      Initializing Spatial Engine...
    </div>
  ),
});

export default function DashboardPage() {
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyHighSeverity, setOnlyHighSeverity] = useState(false);

  const handleStatusUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Header bar */}
      <header className="absolute top-0 left-0 z-10 flex h-14 w-full items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="font-mono text-sm font-bold tracking-wider text-zinc-100 uppercase">
            Chhaya Core <span className="text-zinc-500">| Tactical Spatial Console</span>
          </h1>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-4 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter clusters by status"
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="triaged">Triaged</option>
              <option value="dispatched">Dispatched</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-zinc-300 select-none">
            <input
              type="checkbox"
              checked={onlyHighSeverity}
              onChange={(e) => setOnlyHighSeverity(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-0"
            />
            <span>High Severity (VPS ≥ 0.4)</span>
          </label>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-4 font-mono text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <span>Triaged</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span>Dispatched</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Resolved</span>
          </div>
        </div>
      </header>

      {/* Main Map Canvas */}
      <div className="h-full w-full pt-14">
        <ClusterMap
          onClusterSelect={(id) => setSelectedClusterId(id)}
          refreshTrigger={refreshTrigger}
          statusFilter={statusFilter}
          onlyHighSeverity={onlyHighSeverity}
        />
      </div>

      {/* Slide-out Inspection Drawer */}
      <InspectionDrawer
        clusterId={selectedClusterId}
        onClose={() => setSelectedClusterId(null)}
        onStatusUpdated={handleStatusUpdated}
      />
    </main>
  );
}