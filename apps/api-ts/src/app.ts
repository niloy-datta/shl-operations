import { randomUUID } from 'node:crypto';
import { Catch, ArgumentsHost, ExceptionFilter, HttpException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
@Catch()
class SafeErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<{ status(code: number): { send(value: unknown): void } }>();
    const request = context.getRequest<{ id: string }>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    response.status(status).send({ statusCode: status, error: status === 404 ? 'Not Found' : status >= 500 ? 'Internal Server Error' : 'Request failed', requestId: request.id });
  }
}
export async function createApp(logging = true): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({ logger: logging, genReqId: () => randomUUID(), disableRequestLogging: true });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { logger: logging ? ['error', 'warn', 'log'] : false });
  adapter.getInstance().addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id).header('cache-control', 'no-store');
    return payload;
  });
  adapter.getInstance().addHook('onResponse', async (request, reply) => {
    request.log.info({ requestId: request.id, method: request.method, statusCode: reply.statusCode }, 'request completed');
  });
  app.useGlobalFilters(new SafeErrorFilter());
  const options = new DocumentBuilder().setTitle('SHL NEXUS sidecar').setVersion('0.1.0').addBearerAuth().build();
  SwaggerModule.setup('openapi', app, SwaggerModule.createDocument(app, options));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
