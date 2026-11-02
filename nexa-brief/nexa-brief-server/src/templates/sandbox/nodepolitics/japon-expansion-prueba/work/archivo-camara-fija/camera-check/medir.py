#!/usr/bin/env python3
"""Auditoría reproducible de cámara; no modifica la página ni sus datos en disco.

Usar el Python del .venv del backend. PNG temporales en /tmp/camera-check;
CSV/JSON persistentes al lado de este script. --capture / --analyze separan fases.
"""
import argparse
import asyncio
import base64
import csv
import functools
import hashlib
import http.server
import importlib.util
import json
import math
import os
from pathlib import Path
import threading
import time
import sys

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
TEMPLATES = ROOT.parents[2]
KIT = TEMPLATES / "_tools/explainer-kit"
TMP = Path("/tmp/camera-check")
sys.dont_write_bytecode = True
FORMATS = {"16x9": (1280, 720, 0.5), "9x16": (720, 1280, 2.0)}
THRESHOLDS = {"displacement_px": 0.5, "scale_pct": 0.1, "rotation_deg": 0.05}

# Solo en la respuesta HTTP de esta sesión: copia del atlas ANTES de video, sol,
# flechas, banderas, títulos y postproceso. No altera argumentos ni retorno.
PROBE = r"""
;(() => {
  const IM = Kit.imperio, original = IM.mapCache;
  const P = window.__cameraProbe = { enabled: false, frames: {} };
  IM.mapCache = function(ctx) {
    const result = original.apply(this, arguments), draw = result.draw;
    result.draw = function(G, cam) {
      const view = draw.apply(this, arguments);
      if (P.enabled) {
        const beat = ctx.beat || null, key = beat ? String(beat.i) : 'background';
        let record = P.frames[key];
        if (!record) record = P.frames[key] = { canvas: document.createElement('canvas') };
        const c = record.canvas;
        if (c.width !== G.canvas.width || c.height !== G.canvas.height) {
          c.width = G.canvas.width; c.height = G.canvas.height;
        }
        const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
        g.drawImage(G.canvas, 0, 0);
        Object.assign(record, { beat: beat && {i:beat.i,use:beat.use,t0:beat.t0,t1:beat.t1,layer:beat.layer},
          cam: {...cam}, matrix: [...view.m], gray: arguments[4]?.gray || 0 });
      }
      return view;
    };
    return result;
  };
})();
"""


