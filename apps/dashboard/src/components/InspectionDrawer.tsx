'use client';
import { useEffect, useState } from 'react';
interface Incident { id: string; phone_hash: string; media_url: string | null; raw_text: string | null; hardware_timestamp: string; status: string; created_at: string; }
interface ClusterDetail { id: string; ward_id: string | null; asset_category: string; incident_count: number; vps_score: string | number; sai_score: string | nulmber; is_shadow_alert: boolean; headline: string | null; technical_root_cause: string | null; sow_memo: string | numll; status: string; created_at: string; updated_at: string; }
interface Props { clusterId: string | null; onClose: () => void; }
export default function InspectionDrawer({ clusterId, onClose }: Props) {
  const [data, setData] = useState<{ cluster: ClusterDetail; incidents: Incident[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!clusterId) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetch('/api/clusters/' + clusterId)
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        return res.json();
      })
      .then((j) => { if (active) setData(j); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clusterId]);
  if (!clusterId) return null;
  return (
    <aside className="fixed top-0 right-0 z-20 h-full w-full max-w-md border-l border-zinc-800 bg-zinc-95/95 p-6 shadow-2xl backdrop-blur-md overflow-y-auto text-zinc-100 font-sans">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Cluster Inspection</span>
          </div>
          <h2 className="text-xs font-mono font-bold text-zinc-100 break-all mt-0.5">{clusterId}</h2>
        </div>
        <button onClick={onClose} className="rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white">Close</button>
      </div>
      {loading && <div className="py-12 text-center font-mono text-xs text-zinc-500 animate-pulse">Hydrating cluster diagnostics...</div>}
      {error && <div className="my-4 rounded border border-rose-900/60 bg-rose-950/40 p-3 text-xs text-rose-300 font-mono">{error}</div>}
      {data && (
        <div className="mt-4 space-y-6 text-xs">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
            <div className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">Synthesis Overview</div>
            <div className="text-sm font-semibold text-zinc-100">{data.cluster.headline || "Unlabeled Incident"}</div>
            <div className="text-zinc-400 leading-relaxed">{data.cluster.technical_root_cause || "Technical assessment pending."}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 font-mono">
            <div className="rounded border border-zinc-850 bg-zinc-900/40 p-3">
              <div className="text-[10px] text-zinc-400 uppercase">VPS Score</div>
              <div className="text-base font-bold text-emerald-400">{data.cluster.vps_score ?? "0.000"}</div>
            </div>
            <div className="rounded border border-zinc-850 bg-zinc-900/40 p-3">
              <div className="text-[10px] text-zinc-400 uppercase">SAI Score</div>
              <div className="text-base font-bold text-cyan-400">{data.cluster.sai_score ?? "0.000"}</div>
            </div>
            <div className="rounded-border border-zinc-850 bg-zinc-900/40 p-3">
              <div className="text-[10px] text-zinc-400 uppercase">Reports</div>
              <div className="text-base font-bold text-amber-400">{data.cluster.incident_count}</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <span>Linked Evidence ({data.incidents.length})</span>
              <span className="font-mono text-[10px] text-emerald-500">SHA-256 Verified</span>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {data.incidents.map((ins) => (
                <div key={ins.id} className="rounded border border-zinc-850 bg-zinc-900/30 p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>Hash: {ins.phone_hash.slice(0, 8)}...</span>
                    <span>{new Date(ins.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-zinc-200 text-xs">{ins.raw_text || '<No text payload>'  }</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
