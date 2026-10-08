import crypto from 'crypto';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4000';

interface IncidentReportPayload {
  name: string;
  lat: number;
  lng: number;
  phash?: string;
  phone: string;
  text?: string;
}

// Realistic civic reports across Mumbai
const SCENARIOS: IncidentReportPayload[] = [
  // Cluster A: Water Main Burst in Dharavi Sector 5 (3 reports within 60 meters)
  {
    name: 'Dharavi Main Burst #1',
    lat: 19.0435,
    lng: 72.8562,
    phash: 'a1b2c3d4e5f60001',
    phone: '+919820011111',
    text: 'Severe water logging from broken municipal line.',
  },
  {
    name: 'Dharavi Main Burst #2 (Near identical photo)',
    lat: 19.0438,
    lng: 72.8565,
    phash: 'a1b2c3d4e5f60002', // 1-bit Hamming distance delta
    phone: '+919820022222',
    text: 'Water gushing onto main road.',
  },
  {
    name: 'Dharavi Main Burst #3 (Adjacent observer)',
    lat: 19.0436,
    lng: 72.8569,
    phash: 'a1b2c3d4e5f60003',
    phone: '+919820033333',
    text: 'Traffic halted due to street flooding.',
  },

  // Cluster B: High-Voltage Exposed Wire in Bandra West (Isolated cluster)
  {
    name: 'Bandra Electrical Hazard',
    lat: 19.0596,
    lng: 72.8295,
    phash: 'ff00ff00aa550001',
    phone: '+919820044444',
    text: 'Sparking wire hanging low over sidewalk near bus stand.',
  },

  // Cluster C: Massive Pothole / Road Collapse in Andheri East
  {
    name: 'Andheri Road Crater',
    lat: 19.1136,
    lng: 72.8697,
    phash: '778899aabbcc0001',
    phone: '+919820055555',
    text: 'Deep crater on western express highway service road.',
  },
];

function buildWhatsAppWebhookPayload(item: IncidentReportPayload) {
  const msgId = `sim_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: msgId,
                  from: item.phone.replace('+', ''),
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                  type: 'location',
                  location: {
                    latitude: item.lat,
                    longitude: item.lng,
                    name: item.name,
                  },
                  text: item.text ? { body: item.text } : undefined,
                  image: item.phash ? { phash: item.phash } : undefined,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function runSimulation() {
  console.log(`[Simulator] Starting citizen report ingestion against ${BACKEND_URL}/webhook ...\n`);

  for (let i = 0; i < SCENARIOS.length; i++) {
    const scenario = SCENARIOS[i];
    const payload = buildWhatsAppWebhookPayload(scenario);

    try {
      const response = await fetch(`${BACKEND_URL}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log(
        `[${i + 1}/${SCENARIOS.length}] Sent: "${scenario.name}" -> HTTP ${response.status} (${responseText})`
      );
    } catch (err: any) {
      console.error(`[${i + 1}/${SCENARIOS.length}] Failed to send "${scenario.name}": ${err.message}`);
    }

    // Realistic delay between citizen reports
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  console.log('\n[Simulator] Ingestion burst complete.');
  console.log('[Simulator] Inspect the backend terminal to observe spatial worker deduplication and scoring.');
  console.log('[Simulator] Check http://localhost:3001 to view clusters updating live on the tactical console.');
}

runSimulation();