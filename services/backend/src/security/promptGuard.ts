import { z } from 'zod';

export const ModelTriageSchema = z.object({
  category: z.enum([
    'ROAD_HAZARD',
    'WATER_LOGGING',
    'STREETLIGHT_OUTAGE',
    'GARBAGE_DUMP',
    'SEWAGE_OVERFLOW',
    'OTHER',
  ]),
  urgency: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(300),
  isAdversarialOrSpam: z.boolean(),
  extractedEntities: z.object({
    landmark: z.string().nullable().optional(),
    severityDescription: z.string().nullable().optional(),
  }).optional(),
});

export type ModelTriageOutput = z.infer<typeof ModelTriageSchema>;

const ADVERSARIAL_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /act\s+as\s+(an?\s+)?unrestricted/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /jailbreak/i,
  /drop\s+table/i,
  /]/i,
];

export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let cleaned = input.normalize('NFKC');

  // Strip null bytes and non-printable control characters (keep standard newlines and tabs)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return cleaned.trim();
}

export function detectPromptInjection(input: string): { isFlagged: boolean; matchedPattern?: string } {
  const sanitized = sanitizeUserInput(input);

  for (const pattern of ADVERSARIAL_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        isFlagged: true,
        matchedPattern: pattern.source,
      };
    }
  }

  return { isFlagged: false };
}