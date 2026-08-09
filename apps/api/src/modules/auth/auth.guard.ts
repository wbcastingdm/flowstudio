import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { verifyToken, type SessionPayload } from './token.util';

interface AuthedRequest extends Request {
  session?: SessionPayload;
}

function readToken(req: AuthedRequest): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return undefined;
}

/** مسیرِ محافظت‌شده — بدونِ توکنِ معتبر ۴۰۱ با پیامِ فارسی. */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const session = verifyToken(readToken(req));
    if (!session) {
      throw new UnauthorizedException('برایِ این کار باید وارد شوی.');
    }
    req.session = session;
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<AuthedRequest>();
  return req.session as SessionPayload;
});
