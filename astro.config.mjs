import { defineConfig } from 'astro/config';
import vitewp from './src/astro.ts';

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
