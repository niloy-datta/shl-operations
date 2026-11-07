import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

export interface CurrentUser { username: string; role: string; }

/** Delegates every check to the legacy API. No token or authorization result is cached. */
@Injectable()
export class IdentityGateway {
  async currentUser(authorization: string | undefined): Promise<CurrentUser> {
    if (!authorization || !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization)) throw new UnauthorizedException();
    let upstream: Response;
    try {
      upstream = await fetch('http://api:8080/api/me', {
        method: 'GET', headers: { authorization }, redirect: 'error', signal: AbortSignal.timeout(3000),
      });
    } catch {
      throw new ServiceUnavailableException();
    }
    if (upstream.status === 401) throw new UnauthorizedException();
    if (upstream.status === 403) throw new ForbiddenException();
    if (upstream.status !== 200) throw new ServiceUnavailableException();
    let payload: unknown;
    try { payload = await upstream.json(); } catch { throw new ServiceUnavailableException(); }
    if (typeof payload !== 'object' || payload === null || !('username' in payload) || !('role' in payload)
        || typeof payload.username !== 'string' || typeof payload.role !== 'string') throw new ServiceUnavailableException();
    return { username: payload.username, role: payload.role };
  }
}
