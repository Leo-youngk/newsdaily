import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 给 sw.js 注入构建版本号。
 * 原来 VERSION 写死成 'news-pwa-v1'，部署新版本后 activate 里的清理逻辑
 * 认不出旧缓存，旧的 hash 资源会永远堆在那儿。
 */
function swVersion(): Plugin {
  const version = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return {
    name: 'sw-version',
    closeBundle() {
      const p = resolve(__dirname, 'dist/sw.js');
      try {
        writeFileSync(p, readFileSync(p, 'utf8').replace(/__SW_VERSION__/g, version));
        console.log(`[sw-version] 注入版本 ${version}`);
      } catch (e) {
        this.warn(`sw.js 版本注入失败：${e}`);
      }
    },
  };
}

/**
 * 开发期把 /api/config 指到 ETL 的本地产物，这样 `npm run dev` 不依赖线上 Worker
 * 就能完整跑通设置页。读的是真实产物，不是假数据。
 */
function localConfigApi(): Plugin {
  const file = resolve(__dirname, '../etl/out/config/sources.json');
  return {
    name: 'local-config-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/config', (req, res, next) => {
        if (req.method !== 'GET' || !existsSync(file)) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(readFileSync(file));
      });
    },
  };
}

// 前端部署到 Cloudflare Pages，通过 VITE_API_BASE 指向 Worker
export default defineConfig({
  plugins: [react(), swVersion(), localConfigApi()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
  server: {
    port: 5173,
  },
});
