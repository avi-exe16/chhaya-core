# Chhaya-Core

> Real-time civic incident intelligence platform featuring WhatsApp webhook ingress, asynchronous BullMQ/Redis worker pipelines, PostGIS spatial clustering, and a tamper-evident cryptographic audit ledger.

[![Live Tactical Dashboard](https://img.shields.io/badge/Live%20Demo-chhaya--core.vercel.app-0070F3?style=flat&logo=vercel&logoColor=white)](https://chhaya-core.vercel.app)
[![API Status](https://img.shields.io/badge/Backend%20API-chhaya--core.onrender.com-46E3B7?style=flat&logo=render&logoColor=white)](https://chhaya-core.onrender.com/health)
[![Audit Verification](https://img.shields.io/badge/Audit%20Ledger-Cryptographically%20Verified-brightgreen?style=flat)](https://chhaya-core.onrender.com/api/audit/verify)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL / PostGIS]https://img.shields.io/badge/PostgreSQL-PostGIS-336791?style=flat&logo=postgresql&logoColor=white)](https://postgis.net/)

---

## Overview

Chhaya-Core is an automated distributed system engineered to collect, deduplicate, score, and visualize emergency municipal incidents in real time. It tackles high-volume, unstructured citizen reporting during civic crises by turning disparate messages and photos into actionable, cryptographically auditable geospatial clusters.

### Core Capabilities
* **Webhook Ingress & Deduplication:** Handles WhatsApp report streams via Upstash Redis and BullMQ queues, deduplicating submissions using spatial buffers (`ST_DWithin`) and perceptual image hashing (`pHash`).
* **Spatial Incident Clustering:** Synamically merges nearby reports into coherent incident clusters with calculated Vulnerability Priority Scores (VPS) and Severity-Area Indices (SAI).
* **Verifiable Audit Ledger:** Implements an append-only, tamper-evident hash chain based on the Crosby & Wallach audit accumulator model, providing cryptographic integrity verification over all state changes.
* **Tactical Command Dashboard:** A Next.js 15 interface rendering real-time GeoJSON cluster layers with interactive spatial inspection drawers.

---

## System Architecture

```
  Citizen WhatsApp / Ingress 
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
|                                                      |
|  1. Spatial Matching: PostGIS GiST index queries       |
|  2. Visual Deduplication: Perceptual pHash Hamming dist|
|  3. Cluster Aggregation: Merge or spawn cluster entity |
|  4. Ledger Append: Sequential SHA-256 hash-chaining    |
+--------------------------+-----------------------------+
                           |
             +-------------+-------------+
             |                        |
             v                        v
+-------------------------++-------------------------+
|  PostgreSQL 16+ PostGIS | |      Upstash Redis      |
|  (Spatial & Audit Log)  | |   (BullMQ Task Queues)  |
+------------+-------------++-------------------------+
             |
             v (GeoJSON FeatureCollection Proxy)
+--------------------------------------------------------+
|           Tactical Command Web Console                 |
|      Next.js 15 * MapLibre / GeoJSON * Vercel Edge     |
+--------------------------------------------------------+
```

---

## Cryptographic Audit Model

To prevent tampering with municipal records, every incident receipt, deduplication merge, and priority recalculation is committed as an immutable node in a cryptographic chain:

`entry_hash[n] = SHA256(sequence_num[n] || action || entity_id || metadata || prev_hash[m���t���()Q�����ѥɔ��������ٕ́ɥ���������Ѽ�����٥�������������������()�����͠)��ɰ������輽����儵��ɔ���ɕ���ȹ���������Ց�нٕɥ��)���((���((���Q����Mх��()�����������Q������������͍ɥ�ѥ����)񴴵𴴵𴴵�)���ɽ�ѕ�����9��й�̀�԰�Q���M�ɥ�а�Q���ݥ���ML���Q��ѥ��������U$��������A$��ɽ�她���)�	���������9�����̰���ɕ�̰�Q���M�ɥ�Ё��%����ѥ����م����ѥ��������IMP�A$��)����х��͔���A��ѝɕME0��؀��A���%L���M��ѥ������������ѽɅ������MP�����᥹���)�Q�ͬ�EՕՔ���	ձ�5D���U��х͠�I���́���幍�ɽ���́���������ѥ�����͍�ɥ����)���5��Ʌѥ��́�������������Ʌє�������Ʌѥٔ�͍��������������Ё�)���!��ѥ�����Y�ɍ�����I����ȁ�����ɥ��ѕ�����Ր������嵕�Ё�((���((���1�ٔ�Aɽ�Սѥ�����������()���5�ѡ�����������Ё���͍ɥ�ѥ�����Mх��́�)�𴴵𴴵𴴵𴴵�)�P��������輽����儵��ɔ���ɕ���ȹ��������Ѡ���	�����������Ѡ���������ѥ����ɽ���������=,��)�P��������輽����儵��ɔ�ٕɍ���������������ѕ�́��1�ٔ���)M=8�����ѕȁ�����������=,��)���P��������輽����儵��ɔ���ɕ���ȹ���������Ց�нٕɥ����1����ȁ��͠���������ѕ�ɥ�䁍�����������=,��)�A=MP��������輽����儵��ɔ���ɕ���ȹ����ݕ��������%������Ё��屽��������ѥ�����������ѥٔ��((���((���1�����M�������ᕍ�ѥ��((����ĸ�Aɕɕ�եͥѕ�(��9�����̀������(��A��ѝɕME0�ݥѠ�A���%L���ѕ�ͥ��(��I���͕́�ٕȀ��������ȁU��х͠�((����ȸ�%��х���ѥ��)�����͠)��Ё�����������輽��ѡՈ������٤����ؽ����儵��ɔ����)�������儵��ɔ)���((����̸�	���������]�ɭ�ȁ%��ѥ����ѥ��)�����͠)���͕�٥��̽�������)�������х��)�����ո����Ʌє���)�����ո����)���((����и�Iչ�����%����ѥ���M��ձ�ѥ���)�����͠)�����ո�ͥ�ձ�є)���((����Ը�ɽ�ѕ����͡���ɐ)�����͠)������������̽��͡���ɐ)�������х��)�����ո����)���((���((���1����͔)Q��́�ɽ���Ё�́�����͕��չ��ȁѡ��5%P�1����͔�(