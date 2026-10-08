'use client';

import { useState } from 'react';
import { 
  X, Camera, Mic, MapPin, Send, 
  AlertCircle, CheckCircle2, Image as ImageIcon 
} from 'lucide-react';

interface CitizenIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_PRESETS = [
  {
    title: 'Water Main Burst - Dadar West',
    text: 'Severe water main burst flooding the intersection near SV Road. Dirty water pooling up to knee height, traffic blocked.',
    category: 'Water & Drainage',
    lat: 19.0178,
    lng: 72.8478,
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
  },
  {
    title: 'Large Dangerous Pothole - Andheri East',
    text: 'Deep crater pothole opened up after rains outside metro station exit. Two two-wheelers already slipped.',
    category: 'Roadways & Pavements',
    lat: 19.1136,
    lng: 72.8697,
    imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
  },
  {
    title: 'Fallen Tree Obstructing Electrical Cable - Bandra',
    text: 'Large banyan branch collapsed across electric wiring and blocking both road lanes.',
    category: 'Electrical & Obstruction',
    lat: 19.0596,
    lng: 72.8295,
    imageUrl: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=600&auto=format&fit=crop&q=80',
  },
];

export default function CitizenIntakeModal({
  isOpen,
  onClose,
  onSuccess,
}: CitizenIntakeModalProps) {
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Roadways & Pavements');
  const [lat, setLat] = useState('19.0760');
  const [lng, setLng] = useState('72.8777');
  const [imageUrl, setImageUrl] = useState('');
  const [hasVoiceNote, setHasVoiceNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setHeadline(preset.title);
    setDescription(preset.text);
    setCategory(preset.category);
    setLat(preset.lat.toString());
    setLng(preset.lng.toString());
    setImageUrl(preset.imageUrl);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a complaint description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setError('Valid latitude and longitude are required.');
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        source: 'citizen_web_portal',
        sender: '+919876543210',
        headline: headline || 'Citizen Reported Civic Incident',
        text: description,
        category,
        lat: parsedLat,
        lng: parsedLng,
        imageUrl: imageUrl.trim() || undefined,
        hasAudio: hasVoiceNote,
        timestamp: new Date().toISOString(),
      };

      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to submit report (HTTP ${res.status})`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error communicating with incident ingestion pipeline.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden font-sans text-zinc-100"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-950 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Public Citizen Incident Intake</h3>
              <p className="text-xs text-zinc-400">Submit live multi-modal report into the deduplication engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="bg-zinc-950/60 px-6 py-3 border-b border-zinc-800">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
            One-Click Realistic Presets:
          </span>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="rounded-md border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-200 transition"
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-700 bg-rose-950/60 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300">Complaint Title / Headline</label>
            <input
              type="text"
              placeholder="e.g. Major water leak on main carriage way"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300">Description / Citizen Voice Transcript</label>
            <textarea
              rows={3}
              placeholder="Describe the physical hazard, impact on traffic or public safety..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">Asset Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="Roadways & Pavements">Roadways & Pavements</option>
                <option value="Water & Drainage">Water & Drainage</option>
                <option value="Electrical & Obstruction">Electrical & Obstruction</option>
                <option value="Public Sanitation">Public Sanitation</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">Attach Voice Note</label>
              <button
                type="button"
                onClick={() => setHasVoiceNote(!hasVoiceNote)}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  hasVoiceNote 
                    ? 'border-sky-500 bg-sky-950/60 text-sky-300' 
                    : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
              >
                <Mic className="h-4 w-4" />
                {hasVoiceNote ? 'Voice Note Attached' : 'Simulate Audio Note'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">Latitude</label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">Longitude</label>
              <input
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300">Public Photo Evidence (URL)</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/pothole.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {imageUrl && (
            <div className="relative rounded-lg overflow-hidden border border-zinc-700 aspect-video w-full bg-zinc-950 max-h-36">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Incident preview" className="h-full w-full object-cover" />
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-bold text-white transition shadow-md disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Ingesting Telemetry...' : 'Submit Real Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}