import { Response, NextFunction } from 'express';
import crypto from 'crypto';

const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

export function verifyMetaSignature(req: any, res: Response, next: NextFunction): void {
  // Test suite and unconfigured local environments bypass cleanly
  if (process.env.NODE_ENV === 'test' || !APP_SECRET) {
    next();
    return;
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
    return;
  }

  const [algo, hash] = signature.split('=');
  if (algo !== 'sha256' || !hash) {
    res.status(401).json({ error: 'Malformed signature header' });
    return;
  }

  const expectedHash = crypto
    .createHmac('sha256', APP_SECRET)
    .update(req.rawBody || '')
    .digest('hex');

  const sourceBuffer = Buffer.from(hash, 'hex');
  const targetBuffer = Buffer.from(expectedHash, 'hex');

  if (
    sourceBuffer.length !== targetBuffer.length ||
    !crypto.timingSafeEqual(sourceBuffer, targetBuffer)
  ) {
    res.status(403).json({ error: 'Invalid HMAC signature. Rejecting untrusted source.' });
    return;
  }

  next();
}