def source_hashes():
    paths = [ROOT / "index.html", ROOT / "assets/storyboard.json",
             ROOT / "assets/config.json", ROOT / "assets/components/japon.js",
             KIT / "designs/imperio/components/_imperio.js",
             KIT / "designs/imperio/components/intros.js",
             KIT / "designs/imperio/components/outro.js"]
    return {str(p.relative_to(TEMPLATES)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


async def capture():
    from playwright.async_api import async_playwright
    # Reutiliza el servidor de shoot.py, incluido HTTP Range para seek de MP4.
    spec = importlib.util.spec_from_file_location("camera_shoot", KIT / "tools/shoot.py")
    shoot = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(shoot)
    server = shoot.serve(TEMPLATES)
    hashes = source_hashes()
    metadata = {"source_hashes_before": hashes, "formats": {}, "errors": []}
    started = time.monotonic()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None,
            args=["--autoplay-policy=no-user-gesture-required"])
        try:
            for name, (w, h, step) in FORMATS.items():
                folder = TMP / name
                folder.mkdir(parents=True, exist_ok=True)
                page = await browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
                page.on("pageerror", lambda e: metadata["errors"].append(str(e)))
                page.on("console", lambda m: metadata["errors"].append(m.text) if m.type in ("error", "warning") else None)

                async def instrument(route):
                    response = await route.fetch()
                    await route.fulfill(response=response, body=(await response.text()) + PROBE)

                await page.route("**/designs/imperio/components/_imperio.js", instrument)
                url = f"http://127.0.0.1:{server.server_port}/{ROOT.relative_to(TEMPLATES).as_posix()}/index.html?paused&t=0"
                await page.goto(url, wait_until="domcontentloaded", timeout=120000)
                await page.wait_for_function("window.__promo && window.__cameraProbe", timeout=120000)
                await page.evaluate("document.fonts.ready")
                beats = await page.evaluate("window.__promo.beats")
                total = await page.evaluate("window.__promo.total")
                fmt = metadata["formats"][name] = {"width": w, "height": h, "step": step, "total": total, "beats": beats, "frames": []}
                ts = np.arange(0, 119.0001, step).tolist()
                for n, t in enumerate(ts):
                    await page.evaluate("t => {__cameraProbe.frames={}; __cameraProbe.enabled=true; return __promo.seek(t)}", t)
                    records = await page.evaluate("""t => {
                      __cameraProbe.enabled=false;
                      const entries=Object.values(__cameraProbe.frames);
                      const records=entries.map(r=>({beat:r.beat,cam:r.cam,matrix:r.matrix,gray:r.gray}));
                      const eligible=entries.filter(r=>!r.beat || r.beat.t0<=t);
                      eligible.sort((a,b)=>(a.beat?.t0??-1)-(b.beat?.t0??-1));
                      const last=eligible.at(-1);
                      return {records,chosen:last?{beat:last.beat,cam:last.cam,matrix:last.matrix,gray:last.gray,png:last.canvas.toDataURL('image/png').split(',')[1]}:null,
                        css:[...document.querySelectorAll('canvas')].filter(c=>c.className).map(c=>({class:c.className,transform:getComputedStyle(c).transform}))};
                    }""", t)
                    chosen = records["chosen"]
                    if chosen:
                        (folder / f"atlas-{t:06.1f}.png").write_bytes(base64.b64decode(chosen.pop("png")))
                    await page.screenshot(path=str(folder / f"frame-{t:06.1f}.png"), animations="disabled")
                    fmt["frames"].append({"t": t, **records})
                    if n % 30 == 0 or n == len(ts) - 1:
                        print(f"captura {name}: {n+1}/{len(ts)}, t={t:.1f}s", flush=True)
                # Repeticiones idénticas para medir ruido del método y determinismo.
                repeats = []
                for t in [2.0, 14.0, 36.0, 80.0, 116.0]:
                    await page.evaluate("t => __promo.seek(t)", t)
                    path = folder / f"repeat-{t:06.1f}.png"
                    await page.screenshot(path=str(path), animations="disabled")
                    repeats.append({"t": t, "path": str(path)})
                fmt["repeats"] = repeats
                await page.close()
                save_json(HERE / "captures.json", metadata)
        finally:
            await browser.close()
            server.shutdown()
    metadata["source_hashes_after"] = source_hashes()
    metadata["sources_unchanged"] = hashes == metadata["source_hashes_after"]
    metadata["capture_seconds"] = time.monotonic() - started
    save_json(HERE / "captures.json", metadata)
    print(f"Capturas completas: {metadata['capture_seconds']:.1f}s", flush=True)


SIFT = cv2.SIFT_create(nfeatures=6000, contrastThreshold=0.012, edgeThreshold=12)
BF = cv2.BFMatcher(cv2.NORM_L2)
REDUCE = 0.5


def read_gray(path):
    im = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if im is None:
        return None
    return cv2.resize(im, None, fx=REDUCE, fy=REDUCE, interpolation=cv2.INTER_AREA)


def features(image):
    mask = np.zeros_like(image)
    h, w = image.shape
    # Excluye subtítulos, bordes y zona del sello/año.
    mask[int(h*.06):int(h*.84), int(w*.04):int(w*.96)] = 255
    return SIFT.detectAndCompute(image, mask)


def patch_corr(final, atlas, xy):
    x, y = np.round(xy).astype(int)
    r = 9
    if x < r or y < r or x+r >= final.shape[1] or y+r >= final.shape[0]:
        return -1
    a = final[y-r:y+r+1, x-r:x+r+1].astype(float)
    b = atlas[y-r:y+r+1, x-r:x+r+1].astype(float)
    a -= a.mean(); b -= b.mean()
    return float(np.sum(a*b) / (np.linalg.norm(a)*np.linalg.norm(b) + 1e-9))


def register(a, b, clean_a=None, clean_b=None):
    ka, da = features(a); kb, db = features(b)
    if da is None or db is None or len(db)<2:
        return {"valid": False, "reason": "sin descriptores"}
    pairs = []
    for matches in BF.knnMatch(da, db, k=2):
        if len(matches) != 2:
            continue
        m, n = matches
        if m.distance >= 0.74*n.distance:
            continue
        pa, pb = ka[m.queryIdx].pt, kb[m.trainIdx].pt
        if clean_a is not None and (patch_corr(a, clean_a, pa)<0.60 or patch_corr(b, clean_b, pb)<0.60):
            continue
        pairs.append((pa, pb))
    if len(pairs)<10:
        return {"valid": False, "matches": len(pairs), "reason": "menos de 10 puntos de mapa"}
    src, dst = np.array(pairs, np.float32).transpose(1,0,2)
    src = np.ascontiguousarray(src)
    dst = np.ascontiguousarray(dst)
    M, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC,
        ransacReprojThreshold=0.8, maxIters=5000, confidence=0.999, refineIters=20)
    if M is None:
        return {"valid": False, "matches": len(pairs), "reason": "RANSAC sin modelo"}
    ok = inliers.ravel().astype(bool)
    pred = src@M[:,:2].T + M[:,2]
    residual = np.linalg.norm(pred-dst, axis=1)[ok]/REDUCE
    h,w=a.shape; center = np.array([w/2,h/2])
    shift=(M[:,:2]@center+M[:,2]-center)/REDUCE
    scale = math.hypot(M[0,0],M[1,0])
    grid = {(min(3,int(p[0]/w*4)),min(2,int(p[1]/h*3))) for p in src[ok]}
    extent = np.ptp(src[ok], axis=0) / [w,h]
    motion = np.linalg.norm((pred-src)[ok], axis=1)/REDUCE
    return {"valid": bool(int(ok.sum())>=10 and len(grid)>=4 and min(extent)>.20),
        "matches":len(pairs),"inliers":int(ok.sum()),"grid_cells":len(grid),
        "extent_x":float(extent[0]),"extent_y":float(extent[1]),
        "dx_px":float(shift[0]),"dy_px":float(shift[1]),"displacement_px":float(np.linalg.norm(shift)),
        "scale_pct":float((scale-1)*100),"rotation_deg":float(math.degrees(math.atan2(M[1,0],M[0,0]))),
        "median_map_point_displacement_px":float(np.median(motion)),
        "max_map_point_displacement_px":float(np.max(motion)),
        "median_residual_px":float(np.median(residual)),"matrix":M.tolist()}


