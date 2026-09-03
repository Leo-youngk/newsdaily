// 隔离测试：清理使用存储桩，网络超时使用本机 HTTP 服务。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import http from 'node:http';
import ts from 'typescript';
import { cleanContentHtml } from '../src/html.js';
import { fetchText } from '../src/fetch.js';
import { previewCount } from '../../app/src/lib/filter.js';
import { applyKeywords } from '../src/filter.js';

test('保留分片读取失败时完全禁止删除', async () => {
  const source=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('async function cleanup('),source.indexOf('async function main('));
  const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const deleted: string[]=[];
  const ctx=vm.createContext({config:{dryRun:false,imgBase:'/data/'},console,store:{
    readItems:async (_date: string, required: boolean)=>{assert.equal(required,true);throw new Error('TEST unavailable');},
    listKeys:async()=>['detail/keep.json'],deleteKey:async(key: string)=>deleted.push(key),
  }});
  vm.runInContext(js,ctx);
  await assert.rejects(ctx.cleanup(['2026-09-03'],0),/TEST unavailable/);
  assert.equal(deleted.length,0);
});

test('保留代码空白并移除编码后的 javascript URL', () => {
  const code='if (ok) {\n  call();\n}';
  assert.ok(cleanContentHtml(`<pre><code>${code}</code></pre>`,'https://test.local').html.includes(code));
  const html=cleanContentHtml('<p><a href="java&#10;script:alert(1)">test</a></p>','https://test.local').html;
  assert.doesNotMatch(html,/href=/);
});

test('关键词 @N 预览与采集一致', () => {
  const items=Array.from({length:5},(_,i)=>({id:String(i),title:'test',summary:''})) as any;
  assert.equal(previewCount(items,['@2']),applyKeywords(items,['@2']).length);
  assert.equal(previewCount(items,['@2']),2);
});

test('收到响应头后，慢响应体仍会超时', async () => {
  const server=http.createServer((_req,res)=>{res.writeHead(200);res.flushHeaders();setTimeout(()=>res.end('slow test'),250);});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const address=server.address() as {port:number};
    await assert.rejects(fetchText(`http://127.0.0.1:${address.port}`,{timeout:40,retries:0}),/abort|timeout/i);
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('SW 写缓存失败仍返回 200，API 请求不缓存，刷新走网络', async () => {
  const listeners: Record<string,Function>={};
  const logs={warn(){},error(){}};
  const ctx=vm.createContext({self:{location:{origin:'https://test.local'},addEventListener:(kind: string,fn:Function)=>{listeners[kind]=fn;}},
    caches:{open:async()=>({match:async()=>undefined,put:async()=>{throw new Error('TEST quota');}})},
    fetch:async()=>new Response('live',{status:200}),Response,URL,console:logs});
  vm.runInContext(readFileSync(new URL('../../app/public/sw.js',import.meta.url),'utf8'),ctx);
  const req=new Request('https://test.local/data/img/a.webp');
  assert.equal((await ctx.cacheFirst(req,'test',3)).status,200);
  assert.equal((await ctx.networkFirst({},req,'test')).status,200);
  let intercepted=false;
  listeners.fetch({request:new Request('https://test.local/api/ai/jobs/test'),respondWith(){intercepted=true;}});
  assert.equal(intercepted,false);
  let reply: Promise<Response>|undefined;
  listeners.fetch({request:new Request('https://test.local/data/index/latest.json',{cache:'no-cache'}),respondWith(p:Promise<Response>){reply=p;}});
  assert.equal(await (await reply!).text(),'live');
});
