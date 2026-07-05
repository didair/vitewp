import { defineConfig } from 'astro/config';
import vitewp from 'vitewp/astro';

export default defineConfig({
  output: 'server',
  integrations: [vitewp()],
  vite: {
    server: {
      ws: {
        protocol: 'ws',
        host: 'localhost',
        clientPort: 3000,
      },
    },
  },
});
