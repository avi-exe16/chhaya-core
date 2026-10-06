import { Request, Response, NextFunction } from 'express';

const MUNICIPAL_API_KEY = process.env.MUNICIPAL_API_KEY || 'chhaya_internal_api_key_2026';

export function requireMunicipalAuth(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (token !== MUNICIPAL_API_KEY) {
    res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    return;
  }

  next();
}