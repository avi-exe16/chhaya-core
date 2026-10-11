'use client';

import React, { useState, useEffect } from 'react';

export default function CitizenReportPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('Fetching GPS location...');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [textDescription, setTextDescription] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setAddress('GPS Locked: ' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4));
        },
        () => setAddress('Please enable GPS location to submit.'),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords || !imageBase64) {
      alert('Live camera capture and location are required.');
      return;
    }
    setIsSubmitting(true);
    setStatus('Verifying evidence and clustering...');
    try {
      const res = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          description: textDescription || 'Civic hazard reported via live camera.',
          image: imageBase64,
          source: 'MOBILE_PWA_CITIZEN',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('Complaint Registered! Ticket ID: #' + (data.clusterId || 'PENDING'));
      } else {
        setStatus('Submission error. Please retry.');
      }
    } catch {
      setStatus('Network error. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
        <h1 className="text-xl font-bold text-sky-400 mb-1">Civic Grievance Ingress</h1>
        <p className="text-xs text-slate-400 mb-4">{address}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Live Photo Proof (Gallery Disabled)
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-sky-500/50 rounded-lg p-4 cursor-pointer hover:bg-slate-700/50 transition">
              <span className="text-sm font-medium text-sky-300">
                {imagePreview ? 'Retake Live Photo' : 'Open Camera to Click Photo'}
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
              <img src={imagePreview} alt="Live Capture" className="mt-2 rounded-lg h-44 w-full object-cover" />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Problem Description (Optional)
            </label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-sky-500"
              rows={3}
              placeholder="E.g., Deep pothole / broken drainage outside market gate..."
              value={textDescription}
              onChange={(e) => setTextDescription(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Verified Report'}
          </button>
        </form>
        {status && (
          <div className="mt-4 p-3 bg-slate-900 border border-sky-500/30 rounded-lg text-center text-xs text-sky-300 font-mono">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
