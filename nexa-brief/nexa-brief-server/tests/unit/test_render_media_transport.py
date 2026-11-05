import asyncio
import importlib.util
import io
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pytest
from PIL import Image
from playwright.async_api import Error, async_playwright

ROOT = Path(__file__).resolve().parents[2] / "src/templates"
KIT = ROOT / "_tools/explainer-kit"
sys.path.insert(0, str(ROOT / "_tools"))

spec = importlib.util.spec_from_file_location("media_render_promo", ROOT / "_tools/commercial/render_promo.py")
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)


@pytest.fixture
def media_server(tmp_path):
    (tmp_path / "kit").symlink_to(KIT, target_is_directory=True)
    (tmp_path / "bytes.mp4").write_bytes(bytes(range(256)))
    server = renderer.serve(tmp_path)
    yield tmp_path, f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    server.server_close()


@pytest.mark.parametrize("byte_range,start,end", [("bytes=10-29", 10, 29), ("bytes=240-", 240, 255), ("bytes=-16", 240, 255)])
def test_actual_renderer_server_supports_media_ranges(media_server, byte_range, start, end):
    _, base = media_server
    with urllib.request.urlopen(urllib.request.Request(base + "/bytes.mp4", headers={"Range": byte_range})) as response:
        assert response.status == 206
        assert response.headers["Content-Range"] == f"bytes {start}-{end}/256"
        assert response.headers["Accept-Ranges"] == "bytes"
        assert response.read() == bytes(range(start, end + 1))


def test_renderer_rejects_invalid_range_without_sending_full_video(media_server):
    _, base = media_server
    with pytest.raises(urllib.error.HTTPError) as exc:
        urllib.request.urlopen(urllib.request.Request(base + "/bytes.mp4", headers={"Range": "bytes=500-"}))
    assert exc.value.code == 416
    assert exc.value.headers["Content-Range"] == "bytes */256"


def test_real_clip_seeks_and_logo_exits_with_photo(media_server):
    root, base = media_server
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=160x90:rate=30",
                    "-t", "4", "-an", "-c:v", "libx264", "-g", "6", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", str(root / "sample.mp4")], check=True)
    Image.new("RGB", (320, 180), "#444444").save(root / "sample.jpg")
    design = json.loads((KIT / "designs/rough/design.json").read_text())
    scripts = ['engine/kit.js', *design['scripts']]
    html = '<html><head><meta charset="UTF-8"></head><body style="margin:0"><div id="stage" style="position:relative;width:100vw;height:100vh"></div>'
    html += ''.join(f'<script src="/kit/{s}"></script>' for s in scripts)
    html += '''<script>
      Kit.boot({total: 8, design: ''' + json.dumps(design) + ''',
        config: {palette:{bg:'#0a0a0b',ink:'#ededea',accent:'#c8ff2e'},fonts:{load:[]},outro:{enabled:false}},
        lyrics:{segments:[]}, storyboard:{beats:[
          {t:0,offset:0,dur:2,use:'rough.photo',params:{src:'/sample.jpg',logoName:'TEST LOGO'}},
          {t:2,offset:0,dur:6,use:'rough.introv2',params:{text:'MOVING CLIP',video:'/sample.mp4',src:'/sample.jpg'}}
        ]}}).catch(e=>window.bootError=e.message);
    </script></body></html>'''
    (root / "index.html").write_text(html)
    asyncio.run(_check_motion_and_logo(base))


async def _check_motion_and_logo(base):
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=renderer.CHROMIUM)
        page = await browser.new_page(viewport={"width": 960, "height": 540})
        try:
            await page.goto(base + '/index.html?t=0')
            await page.wait_for_function('window.__promo || window.bootError', timeout=30000)
            assert await page.evaluate('window.bootError || null') is None
            await page.evaluate('window.__promo.seek(1)')
            assert float(await page.locator('[data-brand-logo]').evaluate('e=>e.style.opacity')) == 1
            await page.evaluate('window.__promo.seek(2.225)')
            opacity = float(await page.locator('[data-brand-logo]').evaluate('e=>e.style.opacity'))
            assert .45 < opacity < .55
            await page.evaluate('window.__promo.seek(2.5)')
            assert float(await page.locator('[data-brand-logo]').evaluate('e=>e.style.opacity')) == 0
            frames=[]
            for t in (3.0, 4.0, 3.0):
                await page.evaluate('(t)=>window.__promo.seek(t)',t)
                frame=await page.evaluate('''() => {
                  const v=Kit.loadedVideos.get('/sample.mp4');
                  const c=document.createElement('canvas');c.width=32;c.height=18;
                  const g=c.getContext('2d');g.drawImage(v,0,0,32,18);
                  return {time:v.currentTime,pixels:Array.from(g.getImageData(0,0,32,18).data)};
                }''')
                assert abs(frame['time']-(t-2)) < .075
                frames.append(frame['pixels'])
            assert frames[0] != frames[1] and frames[0] == frames[2]
            await page.evaluate("() => { const v=Kit.loadedVideos.get(\"/sample.mp4\"); Object.defineProperty(v, \"currentTime\", {get:()=>0,set:()=>{}}); }")
            with pytest.raises(Error, match="no llegó al cuadro solicitado"):
                await page.evaluate("window.__promo.seek(5)")
        finally:
            await browser.close()


