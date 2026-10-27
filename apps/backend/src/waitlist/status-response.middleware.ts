import type { NextFunction, Request, Response } from 'express';

// Set these before guards and validation, including rejected requests.
export function statusResponseHeaders(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  next();
}