def expected(a,b,w,h):
    if not a or not b:
        return {}
    def mat(rec):
        x=rec['matrix']; return np.array([[x[0],x[2],x[4]],[x[1],x[3],x[5]],[0,0,1]])
    A=mat(a); B=mat(b)
    # Proyecciones de atlas con distinto meridiano requieren tratarse como corte.
    T=B@np.linalg.inv(A)
    c=np.array([w/2,h/2,1]); shift=(T@c-c)[:2]
    return {"dx_px":float(shift[0]),"dy_px":float(shift[1]),"displacement_px":float(np.linalg.norm(shift)),
        "scale_pct":float((math.hypot(T[0,0],T[1,0])-1)*100),
        "rotation_deg":float(math.degrees(math.atan2(T[1,0],T[0,0])))}


def calibrate(folder):
    base = read_gray(folder/'atlas-0036.0.png')
    h,w=base.shape
    results=[]
    for label,dx,dy,scale,angle in [('identity',0,0,1,0),('translation',4,-3,1,0),('zoom_rotation',0,0,.985,.25)]:
        M=cv2.getRotationMatrix2D((w/2,h/2),-angle,scale)
        M[:,2] += np.array([dx,dy])*REDUCE
        moved=cv2.warpAffine(base,M,(w,h),borderMode=cv2.BORDER_REFLECT)
        results.append({'test':label,'expected':{'dx_px':dx,'dy_px':dy,'scale_pct':(scale-1)*100,'rotation_deg':angle},'measured':register(base,moved)})
    return results