@pytest.mark.parametrize("width,height", [(720,1280),(1080,1920)])
def test_portrait_cover_compacts_rows_below_fixed_first_title(media_server, width, height):
    root, base = media_server
    Image.new("RGB", (600, 800), "#555555").save(root / "sample.jpg")
    asyncio.run(_check_cover(base,width,height))


async def _check_cover(base,width,height):
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=renderer.CHROMIUM)
        try:
            page = await browser.new_page(viewport={"width":width,"height":height})
            for title, bullet in [('TU VOZ, SU ESTAFA','2023 · MICROSOFT'),
                                  ('TUS CHATS ANTE UN JUEZ','20 MILLONES'),
                                  ('TÚ ERES EL SIGUIENTE','250 PUESTOS')]:
                params={'text':title,'accent':title.split()[-1],'src':'/sample.jpg',
                        'focus':[.41,.48,.18],'bullet':bullet,'bulletScale':.82}
                query={'d':'rough','c':'common.tabloid','p':json.dumps(params),'paused':'1','solo':'1'}
                captures=[]
                for cover in ('0','1'):
                    q=urllib.parse.urlencode({**query,'coverSafe':cover})
                    await page.goto(base+'/kit/showcase/stage.html?'+q)
                    await page.wait_for_function('window.__promo && window.__tabloidFontReady',timeout=30000)
                    await page.evaluate('window.__tabloidFontReady')
                    await page.evaluate('window.__promo.seek(4.5)')
                    captures.append((await page.evaluate('window.__tabloidLayout'),
                                     Image.open(io.BytesIO(await page.screenshot())).convert('RGB')))
                (original,before),(layout,after)=captures
                assert layout['photo']==original['photo']=={'x':0,'y':0,'w':width,'h':height*.56,'type':'photo'}
                assert len(layout['boxes'])==len(original['boxes'])
                rows=[b for b in layout['boxes'] if b['type']=='title']
                assert ' '.join(b['text'] for b in rows)==title
                if title=='TU VOZ, SU ESTAFA':
                    assert [row['text'] for row in rows]==['TU','VOZ,','SU','ESTAFA']
                original_rows=[b for b in original['boxes'] if b['type']=='title']
                assert rows[0]['textAnchor']==original_rows[0]['textAnchor']
                for previous,current,base_row in zip(rows,rows[1:],original_rows[1:]):
                    assert current['textAnchor']['x']==base_row['textAnchor']['x']
                    assert current['textAnchor']['y']<base_row['textAnchor']['y']
                    visible_gap=current['textAnchor']['y']-(previous['textAnchor']['y']+previous['inkHeight'])
                    assert 0 <= visible_gap <= width*.02+.001
                for shown,base_box in zip(layout['boxes'],original['boxes'],strict=True):
                    if shown['type'] in {'title','accent'}:
                        assert shown['textAnchor']['x']==base_box['textAnchor']['x']
                        assert shown['textAnchor']['y']<=base_box['textAnchor']['y']
                        assert shown['fontSize']==pytest.approx(base_box['fontSize']*.85)
                        assert shown['w']==pytest.approx(base_box['w']*.85)
                        assert shown['h']==pytest.approx(base_box['h']*.85)
                    elif shown['type']=='bullet':
                        assert shown['x']==pytest.approx(base_box['x'])
                        assert shown['y']==pytest.approx(base_box['y']+50)
                        assert shown['w']==pytest.approx(base_box['w']*.81)
                        assert shown['h']==pytest.approx(base_box['h']*.81)
                        # Check actual pixels too: the old top becomes photograph,
                        # and the red background starts 50 pixels farther down.
                        old_point=(round(base_box['x']+8),round(base_box['y']+8))
                        new_point=(round(shown['x']+8),round(shown['y']+8))
                        assert before.getpixel(old_point)==(225,6,0)
                        assert after.getpixel(old_point)!=(225,6,0)
                        assert after.getpixel(new_point)==(225,6,0)
                    else:
                        assert shown==base_box
        finally:
            await browser.close()
