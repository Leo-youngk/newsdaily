import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyTheme, prefs } from './lib/prefs';
import './index.css';

// 应用启动即恢复主题
applyTheme(prefs.getTheme());
// 跟随系统主题变化
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    if (prefs.getTheme() === 'system') applyTheme('system');
  });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Service Worker：发现新版本时提示，而不是让新 SW 直接抢占正在运行的页面。
// 只在生产注册 —— SW 对同源资源是 cache-first，开发时会缓存旧模块把 HMR 彻底废掉。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        const notify = (worker: ServiceWorker) => {
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(
                new CustomEvent('sw-update', { detail: () => worker.postMessage('skip-waiting') }),
              );
            }
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) {
          const w = reg.waiting;
          window.dispatchEvent(
            new CustomEvent('sw-update', { detail: () => w.postMessage('skip-waiting') }),
          );
        }
        reg.addEventListener('updatefound', () => {
          if (reg.installing) notify(reg.installing);
        });
      })
      .catch(() => {});

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
