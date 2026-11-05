/* Cara a Cara: composición vertical opt-in sobre el reproductor Proto compartido. */
// El perfil se resuelve desde el motor, también al reutilizarlo en otro video.
const nexaComparisonProfileUrl = new URL("profiles/leo.json", document.currentScript.src);
(async () => {
  "use strict";
  const response = await fetch(nexaComparisonProfileUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Perfil de Leo no disponible: HTTP ${response.status}`);
  const profile = await response.json();
  if (profile.schema_version !== 1 || profile.id !== "leo-comparaciones-v1") throw new Error("Perfil de Leo incompatible");
  const { video, typography, layout: spec } = profile;
  const W = video.width, H = video.height, FONT = typography.ui;
  const heading = typography.headline, labels = typography.labels;
  const accentDefault = video.accent;
  const mobileScale = W / video.reference_mobile_width;
  const layout = { side: spec.side_mobile_px * mobileScale, gap: spec.column_gap_mobile_px * mobileScale, cardH: spec.card_height, avatarH: spec.avatar_height, captionSize: typography.captions.size };
  layout.avatarY = H - spec.avatar_bottom_mobile_px * mobileScale - layout.avatarH;
  layout.captionY = layout.avatarY - spec.caption_avatar_gap_mobile_px * mobileScale - layout.captionSize / 2;
  layout.cardY = layout.captionY - layout.captionSize / 2 - spec.card_caption_gap_mobile_px * mobileScale - layout.cardH - spec.card_raise_mobile_px * mobileScale;
  layout.cardW = (W - layout.side * 2 - layout.gap) / 2;
  const captionStyle = { ...typography.captions, y: layout.captionY / H };
  const qs = new URLSearchParams(location.search);
  function nativeCanvas(c) {
    const canvas = c.g.canvas;
    canvas.width = W; canvas.height = H;
    canvas.style.width = "100vw"; canvas.style.height = "100vh";
    canvas.style.objectFit = "contain"; canvas.style.objectPosition = "center";
    c.st.W = W; c.st.H = H; c.st.U = 1;
  }
  function fitText(g, text, maxWidth, maxSize, minSize, weight = 800, font = FONT) {
    let size = maxSize;
    do { g.font = `${weight} ${size}px ${font}`; if (g.measureText(text).width <= maxWidth) break; size -= 2; } while (size > minSize);
    return size;
  }
  function round(g, x, y, w, h, r, color) {
    g.fillStyle = color; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
  }
  function picture(g, im, x, y, w, h, fit = "contain", crop) {
    if (!im || !im.naturalWidth || !im.naturalHeight) return false;
    const c = crop || [0, 0, 1, 1];
    let sx = c[0]*im.naturalWidth, sy = c[1]*im.naturalHeight, sw = c[2]*im.naturalWidth, sh = c[3]*im.naturalHeight;
    if (!(sw > 0 && sh > 0)) return false;
    if (fit === "cover") {
      const a = w / h;
      if (sw / sh > a) { const nw = sh * a; sx += (sw - nw) / 2; sw = nw; }
      else { const nh = sw / a; sy += (sh - nh) / 2; sh = nh; }
      g.drawImage(im, sx, sy, sw, sh, x, y, w, h);
    } else {
      const k = Math.min(w/sw, h/sh), dw = sw*k, dh = sh*k;
      g.drawImage(im, sx, sy, sw, sh, x + (w-dw)/2, y + (h-dh)/2, dw, dh);
    }
    return true;
  }
  function drawCard(g, subject, x, y, w, h, img, selected, accent) {
    // El nombre queda fuera de la tarjeta; el interior se reserva a imagen o video.
    const title = String(subject.title || "").toUpperCase();
    fitText(g, title, w-16, labels.max_size, labels.min_size, labels.weight, labels.font);
    g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(title, x+w/2, y-labels.offset_y, w-16);
    round(g, x, y, w, h, 22, subject.background || "#fff");
    g.save(); g.beginPath(); g.roundRect(x+10,y+10,w-20,h-20,14); g.clip();
    picture(g, img, x+12,y+12,w-24,h-24,subject.fit || "contain",subject.crop);
    g.restore();
    g.save(); g.strokeStyle = accent; g.lineWidth = selected ? 9 : 7;
    g.beginPath(); g.roundRect(x+4,y+4,w-8,h-8,19); g.stroke(); g.restore();
  }
  function drawHeadline(g, text) {
    const words = String(text).toUpperCase().split(/\s+/).filter(Boolean);
    const maxWidth = W - 2 * layout.side;
    let size = heading.max_size, lines = [words.join(" ")];
    for (;size>=heading.min_size;size-=heading.size_step) {
      g.font = `${heading.weight} ${size}px ${heading.font}`;
      if (g.measureText(lines[0]).width<=maxWidth && lines.length===1) break;
      let best = null;
      for (let i=1;i<words.length;i++) {
        const a=words.slice(0,i).join(" "), b=words.slice(i).join(" ");
        const wa=g.measureText(a).width, wb=g.measureText(b).width;
        if (Math.max(wa,wb)<=maxWidth && (!best || Math.abs(wa-wb)<best.delta)) best={a,b,delta:Math.abs(wa-wb)};
      }
      if (best) { lines=[best.a,best.b]; break; }
    }
    g.fillStyle="#111";g.textAlign="center";g.textBaseline="middle";
    lines.forEach((line,i)=>g.fillText(line,W/2,lines.length===1?heading.one_line_y:heading.two_line_y+i*heading.line_height,maxWidth));
  }
  function currentShot(S, t) {
    let result = null;
    for (const shot of S.shots) { if (shot._t > t) break; result = shot; }
    return result || S.shots[0];
  }
  function mergeSubjects(scene, shot) {
    const base = scene.subjects || [];
    if (!shot.subjects) return base;
    return shot.subjects.map((s, i) => ({ ...(base.find(b => b.id === s.id) || base[i] || {}), ...s }));
  }
  function visibleSubjects(scene, shot) {
    const subjects = mergeSubjects(scene, shot);
    if (shot.mode !== "single") return subjects.slice(0, 2);
    const index = shot.focus === "right" ? 1 : 0;
    return subjects.length > 1 ? [subjects[index] || subjects[0]] : subjects;
  }
  function cardMediaItems(c, data, shots) {
    const inset = spec.card_media_inset, result = [];
    const end = c.T(c.scene.end, c.words.at(-1)?.end || 60);
    for (const raw of data.items || []) {
      const at = c.T(raw.at, NaN);
      const until = raw.until != null ? c.T(raw.until, NaN) : at + Number(raw.dur);
      if (!Number.isFinite(at) || !Number.isFinite(until) || until <= at) throw new Error("Intervalo de medio inválido");
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i], start = Math.max(at, shot._t), stop = Math.min(until, shots[i+1]?._t ?? end, end);
        if (stop <= start) continue;
        const subjects = mergeSubjects(c.scene, shot), visible = visibleSubjects(c.scene, shot);
        const target = raw.subject || (raw.slot === "left" ? subjects[0]?.id : raw.slot === "right" ? subjects[1]?.id : null);
        const index = target ? visible.findIndex(s => s.id === target) : visible.length === 1 ? 0 : -1;
        if (index < 0) continue;
        const width = visible.length === 1 ? W - layout.side * 2 : layout.cardW;
        const left = layout.side + (visible.length === 1 ? 0 : index * (layout.cardW + layout.gap));
        const mediaW = width - inset * 2, mediaH = layout.cardH - inset * 2;
        result.push({
          ...raw, at: start, dur: stop-start, embedded: true,
          // Al ampliar una tarjeta el clip continúa desde el mismo instante de origen.
          start: Math.max(0, Number(raw.start) || 0) + (raw.kind === "video" ? start-at : 0),
          x: 100*(left+inset)/W, y: 100*(layout.cardY+inset)/H,
          w: 100*mediaW/W, h: 100*mediaH/H, aspect: `${(mediaW/mediaH).toFixed(6)}:1`,
        });
      }
    }
    return result;
  }
  function selectedCharacter(scene, shot) {
    const avatar = scene.avatar || {}, id = qs.get("character") || shot.character || avatar.defaultCharacter;
    return { ...avatar, ...((avatar.characters || {})[id] || {}) };
  }
  await Proto.run({
    name: "comparacion",
    fonts: [heading, labels, typography.captions].map(f => `${f.weight} ${f.max_size || f.size}px ${f.font}`),
    theme: {
      captions: captionStyle,
      outro: { enabled: false },
      heavy: "800 $px DM Sans", ui: FONT, accent: accentDefault,
      word(g, s, x, y, size, color, center) { g.fillStyle = color; g.textAlign = center ? "center" : "left"; g.fillText(s, x, y); },
    },
    async setup(c) {
      nativeCanvas(c);
      const scene = c.scene;
      if (scene.profile_id && scene.profile_id !== profile.id) throw new Error("La escena requiere otro perfil de personaje");
      // La identidad visual y el personaje vienen del perfil; el video aporta el contenido.
      scene.captions = { ...captionStyle };
      const characterData = structuredClone(profile.avatar);
      for (const character of Object.values(characterData.characters)) {
        character.src = new URL(character.src, nexaComparisonProfileUrl).href;
        // Una pose puede vivir en otra lámina sin reemplazar las poses anteriores.
        for (const pose of Object.values(character.poses || {})) {
          if (pose && !Array.isArray(pose) && typeof pose.src === "string")
            pose.src = new URL(pose.src, nexaComparisonProfileUrl).href;
        }
      }
      scene.avatar = { ...scene.avatar, ...characterData };
      const shots = (scene.shots || []).map(s => ({ ...s, _t: c.T(s.t, 0) })).sort((a,b) => a._t-b._t);
      c.S = { shots: shots.length ? shots : [{ _t: 0, mode: "duo" }] };
      const overlaysUrl = qs.get("overlays") || c.C.overlaysUrl || "assets/overlays.json";
      const mediaResponse = await fetch(overlaysUrl);
      if (!mediaResponse.ok) throw new Error(`Medios no disponibles: HTTP ${mediaResponse.status}`);
      const media = await mediaResponse.json();
      media.items = cardMediaItems(c, media, c.S.shots);
      // Usar el reproductor de medios de Proto, también con ?overlays= del visor.
      // La geometría se calcula en memoria; no se crean frames ni copias del clip.
      c.mediaWindows = media;
      const av = scene.avatar || {};
      c.S.timeline = (av.timeline || []).map(p => ({ ...p, _t: c.T(p.at, 0) })).sort((a,b) => a._t-b._t);
      const urls = new Set();
      const add = x => { if (x && x.src) urls.add(x.src); };
      (scene.subjects || []).forEach(add);
      c.S.shots.forEach(s => (s.subjects || []).forEach(add));
      add(av);
      for (const character of Object.values(av.characters || {})) {
        add(character);
        for (const pose of Object.values(character.poses || {}))
          if (pose && !Array.isArray(pose)) add(pose);
      }
      await Promise.all([...urls].map(src => c.loadImg(src)));
    },
    resize: nativeCanvas,
    shots: c => c.S.shots.map(s => s._t),
    render(c, t) {
      const { g, st, scene, S } = c, bg = video.background, accent = accentDefault;
      g.fillStyle = bg; g.fillRect(0,0,st.W,st.H);
      const sc = Math.min(st.W/W, st.H/H);
      g.setTransform(sc,0,0,sc,(st.W-W*sc)/2,(st.H-H*sc)/2);
      const shot = currentShot(S,t), visible = visibleSubjects(scene,shot);
      // Pregunta, tarjetas, subtítulos y avatar comparten el mismo eje central.
      drawHeadline(g,shot.headline || "COMPARACIÓN");
      const { cardY, cardH, cardW, gap, side: left } = layout;
      // Márgenes iguales; la tarjeta única ocupa ambas columnas y su separación.
      if (visible.length === 1) drawCard(g,visible[0],left,cardY,cardW*2+gap,cardH,c.img(visible[0].src),true,accent);
      else visible.forEach((subject,i)=>drawCard(g,subject,left+i*(cardW+gap),cardY,cardW,cardH,c.img(subject.src),(shot.focus==="left"&&i===0)||(shot.focus==="right"&&i===1),accent));
      // Avatar de poses recortadas; el tiempo y el movimiento dependen solo de t.
      const av = selectedCharacter(scene,shot); let pose = shot.pose;
      for (const p of S.timeline) if (p._t <= t && (p._t >= shot._t || !pose)) pose = p.pose;
      pose = pose || Object.keys(av.poses || {})[0];
      const selectedPose = (av.poses || {})[pose];
      const src = selectedPose && !Array.isArray(selectedPose) ? selectedPose.src : av.src;
      const crop = Array.isArray(selectedPose) ? selectedPose : selectedPose?.crop;
      // Una pose ausente no debe mostrar la lámina completa por accidente.
      if (src && Array.isArray(crop) && crop.length === 4)
        picture(g,c.img(src),(W-spec.avatar_width)/2,layout.avatarY,spec.avatar_width,layout.avatarH,"contain",crop);
    },
  });
})().catch(e => {
  console.error("[comparacion]", e);
  const message = document.createElement("p"); message.setAttribute("role", "alert");
  message.textContent = "No se pudo cargar la comparación: " + e.message;
  document.body.appendChild(message);
});
