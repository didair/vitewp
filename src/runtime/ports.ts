import net from 'node:net';

export async function assertPortAvailable(host: string, port: number, label: string) {
  const available = await isPortAvailable(host, port);

  if (!available) {
    throw new Error(`${label} port ${host}:${port} is already in use.`);
  }
}

function isPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}
