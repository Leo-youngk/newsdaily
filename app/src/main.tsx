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
