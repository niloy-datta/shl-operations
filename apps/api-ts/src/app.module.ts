import { Controller, Get, Module } from '@nestjs/common';
import type { ProcessHealth } from '@shl/api-contracts';
import { IdentityController } from './identity/identity.controller';
import { IdentityGateway } from './identity/identity.gateway';
@Controller('health')
export class HealthController {
  @Get('live') live(): ProcessHealth { return { status: 'ok', scope: 'process' }; }
  @Get('ready') ready(): ProcessHealth { return { status: 'ok', scope: 'process' }; }
}
@Module({ controllers: [HealthController, IdentityController], providers: [IdentityGateway] })
export class AppModule {}
