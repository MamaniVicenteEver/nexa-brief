/* TITANES · luz motivada, planos con paralaje y tiempo absoluto. */
(function () {
  "use strict";
  const K = window.Kit, { clamp, lerp, prog } = K;
  const ROOT = new URL("../", document.currentScript.src).href;
  const T = K.titanes = { ROOT, presets: ["foco", "horizonte", "ciudad", "sala", "rayos", "mercado", "archivo"] };
  T.sample = name => ROOT + "samples/" + name + ".png";
  // El loader interpreta fontsCss desde el episodio. Aquí las URL nacen del diseño.
  const style = document.createElement("style");
  style.textContent = `@font-face{font-family:Anton;src:url('${ROOT}fonts/anton-normal-400.ttf')}@font-face{font-family:Inter;src:url('${ROOT}fonts/inter-400.ttf');font-weight:400}@font-face{font-family:Inter;src:url('${ROOT}fonts/inter-900.ttf');font-weight:900}[data-family=titanes] .k-cap{font-family:Inter,sans-serif;font-weight:400;color:var(--titanes-ink,#EFE9DF);text-shadow:0 2px 12px var(--titanes-black,#000);font-variant-numeric:tabular-nums}[data-family=titanes] .k-w-cur{color:var(--titanes-rim,#F2C96B)}`;
  document.head.appendChild(style);
  ["400 40px Anton", "400 40px Inter", "900 40px Inter"].forEach(f => K.fonts.add(f));
  T.canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  T.color = (h, a = 1) => {
    let s = String(h).replace("#", ""); if (s.length === 3) s = s.split("").map(x => x + x).join("");
    return `rgba(${parseInt(s.slice(0, 2), 16)},${parseInt(s.slice(2, 4), 16)},${parseInt(s.slice(4, 6), 16)},${clamp(a)})`;
  };
  T.palette = (ctx, p = {}) => ({ ...ctx.C.palette, accent: p.acento || ctx.C.palette.accent, rim: p.borde || ctx.C.palette.rim });
  T.params = {
    acento: { type: "color", default: "palette.accent", doc: "Acento del plano; por defecto hereda palette.accent del video." },
    borde: { type: "color", default: "palette.rim", doc: "Luz de borde; hereda palette.rim." },
    intensidad: { type: "number", default: 1, min: 0.25, max: 1.7, doc: "Potencia de luz y bruma, conservando los negros." },
    semilla: { type: "number", default: 41, min: 1, max: 999999, doc: "Semilla de ventanas, polvo, grano y tinta." },
    ...K.hook.bgParams(T.presets),
  };
  T.figureParams = {
    figura: { type: "image", default: "", doc: "Ilustración PNG transparente del protagonista; nunca se dibuja una persona en código." },
    escalaFigura: { type: "number", default: 1, min: 0.65, max: 1.15, doc: "Escala de la figura respecto a la composición de cada formato." },
  };
  T.transitionParams = {
    entrada: { type: "enum", default: "golpe", options: ["tinta", "luz", "golpe", "ninguna"], doc: "Transición de entrada reutilizable." },
    salida: { type: "enum", default: "tinta", options: ["tinta", "luz", "golpe", "ninguna"], doc: "Transición de salida reutilizable." },
  };
  function linear(g, x, y, xx, yy, stops) { const v = g.createLinearGradient(x, y, xx, yy); stops.forEach(([a, c]) => v.addColorStop(a, c)); return v; }
  function ellipse(g, x, y, rx, ry, color) { g.fillStyle = color; g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2); g.fill(); }
  T.glow = (g, x, y, rx, ry, color, alpha) => {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const v = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    v.addColorStop(0, T.color(color, alpha)); v.addColorStop(0.22, T.color(color, alpha * .65)); v.addColorStop(0.62, T.color(color, alpha * .18)); v.addColorStop(1, T.color(color, 0));
    g.fillStyle = v; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  };
  function polygon(g, points, color) { g.fillStyle = color; g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); }
  function line(g, points, color, width = 1) { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
  const grains = [];
  function grain() {
    if (grains.length) return grains;
    const r = K.rng(973);
    for (let n = 0; n < 4; n++) {
      const c = T.canvas(192, 192), g = c.getContext("2d"), d = g.createImageData(192, 192);
      for (let i = 0; i < d.data.length; i += 4) { const a = 95 + r() * 66; d.data[i] = d.data[i + 1] = d.data[i + 2] = a; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0); grains.push(c);
    }
    return grains;
  }
  T.finish = (g, st, t, P, paper = false) => {
    const { W, H } = st;
    g.save(); const pat = g.createPattern(grain()[Math.floor(t * 18) % 4], "repeat");
    pat.setTransform(new DOMMatrix().translate(Math.floor(t * 18) * 13 % 192, Math.floor(t * 18) * 29 % 192));
    g.globalCompositeOperation = "soft-light"; g.globalAlpha = paper ? .19 : .13; g.fillStyle = pat; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    const v = g.createRadialGradient(W * .5, H * .45, Math.min(W, H) * .25, W * .5, H * .48, Math.hypot(W, H) * .56);
    v.addColorStop(0, T.color(P.black, 0)); v.addColorStop(.6, T.color(P.black, .14)); v.addColorStop(1, T.color(P.black, paper ? .75 : .94));
    g.fillStyle = v; g.fillRect(0, 0, W, H); g.restore();
  };
  function cityLayer(g, W, H, P, seed, depth, horizon = .77) {
    const r = K.rng(seed), ground = H * horizon, size = W / (depth === 0 ? 26 : depth === 1 ? 19 : 13);
    for (let x = -size; x < W + size; ) {
      const w = size * (.55 + r() * .9), h = H * (.08 + r() * (.26 + depth * .055));
      const y = ground - h;
      g.fillStyle = depth === 0 ? T.color(P.graphite, .95) : depth === 1 ? P.bg : P.tinta;
      g.fillRect(x, y, w, h + H * .25);
      polygon(g, [[x + w, y], [x + w + w * .16, y + w * .11], [x + w + w * .16, ground], [x + w, ground]], T.color(P.black, .7));
      line(g, [[x, y], [x + w, y], [x + w, ground]], T.color(P.rim, .17 + depth * .07), Math.max(1, W / 1500));
      if (r() > .62) { g.fillStyle = P.graphite; g.fillRect(x + w * .45, y - h * .09, w * .06, h * .1); }
      const step = Math.max(5, w / 6);
      for (let yy = y + step; yy < ground; yy += step * 1.6) for (let xx = x + step * .6; xx < x + w - step * .5; xx += step) {
        const a = r(); if (a > .59) { g.fillStyle = T.color(a > .91 ? P.ink : P.rim, (.15 + a * .45) / (1 + depth * .3)); g.fillRect(xx, yy, step * .3, step * .56); }
      }
      x += w + size * (.15 + r() * .3);
    }
  }
  function floor(g, W, H, P, x, intensity) {
    g.fillStyle = linear(g, 0, H * .79, 0, H, [[0, T.color(P.graphite, .62)], [.35, T.color(P.tinta, .96)], [1, P.black]]); g.fillRect(0, H * .79, W, H * .21);
    T.glow(g, x, H * .814, W * .42, H * .045, P.accent, .52 * intensity);
    T.glow(g, x, H * .91, W * .11, H * .22, P.rim, .10 * intensity);
    line(g, [[0, H * .79], [W, H * .79]], T.color(P.rim, .10), 1);
    for (let j = 0; j < 14; j++) { const y = H * (.807 + j * j * .00093); line(g, [[x - W * .38, y], [x + W * .38, y]], T.color(P.rim, .018), 1); }
  }
  function cone(g, W, H, P, x, intensity) {
    // Varias cuñas suaves comparten origen: luz volumétrica con núcleo y caída lateral.
    for (let n = 22; n >= 1; n--) {
      const spread = W * (.07 + n * .012), start = x - W * .14;
      polygon(g, [[start - W * .005, -H * .06], [start + W * .005, -H * .06], [x + spread, H * .82], [x - spread, H * .82]], linear(g, start, 0, x, H * .84, [[0, T.color(P.rim, .018 * intensity)], [.7, T.color(P.accent, .007 * intensity)], [1, T.color(P.rim, 0)]]));
    }
    T.glow(g, x - W * .14, H * .025, W * .24, H * .13, P.rim, .7 * intensity);
  }
  T.scene = (ctx, p, name = "foco") => {
    const st = ctx.stage, { W, H, portrait } = st, P = T.palette(ctx, p), I = p.intensidad ?? 1, seed = p.semilla || 41;
    const sx = W * (portrait ? .49 : .72), layers = [], dpr = ctx.dpr || 1;
    const make = fn => { const c = T.canvas(W * dpr, H * dpr), g = c.getContext("2d"); g.scale(dpr, dpr); fn(g); layers.push(c); return c; };
    make(g => {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, P.black], [.4, P.bg], [.78, P.graphite], [1, P.black]]); g.fillRect(0, 0, W, H);
      T.glow(g, sx, H * .5, W * .76, H * .65, P.accent, .46 * I);
      if (name === "archivo") { g.fillStyle = P.ink; g.fillRect(0, 0, W, H); T.glow(g, W * .7, H * .25, W, H, P.accent, .22 * I); }
      if (name === "horizonte") {
        g.fillStyle = linear(g, 0, 0, 0, H * .79, [[0, P.black], [.27, P.bg], [.65, T.color(P.accent, .35 * I)], [.91, T.color(P.rim, .85 * I)], [1, P.tinta]]); g.fillRect(0, 0, W, H * .82);
        T.glow(g, sx, H * .7, W * .5, H * .28, P.rim, .48 * I);
      }
      if (name === "ciudad" || name === "sala") cityLayer(g, W, H, P, seed, 0, name === "sala" ? .71 : .8);
      if (name === "foco") { cone(g, W, H, P, sx, I); for (let n = 0; n < 5; n++) { g.fillStyle = T.color(P.black, .22); g.fillRect(W * (n * .25 - .07), 0, W * .006, H * .79); } }
      if (name === "mercado") {
        // Cotizaciones escenográficas, nunca datos financieros del episodio.
        const r = K.rng(seed); g.save(); g.filter = `blur(${Math.max(2, W / 340)}px)`; g.font = `400 ${Math.min(W, H) * .044}px Inter`;
        for (let y = H * .08; y < H; y += H * .09) for (let x = -W * .05; x < W; x += W * .24) { g.fillStyle = T.color(r() > .18 ? P.rim : P.blood, .3 + r() * .4); T.number(g,(100 + r() * 900).toFixed(2),x,y,Math.min(W,H)*.044,g.fillStyle,{weight:400}); }
        g.restore();
      }
    });
    make(g => {
      if (name === "ciudad") {
        T.glow(g, sx, H * .63, W * .8, H * .23, P.rim, .3 * I); cityLayer(g, W, H, P, seed + 1, 1);
        T.glow(g, W * .4, H * .76, W * .8, H * .17, P.accent, .23 * I);
      } else if (name === "foco") {
        T.glow(g, sx, H * .58, W * .28, H * .43, P.accent, .46 * I); floor(g, W, H, P, sx, I);
      } else if (name === "horizonte") {
        polygon(g, [[0,H*.77],[W*.13,H*.735],[W*.3,H*.76],[W*.55,H*.74],[W*.79,H*.77],[W,H*.73],[W,H],[0,H]], P.tinta);
        T.glow(g, sx, H * .765, W * .6, H * .09, P.accent, .48 * I);
      } else if (name === "sala") {
        cityLayer(g, W, H, P, seed + 1, 1, .7);
        g.fillStyle = T.color(P.rim, .06); g.fillRect(W * .12, H * .13, W * .76, H * .59);
        polygon(g, [[0,0],[W,H*0],[W*.88,H*.13],[W*.12,H*.13]], P.tinta);
        polygon(g, [[0,0],[W*.12,H*.13],[W*.12,H*.72],[0,H]], P.bg);
        polygon(g, [[W,0],[W*.88,H*.13],[W*.88,H*.72],[W,H]], P.tinta);
        g.fillStyle = P.tinta; for (let n=0;n<6;n++) g.fillRect(W*(.12+n*.152),H*.13,W*.009,H*.59);
        line(g, [[W*.12,H*.13],[W*.88,H*.13]], T.color(P.rim,.48), 2);
        line(g, [[W*.12,H*.47],[W*.88,H*.47]], T.color(P.black,.8), 4);
        floor(g,W,H,P,sx,I);
        for(let n=0;n<3;n++){const x=W*(.28+n*.22);line(g,[[x,0],[x,H*.19]],P.black,2);ellipse(g,x,H*.195,W*.045,H*.006,P.rim);T.glow(g,x,H*.23,W*.14,H*.2,P.rim,.17*I);}
      } else if (name === "archivo") {
        const r=K.rng(seed); for(let j=0;j<4;j++) {
          g.save();g.translate(W*(.19+j*.22),H*(.22+(j%2)*.22));g.rotate((r()-.5)*.35);
          const w=W*.55,h=H*.31;g.shadowColor=T.color(P.tinta,.3);g.shadowBlur=W*.012;g.shadowOffsetY=H*.012;
          g.fillStyle=j%2?P.ink:linear(g,-w/2,0,w/2,h,[[0,P.ink],[1,T.color(P.accent,.45)]]);g.fillRect(-w/2,-h/2,w,h);g.shadowBlur=0;g.shadowOffsetY=0;
          for(let col=0;col<28;col++)for(let row=0;row<8;row++) if(r()>.73){g.fillStyle=T.color(P.tinta,.55);g.fillRect(-w*.44+col*w*.032,-h*.31+row*h*.082,w*.011,h*.043);}
          for(let row=0;row<5;row++)line(g,[[-w*.45,h*(.26+row*.028)],[w*.4,h*(.26+row*.028)]],T.color(P.tinta,.14),.5);
          g.restore();
        }
      } else if(name === "mercado") {
        g.save();g.filter=`blur(${W/600}px)`;for(let j=0;j<7;j++){g.fillStyle=T.color(P.black,.6);g.fillRect(W*j/6,0,W*.015,H);}g.restore();
        T.glow(g,sx,H*.3,W*.45,H*.5,P.accent,.28*I);
      }
    });
    make(g => {
      if(name === "ciudad") { cityLayer(g,W,H,P,seed+2,2,.94); T.glow(g,W*.6,H*.9,W*.6,H*.12,P.accent,.13*I); }
      if(name === "horizonte") {polygon(g,[[0,H*.86],[W*.2,H*.82],[W*.5,H*.85],[W*.7,H*.81],[W,H*.84],[W,H],[0,H]],P.black);line(g,[[0,H*.86],[W*.2,H*.82],[W*.5,H*.85],[W*.7,H*.81],[W,H*.84]],T.color(P.rim,.17),1);}
      if(name === "sala") {
        // Mesa en fuga, borde pulido y sillas en primer plano.
        polygon(g,[[W*.39,H*.69],[W*.61,H*.69],[W*.96,H*1.05],[W*.04,H*1.05]],linear(g,0,H*.69,0,H,[[0,P.graphite],[.5,P.tinta],[1,P.black]]));
        line(g,[[W*.04,H*1.05],[W*.39,H*.69],[W*.61,H*.69],[W*.96,H*1.05]],T.color(P.rim,.4),2);
        T.glow(g,W*.5,H*.8,W*.14,H*.16,P.rim,.08);
        for(let side of [-1,1])for(let j=0;j<3;j++){const x=W*(.5+side*(.17+j*.12)),y=H*(.76+j*.1),w=W*(.06+j*.027),h=H*(.08+j*.035);g.fillStyle=P.tinta;g.beginPath();g.roundRect(x-w/2,y-h/2,w,h,w*.1);g.fill();line(g,[[x-w/2,y-h/2],[x+w/2,y-h/2]],T.color(P.rim,.2),1);}
      }
      if(name === "mercado") {g.fillStyle=linear(g,0,H*.65,0,H,[[0,T.color(P.black,0)],[1,P.black]]);g.fillRect(0,0,W,H);line(g,[[W*.15,H],[W*.15,H*.05]],T.color(P.rim,.11),W*.004);}
      if(name === "archivo") {g.save();g.translate(W*.94,H*.84);g.rotate(-.25);g.fillStyle=P.tinta;g.shadowColor=T.color(P.black,.4);g.shadowBlur=H*.03;g.fillRect(-W*.1,-H*.48,W*.23,H*.7);line(g,[[-W*.07,-H*.48],[-W*.07,H*.22]],T.color(P.rim,.3),2);g.restore();}
    });
    const r=K.rng(seed+79), dust=Array.from({length:70},()=>({x:r(),y:r(),z:.3+r()*.7,a:r(),s:.35+r()*1.1}));
    return {
      render(g,t){
        g.save();g.fillStyle=P.black;g.fillRect(0,0,W,H);
        layers.forEach((c,i)=>{g.save();const z=1.035+i*.012+clamp(t/12)*.018,dx=Math.sin(t*.11+i*.4)*W*.008*(i+1),dy=Math.cos(t*.13+i)*H*.004;g.translate(W/2+dx,H/2+dy);g.scale(z,z);g.drawImage(c,-W/2,-H/2,W,H);g.restore();});
        if(name === "rayos") {
          const x=sx+Math.sin(t*.1)*W*.015,y=H*.64,L=Math.hypot(W,H);
          g.save();g.translate(x,y);g.rotate(t*.018);
          for(let j=0;j<32;j++){const a=j*Math.PI/16,w=.012+(j%4)*.007;g.save();g.rotate(a);polygon(g,[[0,0],[Math.cos(w)*L,-Math.sin(w)*L],[Math.cos(w)*L,Math.sin(w)*L]],linear(g,0,0,L,0,[[0,T.color(P.rim,.38*I)],[.38,T.color(P.accent,.1*I)],[1,T.color(P.accent,0)]]));g.restore();}g.restore();
          T.glow(g,x,y,W*.43,H*.4,P.accent,.8*I);T.glow(g,x,y,W*.16,H*.13,P.rim,.45*I);
          floor(g,W,H,P,x,I);
        }
        if(name === "mercado") {g.save();g.globalAlpha=.1;const xx=((t*.024)%1)*W;g.fillStyle=linear(g,xx-W*.15,0,xx+W*.15,0,[[0,T.color(P.rim,0)],[.5,P.rim],[1,T.color(P.rim,0)]]);g.fillRect(0,0,W,H);g.restore();}
        if(name !== "archivo") for(const d of dust){const x=(d.x*W+t*W*.002*d.z)%W,y=((d.y*H-t*H*.003*d.z)%H+H)%H;g.globalAlpha=(.12+.38*d.a)*I;ellipse(g,x,y,d.s*st.u*.11,d.s*st.u*.11,P.rim);}g.globalAlpha=1;
        T.finish(g,st,t,P,name === "archivo");g.restore();
      },
      dispose(){layers.forEach(c=>{c.width=c.height=1;});layers.length=0;},
    };
  };
  T.background = (ctx,p,auto="foco") => {
    let scene=null, toned=null, original=null;
    const mode=(!p.bg||p.bg==="auto")?auto:p.bg;
    const presets=Object.fromEntries(T.presets.map(name=>[name,(g,st,t)=>{if(!scene)scene=T.scene(ctx,p,name);scene.render(g,t);} ]));
    const hk=K.hook.bg(ctx,p,{presets,auto,tone(im){if(im!==original){if(toned)toned.width=toned.height=1;original=im;toned=T.tone(im,T.palette(ctx,p).accent,false);}return toned;}});
    return {render(t,b,absolute){hk.render(t,b,absolute);if(mode==="image"||mode==="component")T.finish(ctx.g.main,ctx.stage,t,T.palette(ctx,p));},dispose(){hk.dispose();scene?.dispose();if(toned)toned.width=toned.height=1;}};
  };
  T.tone = (im,color,transparent=true) => {
    const c=T.canvas(im.naturalWidth||im.width,im.naturalHeight||im.height),g=c.getContext("2d");
    g.filter=transparent?"grayscale(1)":"grayscale(1) contrast(1.12)";g.drawImage(im,0,0);g.filter="none";g.globalCompositeOperation="multiply";g.fillStyle=color;g.fillRect(0,0,c.width,c.height);
    // Restaurar alfa con source-atop sobre la imagen original conserva los huecos.
    if(transparent){const out=T.canvas(c.width,c.height),o=out.getContext("2d");o.drawImage(im,0,0);o.globalCompositeOperation="source-atop";o.drawImage(c,0,0);c.width=c.height=1;return out;}return c;
  };
  T.figure = (ctx,p) => {
    const P=T.palette(ctx,p);let c=null,x0=0,y0=0,sw=1,sh=1;
    function prepare(){const im=ctx.img(p.figura);if(!im)return false;c=T.tone(im,P.rim);const g=c.getContext("2d"),data=g.getImageData(0,0,c.width,c.height).data;
    x0=c.width;y0=c.height;let x1=0,y1=0;
    for(let y=0;y<c.height;y+=2)for(let x=0;x<c.width;x+=2)if(data[(y*c.width+x)*4+3]>30){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    sw=Math.max(1,x1-x0+2);sh=Math.max(1,y1-y0+2);return true;}
    return {draw(g,x,bottom,height,t,alpha=1){
      if(!c&&!prepare())return;
      const h=height*(p.escalaFigura??1)*(1+.022*clamp(t/8)),w=h*sw/sh,xx=x+Math.sin(t*.15)*ctx.stage.W*.009;
      g.save();g.globalAlpha=alpha;T.glow(g,xx,bottom-h*.56,w*.95,h*.67,P.accent,.44*(p.intensidad??1));
      T.glow(g,xx,bottom+h*.004,w*.65,h*.035,P.rim,.23);ellipse(g,xx,bottom,w*.46,h*.022,T.color(P.black,.8));
      // Reflejo corto anclado al suelo; el recorte ya es una ilustración completa.
      g.save();g.translate(xx,bottom);g.scale(1,-.16);g.globalAlpha*=.13;g.drawImage(c,x0,y0,sw,sh,-w/2,-h,w,h);g.restore();
      g.drawImage(c,x0,y0,sw,sh,xx-w/2,bottom-h,w,h);g.restore();
    },dispose(){if(c)c.width=c.height=1;c=null;}};
  };
  T.scrim = (g,st,P) => {g.save();g.fillStyle=st.portrait?linear(g,0,0,0,st.H,[[0,T.color(P.black,.4)],[.33,T.color(P.black,.10)],[.5,T.color(P.black,0)]]):linear(g,0,0,st.W,0,[[0,T.color(P.black,.82)],[.48,T.color(P.black,.50)],[.75,T.color(P.black,0)]]);g.fillRect(0,0,st.W,st.H);g.restore();};
  T.text = (g,text,x,y,size,color,{align="left",weight=400,font="Inter",spacing=0,maxWidth}={}) => {g.save();g.font=`${weight} ${size}px ${font}`;g.letterSpacing=spacing+"px";g.textAlign=align;g.textBaseline="alphabetic";g.fillStyle=color;if(maxWidth===undefined)g.fillText(String(text||""),x,y);else g.fillText(String(text||""),x,y,maxWidth);g.restore();};
  T.number = (g,text,x,y,size,color,{font="Inter",weight=900,alpha=1}={}) => {
    g.save();g.font=`${weight} ${size}px ${font}`;g.letterSpacing="0px";g.textBaseline="alphabetic";g.textAlign="center";g.fillStyle=color;g.globalAlpha*=alpha;
    const cell=Math.max(...Array.from("0123456789",n=>g.measureText(n).width));let xx=x;
    for(const ch of String(text)){const advance=/[0-9]/.test(ch)?cell:cell*.5;g.fillText(ch,xx+advance/2,y);xx+=advance;}g.restore();return xx-x;
  };
  T.titleLayout = (g,text,width,maxSize,maxLines=2) => {
    const raw=String(text||"").toUpperCase().trim();let lines=raw.split("\n");
    if(lines.length===1 && raw.includes(" ")) {const words=raw.split(/\s+/);let best=Infinity,split=0;for(let i=1;i<words.length;i++){const a=words.slice(0,i).join(" "),b=words.slice(i).join(" ");g.font=`400 100px Anton`;const m=Math.max(g.measureText(a).width,g.measureText(b).width);if(m<best){best=m;split=i;}}if(raw.length>13&&maxLines>1)lines=[words.slice(0,split).join(" "),words.slice(split).join(" ")];}
    g.font="400 100px Anton";const ratio=Math.max(...lines.map(s=>g.measureText(s).width/100),1),size=Math.min(maxSize,width/ratio);return {lines,size,h:lines.length*size*1.08};
  };
  T.title = (g,L,x,y,t,P,{at=.12,align="left",highlight=-1}={}) => {
    L.lines.forEach((s,i)=>{
      const q=prog(t,at+i*.12,.7,"out"),yy=y+i*L.size*1.08;
      g.save();g.beginPath();g.rect(x-(align==="center"?L.size*12:0),yy-L.size*1.02,L.size*24,L.size*1.13);g.clip();
      const light=clamp((t-at-1.1)/1.05),cx=x+lerp(-L.size*3,L.size*9,light);
      const grad=linear(g,cx-L.size*2,0,cx+L.size*2,0,[[0,i===highlight?P.rim:P.ink],[.5,light>0&&light<1?P.rim:(i===highlight?P.rim:P.ink)],[1,i===highlight?P.rim:P.ink]]);
      T.text(g,s,x,yy+(1-q)*L.size*1.14,L.size,grad,{font:"Anton",align});g.restore();
    });
  };
  T.kicker = (g,text,x,y,size,P,align="left") => T.text(g,String(text||"").toUpperCase(),x,y,size,P.rim,{align,spacing:size*.23,weight:900});
  T.transition = (g,st,kind,coverage,P,seed=41) => {
    const q=clamp(coverage),{W,H}=st;if(q<=0||kind==="ninguna")return;
    g.save();
    if(kind==="golpe") {if(q>.72){g.fillStyle=P.black;g.fillRect(0,0,W,H);}else if(q>.25){g.fillStyle=T.color(P.rim,.23*(q/.72));g.fillRect(0,0,W,H);}}
    else if(kind==="luz") {const x=lerp(-W*.3,W*1.3,q);polygon(g,[[0,0],[x+W*.12,0],[x-W*.12,H],[0,H]],P.black);const v=linear(g,x-W*.16,0,x+W*.08,0,[[0,T.color(P.rim,0)],[.65,T.color(P.rim,.7)],[1,T.color(P.rim,0)]]);g.fillStyle=v;g.fillRect(x-W*.3,0,W*.5,H);}
    else {const x=lerp(-W*.4,W*1.4,q);g.fillStyle=P.black;g.beginPath();g.moveTo(-W,0);g.lineTo(x,0);for(let y=0;y<=H+20;y+=H/90){const d=Math.sin(y/H*16+seed)*W*.075+Math.sin(y/H*43+seed*.7)*W*.036;g.lineTo(x+d,y);}g.lineTo(-W,H);g.closePath();g.fill();for(let i=0;i<17;i++){const y=((i*.618+seed*.013)%1)*H,dx=Math.sin(i*4.9+seed)*W*.11;ellipse(g,x+dx,y,W*(.018+(i%3)*.012),H*(.025+(i%4)*.008),P.black);}}
    g.restore();
  };
  T.edges = (ctx,p,t,b) => {const P=T.palette(ctx,p);T.transition(ctx.g.main,ctx.stage,p.entrada,1-prog(t,0,p.entrada==="golpe"?.20:.62,"inOut"),P,p.semilla);T.transition(ctx.g.main,ctx.stage,p.salida,prog(t,b.dur-.62,.62,"inOut"),P,p.semilla);};
  K.family("titanes",{setup(ctx){for(const key of ["rim","ink","black"])document.documentElement.style.setProperty("--titanes-"+key,ctx.C.palette[key]);return {};},frame(t,ctx){const g=ctx.g.bg;g.fillStyle=ctx.C.palette.black;g.fillRect(0,0,ctx.stage.W,ctx.stage.H);}});
  K.register({name:"titanes.escenario",layer:"main",opaque:true,post:0,tags:["escenario","luz","fondo"],summary:"Siete escenarios con profundidad, luz, grano y paralaje determinista.",example:{escenario:"foco"},params:{...T.params,escenario:{type:"enum",options:T.presets,default:"foco",doc:"Escenario que se dibuja a pantalla completa."}},create(ctx,p){const sc=T.scene(ctx,p,p.escenario);return{render(t){sc.render(ctx.g.main,t);},dispose(){sc.dispose();}};}});
})();