def analyze():
    cv2.setNumThreads(2)
    cv2.setRNGSeed(1895)
    meta=json.loads((HERE/'captures.json').read_text())
    summary={"formats":{},"method":{"resize":REDUCE,"patch_correlation_min":0.60,"ratio":0.74,"ransac_threshold_original_px":1.6}}
    for name, fmt in meta['formats'].items():
        folder=TMP/name; rows=[]; data=[]; previous=None
        for frame in fmt['frames']:
            t=frame['t']; full=read_gray(folder/f"frame-{t:06.1f}.png")
            atlas=read_gray(folder/f"atlas-{t:06.1f}.png")
            if previous:
                pf,pa,pi=previous
                visual=register(pf,full,pa,atlas) if pa is not None and atlas is not None else register(pf,full)
                clean=register(pa,atlas) if pa is not None and atlas is not None else {"valid":False}
                model=expected(pi['chosen'],frame['chosen'],fmt['width'],fmt['height'])
                scene_a=pi['chosen']['beat']['use'] if pi['chosen'] and pi['chosen']['beat'] else 'background'
                scene_b=frame['chosen']['beat']['use'] if frame['chosen'] and frame['chosen']['beat'] else 'background'
                item={"t0":pi['t'],"t1":t,"scene_a":scene_a,"scene_b":scene_b,"scene_change":scene_a!=scene_b,
                    "visual":visual,"atlas":clean,"model":model,
                    "mean_abs_difference":float(np.abs(full.astype(float)-pf).mean()),
                    "changed_fraction_25":float((np.abs(full.astype(float)-pf)>25).mean())}
                data.append(item)
                row={k:item[k] for k in ['t0','t1','scene_a','scene_b','scene_change','mean_abs_difference','changed_fraction_25']}
                for prefix,values in [('visual',visual),('atlas',clean),('model',model)]:
                    row.update({prefix+'_'+k:v for k,v in values.items() if k!='matrix'})
                rows.append(row)
            previous=full,atlas,frame
        repeats=[]
        for repeat in fmt['repeats']:
            t=repeat['t']; path=folder/f"frame-{t:06.1f}.png"
            if not path.exists():
                continue
            a=read_gray(path); b=read_gray(Path(repeat['path']))
            repeats.append({'t':t,'max_pixel_difference':int(np.abs(a.astype(int)-b).max()),'registration':register(a,b)})
        save_json(HERE/f'pairs-{name}.json',data)
        fields=list(dict.fromkeys(k for row in rows for k in row))
        with (HERE/f'pairs-{name}.csv').open('w') as f:
            writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(rows)
        summary['formats'][name]={'frames':len(fmt['frames']),'pairs':len(data),'repeats':repeats,
            'scene_changes':[x for x in data if x['scene_change']],
            'visual_invalid':sum(not x['visual']['valid'] for x in data),
            'atlas_invalid':sum(not x['atlas']['valid'] for x in data)}
        summary['formats'][name]['calibration']=calibrate(folder)
        print(f"análisis {name}: {len(data)} pares; inválidos final={summary['formats'][name]['visual_invalid']}, atlas={summary['formats'][name]['atlas_invalid']}",flush=True)
    save_json(HERE/'summary.json',summary)


