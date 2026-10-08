'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ClusterFeature } from '../types/dashboard';
import { useClusters } from '../hooks/useClusters';
import PublicComplaintFeed from '../components/PublicComplaintFeed';
import InspectionDrawer from '../components/InspectionDrawer';
import CitizenIntakeModal from '../components/CitizenIntakeModal';
import { 
  Building2, MessageSquare, Camera, Truck, 
  CheckCircle2, PlusCircle, Check
} from 'lucide-react';

const ClusterMap = dynamic(() => import('../components/ClusterMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950 font-sans text-sm text-zinc-300">
      Loading Incident Map...
    </div>
  ),
});

export default function DashboardPage() {
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { clusters, refetch } = useClusters({
    statusFilter: 'all',
    onlyHighSeverity: false,
  });

  const totalComplaints = clusters.reduce(
    (acc: number, c: ClusterFeature) => acc + (c.properties.incidentCount || 0),
    0
  );
  const dispatchedCount = clusters.filter(
    (c: ClusterFeature) => c.properties.status === 'dispatched'
  ).length;
  const resolvedCount = clusters.filter(
    (c: ClusterFeature) => c.properties.status === 'resolved'
  ).length;

  const handleModalSuccess = async () => {
    setToastMessage('New citizen complaint received, deduplicated & mapped!');
    setTimeout(() => setToastMessage(null), 3500);
    await refetch();
  };

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      
      {/* 1. Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-700 bg-zinc-950 px-6 z-30 shadow-md">
        
        {/* App Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight">
              City Civic Complaint Center
            </h1>
            <p className="text-xs text-zinc-400">
              Live citizen report monitoring & repair dispatch
            </p>
          </div>
        </div>

        {/* Real Counters */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium text-zinc-400">Active Incident Locations:</span>
            <span className="text-sm font-bold text-white">{clusters.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-medium text-zinc-400">Citizen Reports Merged:</span>
            <span className="text-sm font-bold text-sky-300">{totalComplaints}</span>
          </div>

          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-medium text-zinc-400">Repair Teams Dispatched:</span>
            <span className="text-sm font-bold text-amber-300">{dispatchedCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium text-zinc-400">Repairs Completed:</span>
            <span className="text-sm font-bold text-emerald-300">{resolvedCount}</span>
          </div>
        </div>

        {/* Open Citizen Intake Modal */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          + Test Submit Complaint
        </button>
      </header>

      {/* Confirmation Toast */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] flex items-center gap-2 rounded-xl border border-emerald-500 bg-zinc-900 px-4 py-2.5 text-xs font-bold text-emerald-300 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <Check className="h-4 w-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* 2. Main Work Area */}
      <div className="relative flex flex-1 overflow-hidden">
        
        {/* Left Side: Citizen Complaints Feed */}
        <div className="w-full md:w-[380px] lg:w-[420px] shrink-0 h-full z-10">
          <PublicComplaintFeed
            clusters={clusters}
            selectedClusterId={selectedClusterId}
            onSelectCluster={(id) => setSelectedClusterId(id)}
          />
        </div>

        {/* Right Side: Interactive Map */}
        <main className="relative flex-1 h-full overflow-hidden">
          <ClusterMap
            clusters={clusters}
            selectedClusterId={selectedClusterId}
            onClusterSelect={(id: string) => setSelectedClusterId(id)}
          />

          {/* Right Drawer for Selected Complaint */}
          <InspectionDrawer
            clusterId={selectedClusterId}
            onClose={() => setSelectedClusterId(null)}
            onStatusUpdated={refetch}
          />
        </main>
      </div>

      {/* 3. Interactive Citizen Intake Modal */}
      <CitizenIntakeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />

    </div>
  );
}