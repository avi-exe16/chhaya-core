# Chhaya-Core

> Real-time civic incident intelligence platform featuring WhatsApp webhook ingress, asynchronous BullMQ/Redis worker pipelines, PostGIS spatial clustering, and a tamper-evident cryptographic audit ledger.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-chhaya--core.vercel.app-0070F3?style=flat&logo=vercel&logoColor=white)](https://chhaya-core.vercel.app)
[![API Status](https://img.shields.io/badge/Backend%20API-chhaya--core.onrender.com-46E3B7?style=flat&logo=render&logoColor=white)](https://chhaya-core.onrender.com/health)
[![Audit Verification](https://img.shields.io/badge/Audit%20Ledger-Cryptographically%20Verified-brightgreen?style=flat)](https://chhaya-core.onrender.com/api/audit/verify)

---

## Overview

Chhaya-Core is an automated distributed system engineered to collect, deduplicate, score, and visualize emergency municipal incidents in real time. It processes high-volume citizen reporting during civic crises by turning disparate messages into actionable, auditable geospatial clusters.

### Core Capabilities
- **Webhook Ingress & Deduplication:** Handles WhatsApp report streams via Upstash Redis and BullMQ queues, deduplicating submissions using spatial buffers (`ST_DWithin`) and perceptual image hashing (`pHash`).
- **Spatial Incident Clustering:** Dynamically merges nearby reports into incident clusters with calculated Vulnerability Priority Scores (VPS) and Severity-Area Indices (SAI).
- **Verifiable Audit Ledger:** Implements an append-only, tamper-evident hash chain based on the Crosby & Wallach audit accumulator model, providing cryptographic integrity verification over all state changes.
- **Tactical Command Dashboard:** A Next.js 15 interface rendering real-time GeoJSON cluster layers with interactive spatial inspection drawers.

---

## System Architecture

```
[ Citizen WhatsApp / Ingress ]
              |
              v (Signed Webhook Payload)
+--------------------------------------------------------+
|               Ingress API (Express / Node.js)          |
|       - Redis-backed rate limiting & idempotency       |
|       - Payload validation (Zod)                       |
+--------------------------+-----------------------------+
                           | BullMQ Enqueue
                           v
+--------------------------------------------------------+
|            Distributed Worker Pipeline                 |
|                                                        |
|  1. Spatial Matching: PostGIS GiST index queries       |
|  2. Visual Deduplication: Perceptual pHash Hamming dist|
|  3. Cluster Aggregation: Merge or spawn cluster entity |
|  4. Ledger Append: Sequential SHA-256 hash-chaining    |
+--------------------------+-----------------------------+
                           |
             +-------------+-------------+
             |                           |
             v                           v
+-------------------------+ +-------------------------+
|  PostgreSQL 16+ PostGIS | |      Upstash Redis      |
|  (Spatial & Audit Log)  | |   (BullMQ Task Queues)  |
+------------+------------+ +-------------------------+
             |
             v (GeoJSON FeatureCollection Proxy)
+--------------------------------------------------------+
|           Tactical Command Web Console                 |
|      Next.js 15 * MapLibre / GeoJSON * Vercel Edge     |
+--------------------------------------------------------+
```

---

## Cryptographic Audit Model

Every incident receipt, deduplication merge, and priority recalculation is committed as an immutable node in a cryptographic chain:

`entry_hash[n] = SHA256(sequence_num[n] || action || entity_id || metadata || prev_hash[n-1])`

Verify the chain via the live endpoint:

```bash
curl [https://chhaya-core.onrender.com/api/audit/verify](https://chhaya-core.onrender.com/api/audit/verify)
```

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS, MapLibre GL |
| **Backend** | Node.js, Express, TypeScript, Zod |
| **Data Layer** | PostgreSQL 16, PostGIS, GiST Indexing |
| **Queue** | BullMQ, Upstash Redis |
| **Deployment** | Vercel (Dashboard), Render (Worker Services) |

---

## Live Endpoints

- **Frontend App:** [https://chhaya-core.vercel.app](https://chhaya-core.vercel.app)
- **Cluster GeoJSON API:** [https://chhaya-core.vercel.app/api/clusters](https://chhaya-core.vercel.app/api/clusters)
- **Cryptographic Audit Check:** [https://chhaya-core.onrender.com/api/audit/verify](https://chhaya-core.onrender.com/api/audit/verify)
- **Backend Health Check:** [https://chhaya-core.onrender.com/health](https://chhaya-core.onrender.com/health)

---

## License

MIT License