def finalize():
    """Clasifica cortes aparte y conserva límites empíricos, sin descartar pares."""
    meta=json.loads((HERE/'captures.json').read_text())
    summary=json.loads((HERE/'summary.json').read_text())
    summary['thresholds']=THRESHOLDS
    for name,fmt in meta['formats'].items():
        path=HERE/f'pairs-{name}.json'
        pairs=json.loads(path.read_text())
        rows=[]
        for item in pairs:
            fa=next(x for x in fmt['frames'] if x['t']==item['t0'])
            fb=next(x for x in fmt['frames'] if x['t']==item['t1'])
            ca=fa['chosen']['cam'] if fa['chosen'] else None
            cb=fb['chosen']['cam'] if fb['chosen'] else None
            different=ca is not None and cb is not None and any(abs(ca[k]-cb[k])>1e-7 for k in ca)
            item['cut']=bool(item['scene_change'] and different)
            item['transition_without_reframing']=bool(item['scene_change'] and not item['cut'])
            item['movement']=bool(not item['cut'] and item['atlas']['valid'] and any(abs(item['atlas'][k])>v for k,v in THRESHOLDS.items()))
            # Una matriz de Mercator relativa no da traslación comparable cuando
            # cambia el meridiano central del atlas; esos casos son cortes.
            same_atlas = ca is not None and cb is not None and math.floor(ca['lon']/10+.5)==math.floor(cb['lon']/10+.5)
            item['model']['translation_comparable']=same_atlas
            if not same_atlas:
                for key in ['dx_px','dy_px','displacement_px']:
                    item['model'][key]=None
            row={k:v for k,v in item.items() if k not in ('visual','atlas','model')}
            for prefix in ['visual','atlas','model']:
                row.update({prefix+'_'+k:v for k,v in item[prefix].items() if k!='matrix'})
            rows.append(row)
        save_json(path,pairs)
        fields=list(dict.fromkeys(k for row in rows for k in row))
        with (HERE/f'pairs-{name}.csv').open('w') as f:
            writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(rows)
        s=summary['formats'][name]
        s['movement_pairs']=[x for x in pairs if x['movement']]
        s['cuts']=[x for x in pairs if x['cut']]
        s['noise']={}
        static=[x for x in pairs if not x['scene_change'] and x['t1']<115.12]
        for kind in ['visual','atlas']:
            accepted=[x[kind] for x in static if x[kind]['valid']]
            s['noise'][kind]={'valid_pairs':len(accepted)}
            for key in ['displacement_px','scale_pct','rotation_deg','median_map_point_displacement_px']:
                vals=np.array([abs(x[key]) for x in accepted])
                s['noise'][kind][key]={'max':float(vals.max()),'p99':float(np.percentile(vals,99))}
        folder=TMP/name
        endpoints=(115.5,119.) if name=='16x9' else (116.,118.)
        start,end=endpoints
        interval={'t0':start,'t1':end}
        interval['atlas']=register(read_gray(folder/f'atlas-{start:06.1f}.png'),read_gray(folder/f'atlas-{end:06.1f}.png'))
        s['cumulative_interval']=interval
    summary['sources_unchanged_at_end']=meta['source_hashes_before']==source_hashes()
    save_json(HERE/'summary.json',summary)
    print('Resumen: '+', '.join(f"{name}: {len(s['movement_pairs'])} pares con movimiento y {len(s['cuts'])} cortes" for name,s in summary['formats'].items()),flush=True)


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--capture',action='store_true');ap.add_argument('--analyze',action='store_true')
    ap.add_argument('--summarize',action='store_true')
    args=ap.parse_args()
    if args.summarize:
        finalize()
        return
    if args.capture or not args.analyze:
        asyncio.run(capture())
    if args.analyze or not args.capture:
        analyze()
        finalize()


if __name__=='__main__':
    main()
