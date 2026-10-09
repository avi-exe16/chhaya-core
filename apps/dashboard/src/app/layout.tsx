import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import 'maplibre-gl/dist/maplibre-gl.css';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://chhaya-core.vercel.app'),
  title: 'Chhaya-Core | Tactical Civic Intelligence',
  description: 'Real-time civic incident ingestion, PostGIS spatial clustering, and cryptographic audit platform.',
  openGraph: {
    title: 'Chhaya-Core | Tactical Civic Intelligence',
    description: 'Real-time civic incident ingestion, PostGIS spatial clustering, and cryptographic audit platform.',
    url: 'https://chhaya-core.vercel.app',
    siteName: 'Chhaya-Core',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chhaya-Core | Tactical Civic Intelligence',
    description: 'Real-time civic incident ingestion, PostGIS spatial clustering, and cryptographic audit platform.',
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
