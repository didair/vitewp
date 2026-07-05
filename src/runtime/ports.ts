import net from 'node:net';

export async function assertPortAvailable(host: string, port: number, label: string) {
  const available = await isPortAvailable(host, port);

  if (!available) {
    throw new Error(`${label} port ${host}:${port} is already in use.`);
  }
}

export async function resolveInternalPort(host: string, port: number) {
  if (port > 0) {
    const available = await isPortAvailable(host, port);
    if (available) {
      return port;
    }
  }

  return findAvailablePort(host);
}

function findAvailablePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });

    server.listen(0, host);
  });
}

export function isPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}
