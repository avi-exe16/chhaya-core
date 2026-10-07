import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Required for MapLibre GL WebGL runtime compilation
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://a.basemaps.cartocdn.com https://b.basemaps.cartocdn.com",
      "connect-src 'self' http://localhost:3000 http://localhost:3001 ws: wss: https://a.basemaps.cartocdn.com https://b.basemaps.cartocdn.com",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: isDev ? ['172.25.231.232', 'localhost:3000'] : [],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;