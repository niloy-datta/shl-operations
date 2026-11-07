import { Controller, Get, Headers, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IdentityGateway, type CurrentUser } from './identity.gateway';

@Controller('api')
export class IdentityController {
  constructor(@Inject(IdentityGateway) private readonly identity: IdentityGateway) {}
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve the current user through the legacy session authority' })
  @ApiResponse({ status: 200, description: 'Current username and role' })
  @ApiResponse({ status: 401, description: 'Missing, invalid or revoked session' })
  @ApiResponse({ status: 403, description: 'MFA enrollment is required' })
  @ApiResponse({ status: 503, description: 'Legacy API unavailable or invalid response' })
  current(@Headers('authorization') authorization?: string): Promise<CurrentUser> {
    return this.identity.currentUser(authorization);
  }
}
