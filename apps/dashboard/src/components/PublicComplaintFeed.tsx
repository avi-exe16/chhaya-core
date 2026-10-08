'use client';

import { useState } from 'react';
import { 
  MessageSquare, Camera, Mic, MapPin, 
  ChevronRight, AlertCircle, Image as ImageIcon 
} from 'lucide-react';
import type { ClusterFeature } from '../types/dashboard';

interface PublicComplaintFeedProps {
  clusters: ClusterFeature[];
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string) => void;
}

export default function PublicComplaintFeed({
  clusters,
  selectedClusterId,
  onSelectCluster,
}: PublicComplaintFeedProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  const getClusterId = (c: any): string => {
    return (
      c?.properties?.clusterId ||
      c?.properties?.cluster_id ||
      c?.properties?.id ||
      c?.id ||
      ''
    );
  };

  const filteredClusters = clusters.filter((c: any) => {
    const status = c.properties?.status || 'pending';
    if (filter === 'all') return true;
    if (filter === 'pending') return status === 'pending' || status === 'triaged' || status === 'dispatched';
    if (filter === 'resolved') return status === 'resolved';
    return true;
  });

  return (
    <div className="flex h-full w-full flex-col bg-zinc-900 border-r border-zinc-700 text-zinc-100 font-sans select-none">
      {/* Header */}
      <div className="p-4 border-b border-zinc-700 bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Citizen Complaints Feed
            </h2>
          </div>
          <span className="rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 px-2.5 py-0.5 text-xs font-bold">
            Live Stream
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Incoming reports submitted by residents via WhatsApp & Web
        </p>

        {/* Filter Pills */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            All Reports ({clusters.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
              filter === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Needs Action
          </button>
          <button
            type="button"
            onClick={() => setFilter('resolved')}
            className={`px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
              filter === 'resolved'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Fixed
          </button>
        </div>
      </div>

      {/* Complaint List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800 p-2 space-y-1">
        {filteredClusters.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400">
            No complaints matching this filter.
          </div>
        ) : (
          filteredClusters.map((c: any, index: number) => {
            const clusterId = getClusterId(c) || `cluster-${index}`;
            const isSelected = selectedClusterId === clusterId;
            const props = c.properties || {};
            const count = props.incident_count ?? props.incidentCount ?? 1;
            const status = props.status || 'pending';
            const headline = props.headline || 'Civic Infrastructure Incident';
            const memo = props.sow_memo || props.sowMemo || props.technical_root_cause;

            return (
              <div
                key={clusterId}
                role="button"
                tabIndex={0}
                onClick={() => onSelectCluster(clusterId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectCluster(clusterId);
                }}
                className={`group cursor-pointer rounded-xl p-3.5 transition-all border outline-none ${
                  isSelected
                    ? 'bg-zinc-800 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                    : 'bg-zinc-950/70 border-zinc-800 hover:bg-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                {/* Location Title & Status Tag */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[210px]">{headline}</span>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                      status === 'resolved'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                        : status === 'dispatched'
                        ? 'bg-amber-950 text-amber-300 border-amber-600'
                        : status === 'triaged'
                        ? 'bg-sky-950 text-sky-300 border-sky-600'
                        : 'bg-rose-950 text-rose-300 border-rose-600'
                    }`}
                  >
                    {status}
                  </span>
                </div>

                {/* Complaint Summary Description */}
                <p className="mt-2 text-xs text-zinc-300 leading-snug line-clamp-2">
                  {memo
                    ? memo
                    : `Multiple citizens reported severe obstruction and water accumulation near this coordinate.`}
                </p>

                {/* Media Badges & View Details Trigger */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCluster(clusterId);
                      }}
                      className="flex items-center gap-1 text-emerald-400 font-semibold hover:text-emerald-300 transition-colors"
                      title="Inspect aggregated photos in this incident"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>{count} {count === 1 ? 'Photo' : 'Photos'}</span>
                    </button>
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Mic className="h-3.5 w-3.5 text-sky-400" />
                      Voice Note
                    </span>
                  </div>

                  <span className="font-semibold text-zinc-300 group-hover:text-emerald-400 flex items-center gap-0.5">
                    View Details
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}