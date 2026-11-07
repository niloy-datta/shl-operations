import 'reflect-metadata';
import { parsePort } from '@shl/config';
import { createApp } from './app';
async function main(): Promise<void> {
  const port = parsePort(process.env.PORT);
  const app = await createApp();
  await app.listen(port, '0.0.0.0');
}
main().catch(() => { console.error('Failed to start sidecar'); process.exitCode = 1; });
