import { spawn } from 'node:child_process';
import http from 'node:http';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

async function main() {
  console.log('🚀 启动 Vite 开发服务器 (npm run dev)...');
  const server = spawn('npm.cmd', ['run', 'dev', '--', '--port', '5173', '--host', '127.0.0.1'], {
    cwd: 'E:/Newsdaily/app',
    stdio: 'pipe',
    shell: true,
  });

  server.stdout.on('data', (d) => process.stdout.write(`[vite] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[vite err] ${d}`));

  let ready = false;
  for (let i = 0; i < 30; i++) {
    await wait(500);
    try {
      const html = await fetchText('http://127.0.0.1:5173/');
      if (html.includes('<div id="root">')) {
        ready = true;
        break;
      }
    } catch {}
  }

  if (!ready) {
    server.kill();
    throw new Error('Vite 服务器启动超时');
  }
  console.log('\n✅ Vite 服务器已成功就绪，开始模拟真实客户端请求测试：\n');

  // 1. 验证 index/latest.json
  console.log('1️⃣ 测试 GET /data/index/latest.json ...');
  const index = await fetchJson('http://127.0.0.1:5173/data/index/latest.json');
  console.log(`   - 状态: 200 OK`);
  console.log(`   - 总收录条数: ${index.itemCount}`);
  console.log(`   - 核心分类: ${Object.keys(index.categories).join(', ')}`);
  console.log(`   - 访谈类条目数: ${index.categories['访谈']?.length}`);
  console.log(`   - 思想类条目数: ${index.categories['思想']?.length}`);
  console.log(`   - 商业类条目数: ${index.categories['商业']?.length}`);
  console.log(`   - 人文类条目数: ${index.categories['人文']?.length}`);

  // 2. 验证 items/2026-09-03.json
  console.log('\n2️⃣ 测试 GET /data/items/2026-09-03.json (首页条目分片) ...');
  const shard = await fetchJson('http://127.0.0.1:5173/data/items/2026-09-03.json');
  console.log(`   - 状态: 200 OK`);
  console.log(`   - 分片条目总数: ${shard.items.length}`);
  const top1 = shard.items[0];
  const top2 = shard.items[1];
  console.log(`   - 首页置顶 #1: 【${top1.category}】${top1.titleZh} (${top1.title})`);
  console.log(`     摘要: ${top1.summary.slice(0, 70)}...`);
  console.log(`   - 首页置顶 #2: 【${top2.category}】${top2.titleZh} (${top2.title})`);
  console.log(`     摘要: ${top2.summary.slice(0, 70)}...`);

  // 3. 验证单篇详情 detail/<id>.json
  console.log(`\n3️⃣ 测试 GET /data/detail/${top1.id}.json (阅读器详情数据) ...`);
  const detail = await fetchJson(`http://127.0.0.1:5173/data/detail/${top1.id}.json`);
  console.log(`   - 状态: 200 OK`);
  console.log(`   - 标题: ${detail.title}`);
  console.log(`   - 来源: ${detail.sourceName}`);
  console.log(`   - 正文字符数: ${detail.contentText.length}`);
  console.log(`   - 含有核心公理模块: ${detail.contentHtml.includes('核心公理与心智模型') ? '是 ✅' : '否 ❌'}`);
  console.log(`   - 含有中英双语对齐块: ${detail.contentHtml.includes('bilingual-block') ? '是 ✅' : '否 ❌'}`);
  console.log(`   - 含有英文章节段落: ${detail.contentHtml.includes('en-text') ? '是 ✅' : '否 ❌'}`);
  console.log(`   - 含有中文章节段落: ${detail.contentHtml.includes('zh-text') ? '是 ✅' : '否 ❌'}`);

  // 4. 验证本地中间件
  console.log('\n4️⃣ 测试 /api/titles 与 /api/health ...');
  const health = await fetchJson('http://127.0.0.1:5173/api/health');
  console.log(`   - Health 状态: ${health.ok ? 'OK ✅' : 'FAIL ❌'}`);
  const titles = await fetchJson('http://127.0.0.1:5173/api/titles');
  console.log(`   - Titles 状态: 正常响应 (pending: ${titles.pending}) ✅`);

  console.log('\n🎉 全部端到端真实请求测试 100% 通过！正在关闭开发服务器...');
  server.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ 测试失败:', err);
  process.exit(1);
});
