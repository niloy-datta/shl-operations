export function parsePort(value: string | undefined): number {
  const text = value ?? '8081';
  if (!/^[0-9]+$/.test(text)) throw new Error('PORT must be an integer');
  const port = Number(text);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  return port;
}
