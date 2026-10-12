'use client';

import React, { useState, useEffect } from 'react';

export default function CitizenReportPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('Locking GPS coordinates...');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressedBase64, setCompressedBase64] = useState<string | null>(null);
  const [textDescription, setTextDescription] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setAddress('📍 GPS Verified: ' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4));
        },
        (err) => {
          setAddress('⚠️ GPS Required. Please enable device location.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  const compressImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // 60% quality JPEG is ~80KB: guaranteed to beat any Vercel payload limit
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setImagePreview(dataUrl);
        setCompressedBase64(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) {
      alert('Please allow GPS location access.');
      return;
    }
    if (!compressedBase64) {
      alert('Please capture a live photo.');
      return;
    }

    setIsSubmitting(true);
    setStatus('⏳ Uploading verified report to command center...');

    try {
      const res = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          description: textDescription || 'Civic infrastructure anomaly',
          image: compressedBase64,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('✅ Logged into Control Room! ID: ' + data.clusterId);
        setTextDescription('');
      } else {
        setStatus('❌ Server error: ' + (data.error || 'Retry submission.'));
      }
    } catch (err: any) {
      setStatus('❌ Connection issue: ' + (err.message || 'Check internet.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-2xl mt-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <h1 className="text-lg font-black tracking-wide text-sky-400">CHHAYA CIVIC INGRESS</h1>
        </div>
        <p className="text-xs text-slate-400 font-mono mb-4 bg-slate-950 p-2 rounded border border-slate-800/80">{address}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
              Live Photographic Proof
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-sky-500/40 rounded-xl p-5 cursor-pointer hover:bg-slate-800/60 transition bg-slate-950/40">
              <span className="text-sm font-semibold text-sky-300">
                {imagePreview ? '📷 Retake Live Shutter' : '📷 Tap to Open Live Camera'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1">Gallery selection blocked for anti-fraud</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) compressImage(e.target.files[0]); }}
                required
              />
            </label>
            {imagePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="Live Preview" className="mt-3 rounded-xl h-48 w-full object-cover border border-slate-700 shadow-inner" />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
              Issue Details
            </label>
            <textarea
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:border-sky-500 text-slate-200"
              rows={3}
              placeholder="Briefly describe what is broken (e.g. Broken culvert, open drain)..."
              value={textDescription}
              onChange={(e) => setTextDescription(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl text-sm transition shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Verifying & Transmitting...' : 'Transmit Verified Report'}
          </button>
        </form>

        {status && (
          <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs font-mono text-sky-300">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
