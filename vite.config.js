import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import apiExtract from './vite-plugin-api-extract.js'

export default defineConfig({
  base: '/braves-tracker/',
  plugins: [
    react(),
    apiExtract({
      tracker: 'braves',
      team: { name: 'Atlanta Braves', abbreviation: 'ATL' },
      league: 'MLB',
      sources: [
        { from: './src/playerData.js', exportName: 'PLAYERS',             resource: 'roster' },
        { from: './src/playerData.js', exportName: 'NEWS_DIGEST',         resource: 'news-digest' },
        { from: './src/playerData.js', exportName: 'RESULTS',             resource: 'results' },
        { from: './src/playerData.js', exportName: 'NEXT_GAME',           resource: 'next-game' },
        { from: './src/playerData.js', exportName: 'UPCOMING_SCHEDULE',   resource: 'upcoming-schedule' },
        { from: './src/playerData.js', exportName: 'NL_EAST_STANDINGS',   resource: 'standings' },
      ],
    }),
    {
      name: 'rss-proxy',
      configureServer(server) {
        server.middlewares.use('/api/rss', async (req, res) => {
          const url = new URL(req.url, 'http://localhost').searchParams.get('url');
          if (!url) {
            res.statusCode = 400;
            res.end('Missing url param');
            return;
          }
          try {
            const resp = await fetch(url, {
              headers: { 'User-Agent': 'Mozilla/5.0 BravesTracker/1.0' },
            });
            const text = await resp.text();
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.end(text);
          } catch (e) {
            res.statusCode = 502;
            res.end('Feed fetch failed: ' + e.message);
          }
        });
      },
    },
  ],
  server: {
    port: 3003,
    open: true,
  },
})
