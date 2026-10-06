import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const WebhookPayloadSchema = z.object({
  object: z.string().optional(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            messaging_product: z.literal('whatsapp').optional(),
            metadata: z.record(z.string(), z.any()).optional(),
            contacts: z
              .array(
                z.object({
                  profile: z.object({ name: z.string().optional() }).optional(),
                  wa_id: z.string(),
                })
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  from: z.string(),
                  id: z.string(),
                  timestamp: z.string(),
                  type: z.string(),
                  text: z.object({ body: z.string() }).optional(),
                  location: z
                    .object({
                      latitude: z.number(),
                      longitude: z.number(),
                      name: z.string().optional(),
                      address: z.string().optional(),
                    })
                    .optional(),
                  image: z.object({ id: z.string(), mime_type: z.string().optional() }).optional(),
                })
              )
              .optional(),
          }),
          field: z.string(),
        })
      ),
    })
  ).optional(),
});

export type ValidatedWebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export function verifyWhatsAppSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const incomingBuffer = Buffer.from(parts[1], 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (incomingBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
}

export function validateIngressPayload(req: Request, res: Response, next: NextFunction) {
  const result = WebhookPayloadSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid webhook schema',
      errors: result.error.issues,
    });
  }
  req.body = result.data;
  return next();
}