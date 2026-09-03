"""隔离浏览器回归：全部 API 数据是明确的测试夹具，无真实 AI 请求。
先启动 app 的 Vite，然后 python app/tests/regression.py。
"""
import json, pathlib, time, os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'app/out/regression'
OUT.mkdir(parents=True, exist_ok=True)
now = int(time.time()*1000)
item = dict(id='test-a', sourceId='test', sourceName='测试源', category='AI', lang='en', title='Test article A',
    summary='仅用于测试', url='https://example.test/a', publishedAt=now, contentLen=10000, contentSource='feed', readingMinutes=10, tags=[])
item2 = {**item, 'id':'test-b', 'category':'商业', 'title':'Test article B'}
html = '<h2>Heading</h2><p>Paragraph one</p><figure><img alt="test" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="></figure><p>Paragraph two</p><blockquote><p>Nested quote</p></blockquote><pre><code>if (ok) {\n  call();\n}</code></pre>'
cfg = json.loads((ROOT/'etl/sources.seed.json').read_text(encoding='utf-8'))
checks = []

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    def setup(content=html, favorites=None, snapshot=None, fail_shards=False, feed=None, partial=False, dates=None):
        ctx = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2,service_workers='block')
        state = {'runs':0,'creates':0,'job':None,'fail':fail_shards,'feed':feed or [item,item2],'details':0,'errors':[],'dates':dates or ['2026-09-03']}
        if favorites is not None: ctx.add_init_script('localStorage.setItem("np-favorites",'+json.dumps(json.dumps(favorites))+')')
        if snapshot is not None: ctx.add_init_script('localStorage.setItem("np-snapshot",'+json.dumps(json.dumps(snapshot))+')')
        def route(r):
            path = urlparse(r.request.url).path
            assert 'x-admin-token' not in r.request.headers
            status = 200
            if path == '/data/index/latest.json': value={'dates':state['dates'],'all':['test-a','test-b'],'itemCount':2,'generatedAt':now,'categories':{'AI':['test-a'],'商业':['test-b']}}
            elif path.startswith('/data/items/'):
                status=503 if state['fail'] else 200
                selected = state['feed'] if path.endswith('2026-09-03.json') else [{**item,'title':'Stale article A'}]
                value={'items':selected} if status == 200 else {'error':'TEST outage'}
            elif path.startswith('/data/detail/'):
                state['details'] += 1
                value={**item,'contentHtml':content,'contentText':'Paragraph one Paragraph two Nested quote'}
            elif path == '/api/config':
                value=cfg
                if r.request.method == 'PUT':
                    assert r.request.headers.get('if-match') == '"test"'
                    state['saved_config']=r.request.post_data_json
                    value={'ok':True}
            elif path == '/api/ai/jobs':
                state['creates'] += 1
                inputs=r.request.post_data_json['paragraphs']; state['inputs']=inputs
                if state['job'] is None: state['job']={'id':'a'*64,'state':'pending','completed':0,'total':len(inputs),'results':{},'warnings':[],'nextAttempt':0,'retrying':0}
                value=state['job']
            elif path.startswith('/api/ai/jobs/'):
                if path.endswith('/run'):
                    state['runs'] += 1
                    inputs=state['inputs'][:1] if partial and state['runs']==1 else state['inputs']
                    for unit in inputs: state['job']['results'][unit['key']]={'key':unit['key'],'text':'译文：'+unit['text'],'model':'test-engine'}
                    state['job']['completed']=len(state['job']['results'])
                    done=state['job']['completed']==state['job']['total']
                    state['job'].update(state='complete' if done else 'pending', nextAttempt=0, retrying=0 if done else 1)
                value=state['job']
            else: status=404; value={'error':'TEST route missing'}
            r.fulfill(status=status,json=value,headers={'Access-Control-Allow-Origin':'*','ETag':'"test"','Access-Control-Expose-Headers':'ETag'})
        ctx.route('https://news-pwa-worker.if5v.workers.dev/**',route)
        page=ctx.new_page(); page.on('pageerror', lambda err: state['errors'].append(str(err)))
        page.goto(os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:5173/')); page.wait_for_load_state('networkidle')
        return ctx,page,state
    def open_article(page, title='Test article A'):
        page.get_by_role('link').filter(has=page.get_by_text(title,exact=True)).click()
        page.locator('.prose-news').wait_for()
        expect(page.get_by_role('button', name='仅中文', exact=True)).to_be_enabled()
    def passed(name, state=None):
        if state is not None: assert not state['errors'], state['errors']
        checks.append(name)

    ctx,page,state=setup(favorites=['test-b'])
    page.get_by_role('navigation',name='分类').get_by_role('button',name='AI').click()
    page.locator('nav').last.get_by_role('button',name='收藏').click()
    expect(page.get_by_text('Test article B',exact=True)).to_be_visible()
    passed('收藏不受资讯分类过滤',state); ctx.close()

    ctx,page,state=setup()
    open_article(page)
    page.get_by_role('button',name='收藏',exact=True).last.click()
    expect(page.get_by_role('button',name='取消收藏').last).to_be_visible()
    page.get_by_role('button',name='返回',exact=True).click()
    page.locator('.prose-news').wait_for(state='detached')
    state['feed']=[item2]
    page.reload(); page.wait_for_load_state('networkidle')
    page.locator('nav').last.get_by_role('button',name='收藏').click()
    expect(page.get_by_text('Test article A',exact=True)).to_be_visible()
    before=state['details']; ctx.set_offline(True)
    open_article(page)
    assert state['details']==before
    expect(page.get_by_text('Nested quote',exact=True)).to_be_visible()
    passed('收藏在分片消失后仍可离线阅读',state); ctx.close()

    ctx,page,state=setup(snapshot={'savedAt':now,'items':[item,item2],'index':None},fail_shards=True)
    expect(page.get_by_text('Test article A',exact=True)).to_be_visible()
    assert len(page.evaluate('JSON.parse(localStorage.getItem("np-snapshot")).items'))==2
    expect(page.get_by_text('缓存',exact=True)).to_be_visible()
    passed('分片失败保留完整快照',state); ctx.close()

    ctx,page,state=setup(dates=['2026-09-02','2026-09-03'])
    expect(page.get_by_text('Test article A',exact=True)).to_be_visible()
    assert page.get_by_text('Stale article A',exact=True).count()==0
    passed('最新分片优先',state); ctx.close()

    ctx,page,state=setup()
    page.locator('nav').last.get_by_role('button',name='设置').click()
    expect(page.get_by_role('heading',name='显示',exact=True)).to_be_visible()
    assert page.locator('input[type=password]').count()==0
    assert page.get_by_text('管理令牌',exact=False).count()==0
    page.get_by_role('button',name='紧凑',exact=True).click()
    page.get_by_role('button',name='保存到云端',exact=True).click()
    expect(page.get_by_text('已保存到云端',exact=False)).to_be_visible()
    assert state['saved_config']['settings']['density']=='compact'
    assert page.evaluate('localStorage.getItem("np-admin-token")') is None
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(OUT/'settings-no-token.png'))
    passed('无令牌保存配置且保留 ETag，iPhone 设置页无横向溢出',state); ctx.close()

    ctx,page,state=setup(partial=True)
    open_article(page)
    page.get_by_role('button',name='双语对照',exact=False).click()
    page.get_by_role('button',name='仅中文',exact=True).click()
    expect(page.get_by_text('全文翻译完成',exact=True)).to_be_visible(timeout=10000)
    assert state['creates']==1 and state['runs']==2, state
    assert len(state['inputs'])==4, state['inputs']
    assert page.locator('.prose-news h2').inner_text()=='译文：Heading'
    assert page.locator('.prose-news blockquote p').inner_text()=='译文：Nested quote'
    assert page.locator('.prose-news pre code').inner_text()=='if (ok) {\n  call();\n}'
    assert page.locator('.prose-news img').count()==1
    page.screenshot(path=str(OUT/'translation-complete.png'))
    page.reload(); page.wait_for_load_state('networkidle'); open_article(page)
    page.get_by_role('button',name='仅中文',exact=True).click()
    expect(page.get_by_text('全文翻译完成',exact=True)).to_be_visible()
    assert state['creates']==1 and state['runs']==2
    passed('缺段自动补译、模式切换不重复、完整渲染与重载恢复',state); ctx.close()

    ctx,page,state=setup(partial=True)
    open_article(page); page.get_by_role('button',name='仅中文',exact=True).click()
    page.wait_for_function('document.querySelector(".translation-pending") !== null')
    page.get_by_role('button',name='返回',exact=True).click()
    page.locator('.prose-news').wait_for(state='detached')
    # 模拟关闭页面期间云端 cron 完成；重开只拉取结果。
    for unit in state['inputs']: state['job']['results'][unit['key']]={'key':unit['key'],'text':'云端补全：'+unit['text']}
    state['job'].update(state='complete',completed=len(state['inputs']))
    page.reload(); page.wait_for_load_state('networkidle'); open_article(page)
    page.get_by_role('button',name='仅中文',exact=True).click()
    expect(page.get_by_text('全文翻译完成',exact=True)).to_be_visible(timeout=10000)
    assert state['creates']==1
    passed('关闭页面后恢复云端完成结果',state); ctx.close()

    long_html=''.join('<p>Paragraph '+str(i)+' '+('Long article test content. '*15)+'</p>' for i in range(50))
    ctx,page,state=setup(content=long_html)
    open_article(page); page.wait_for_timeout(100)
    page.locator('div.fixed.inset-0.z-40').evaluate('(el)=>{el.scrollTop=(el.scrollHeight-el.clientHeight)*0.55;el.dispatchEvent(new Event("scroll",{bubbles:true}));}')
    page.evaluate('history.back()'); page.locator('.prose-news').wait_for(state='detached')
    page.wait_for_timeout(100)
    assert abs(page.evaluate('JSON.parse(localStorage.getItem("np-progress"))["test-a"]')-.55)<.03
    passed('快速退出即时保存阅读进度',state); ctx.close()

    ctx,page,state=setup(feed=[{**item,'id':'test-'+str(i),'title':'Test '+str(i),'publishedAt':now-i} for i in range(12)])
    for _ in range(3):
        page.locator('main .overflow-y-auto').evaluate('(el)=>el.scrollTop=el.scrollHeight'); page.wait_for_timeout(120)
    button=page.locator('main article').last.get_by_role('button').last
    assert button.evaluate('(el)=>{const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(OUT/'feed-bottom.png'))
    passed('iPhone 视口末卡无遮挡且无横向溢出',state); ctx.close()
    browser.close()

(OUT/'results.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(checks,ensure_ascii=False,indent=2))
