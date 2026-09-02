// 代理支持：当设置了 HTTP_PROXY / HTTPS_PROXY 环境变量时，
// 让全局 fetch 走代理（本地开发常需；GitHub Actions 直连不受影响）。
// 必须在使用 fetch 之前 import 本模块。
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

const proxy =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;

if (proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
  console.log(`[proxy] 全局 fetch 走代理：${proxy}`);
}
