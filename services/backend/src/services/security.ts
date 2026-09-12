import crypto from 'crypto';

export class SecurityService {
  /**
   * Hashes incoming citizen phone numbers with a secure salt.
   * Prevents storing raw PII in database rows or worker queues.
   */
  public static hashPhoneNumber(rawPhone: string): string {
    const salt = process.env.PII_SALT || 'secure_salt_for_anonymizing_phone_hashes_2026';
    return crypto
      .createHmac('sha256', salt)
      .update(rawPhone.trim())
      .digest('hex');
  }

  /**
   * Cryptographically verifies Meta's incoming payload signature.
   */
  public static verifyMetaSignature(rawBodyBuffer: Buffer, signatureHeader: string | undefined): boolean {
    const appSecret = process.env.APP_SECRET;
    if (!signatureHeader || !appSecret) {
      return false;
    }

    const [algorithm, hash] = signatureHeader.split('=');
    if (algorithm !== 'sha256' || !hash) {
      return false;
    }

    const calculatedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBodyBuffer)
      .digest('hex');

    // Constant-time comparison prevents timing attack vulnerabilities
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calculatedHash, 'hex'));
  }
}