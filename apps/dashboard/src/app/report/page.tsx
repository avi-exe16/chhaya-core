'use client';

import React, { useState, useEffect } from 'react';

export default function CitizenReportPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('Requesting GPS lock...');
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
          setAddress('📍 GPS Locked: ' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4));
        },
        (err) => {
          setAddress('⚠️ GPS denied. Please enable location permissions.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const compressImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1000;
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        setImagePreview(dataUrl);
        setCompressedBase64(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) compressImage(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) {
      alert('Please allow GPS location access to register incident location.');
      return;
    }
    if (!compressedBase64) {
      alert('Please capture a live photo before submitting.');
      return;
    }

    setIsSubmitting(true);
    setStatus('⏳ Uploading verified report...');

    try {
      const res = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          description: textDescription || 'Civic hazard reported via live camera.',
          image: compressedBase64,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('✅ Successfully Registered! Incident ID: ' + data.clusterId + (data.merged ? ' (Merged into existing cluster)' : ''));
        setTextDescription('');
      } else {
        setStatus('❌ Server error: ' + (data.error || 'Failed to submit.'));
      }
    } catch (err: any) {
      setStatus('❌ Network error: ' + (err.message || 'Check your connection.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
        <h1 className="text-xl font-bold text-sky-400 mb-1">Civic Grievance Ingress</h1>
        <p className="text-xs text-slate-300 font-mono mb-4">{address}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Live Photo Proof (Live Camera Only)
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-sky-500/50 rounded-lg p-4 cursor-pointer hover:bg-slate-700/50 transition">
              <span className="text-sm font-medium text-sky-300">
                {imagePreview ? '📷 Retake Photo' : '📷 Tap to Open Camera'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCapture}
                required
              />
            </label>
            {imagePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="Live Preview" className="mt-2 rounded-lg h-44 w-full object-cover border border-slate-700" />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Issue Description
            </label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-sky-500 text-white"
              rows={3}
              placeholder="Describe the issue..."
              value={textDescription}
              onChange={(e) => setTextDescription(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>

        {status && (
          <div className="mt-4 p-3 bg-slate-950 border border-slate-700 rounded-lg text-center text-xs font-mono text-sky-300">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
