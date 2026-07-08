import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const TEAM_PATH_UUID =
  /^\/teams\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\?|$)/i;

@Injectable()
export class TeamsIdMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const match = req.originalUrl.match(TEAM_PATH_UUID);

    if (match?.[1]) {
      req.params.id = match[1];
    }

    next();
  }
}
