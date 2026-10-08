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
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.google.com https://*.googleapis.com https://*.gstatic.com https://*.arcgisonline.com https://server.arcgisonline.com https://*.tile.openstreetmap.org",
      "connect-src 'self' blob: data: http://localhost:3000 http://localhost:3001 http://localhost:3002 http://127.0.0.1:4000 http://127.0.0.1:3001 ws: wss: https://*.google.com https://*.googleapis.com https://*.arcgisonline.com https://server.arcgisonline.com https://*.tile.openstreetmap.org",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: isDev ? ['172.25.231.232', '172.25.230.147', 'localhost:3000', 'localhost:3001', 'localhost:3002'] : [],
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