'use client';

import { useEffect, useState } from 'react';

interface Incident {
  id: string;
  phone_hash: string;
  media_url: string | null;
  raw_text: string | null;
  hardware_timestamp: string;
  status: string;
  created_at: string;
}

interface ClusterDetail {
  id: string;
  ward_id: string | null;
  asset_category: string;
  incident_count: number;
  vps_score: string | number;
  sai_score: string | number;
  is_shadow_alert: boolean;
  headline: string | null;
  technical_root_cause: string | null;
  sow_memo: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  clusterId: string | null;
  onClose: () => void;
  onStatusUpdated?: (clusterId: string, newStatus: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  triaged: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  dispatched: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export default function InspectionDrawer({ clusterId, onClose, onStatusUpdated }: Props) {
  const [data, setData] = useState<{ cluster: ClusterDetail; incidents: Incident[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clusterId) {
      setData(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/clusters/${clusterId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch cluster details (${res.status})`);
        return res.json();
      })
      .then((json) => {
        if (active) setData(json);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clusterId]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!clusterId || updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/clusters/${clusterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to update status');
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              cluster: { ...prev.cluster, status: newStatus },
              incidents: prev.incidents.map((i) => ({ ...i, status: newStatus })),
            }
          : prev
      );
      if (onStatusUpdated) onStatusUpdated(clusterId, newStatus);
    } catch (err: any) {
      alert(err.message || 'Status transition failed');
    } finally {
      setUpdating(false);
    }
  };

  if (!clusterId) return null;

  return (
    <aside className="fixed top-0 right-0 z-20 h-full w-full max-w-md border-l border-zinc-800 bg-zinc-950/95 p-6 shadow-2xl backdrop-blur-md overflow-y-auto text-zinc-100 font-sans transition-transform">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Cluster Inspection</span>
          </div>
          <h2 className="text-xs font-mono font-bold text-zinc-100 break-all mt-0.5">{clusterId}</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white"
        >
          Close
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center font-mono text-xs text-zinc-500 animate-pulse">
          Hydrating cluster diagnostics...
        </div>
      )}

      {error && (
        <div className="my-4 rounded border border-rose-900/60 bg-rose-950/40 p-3 text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {data && (
        <div className="mt-4 space-y-6 text-xs">
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Current State</span>
            <span
              className={`rounded border px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${
                STATUS_COLORS[data.cluster.status] || 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
            >
              {data.cluster.status}
            </span>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Operator Dispatch Actions</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={updating || data.cluster.status === 'triaged'}
                onClick={() => handleUpdateStatus('triaged')}
                className="rounded border border-sky-800/60 bg-sky-950/40 py-2 text-xs font-medium text-sky-300 hover:bg-sky-900/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Mark Triaged
              </button>
              <button
                disabled={updating || data.cluster.status === 'dispatched'}
                onClick={() => handleUpdateStatus('dispatched')}
                className="rounded border border-indigo-800/60 bg-indigo-950/40 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-900/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Dispatch Unit
              </button>
              <button
                disabled={updating || data.cluster.status === 'resolved'}
                onClick={() => handleUpdateStatus('resolved')}
                className="rounded border border-emerald-800/60 bg-emerald-950/40 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Resolve & Notify
              </button>
              <button
                disabled={updating || data.cluster.status === 'rejected'}
                onClick={() => handleUpdateStatus('rejected')}
                className="rounded border border-rose-800/60 bg-rose-950/40 py-2 text-xs font-medium text-rose-300 hover:bg-rose-900/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reject Report
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
            <div className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">Synthesis Overview</div>
            <div className="text-sm font-semibold text-zinc-100">{data.cluster.headline || 'Unlabeled Incident'}</div>
            <div className="text-zinc-400 leading-relaxed">
              {data.cluster.technical_root_cause || 'Technical root cause assessment in progress.'}
            </div>
            {data.cluster.sow_memo && (
              <div className="mt-2 rounded border border-zinc-800/80 bg-zinc-950/60 p-2 text-[11px] font-mono text-zinc-300">
                <span className="font-semibold text-zinc-200">SOW Memo: </span>
                {data.cluster.sow_memo}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono">
            <div className="rounded border border-zinc-850 bg-zinc-900/40 p-3">
              <div className="text-[10px] text-zinc-400 uppercase">VPS Score</div>
              <div className="text-base font-bold text-emerald-400">{data.cluster.vps_score ?? '0.000'}</div>
            </div>
            <div className="rounded border border-zinc-850 bg-zinc-900/40 p-3">
              <div className="text-[10px] text-zinc-400 uppercase">SAI Score</div>
              <div className="text-base font-bold text-cyan-400">{data.cluster.sai_score ?? '0.000'}</div>
            </div>
            <div className="rounded border border-zinc-850 bg-zinc-900/40 p-3">
              <div className="text-[10px] text-zinc-400 uppercase">Reports</div>
              <div className="text-base font-bold text-amber-400">{data.cluster.incident_count}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <span>Linked Evidence ({data.incidents.length})</span>
              <span className="font-mono text-[10px] text-emerald-500">SHA-256 Verified</span>
            </div>
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {data.incidents.map((inc) => (
                <div key={inc.id} className="rounded border border-zinc-850 bg-zinc-900/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>Hash: {inc.phone_hash.slice(0, 8)}...</span>
                    <span>{new Date(inc.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-zinc-200 text-xs">{inc.raw_text || '<No narrative recorded>'}</p>
                  {inc.media_url && (
                    <div className="mt-2">
                      <a
                        href={inc.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-sky-400 hover:underline font-mono"
                      >
                        <span>Inspect Field Media Evidence</span>
                        <span>↗</span>
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}