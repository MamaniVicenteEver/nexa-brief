import {Tactico} from '../core.js';
import {readJSON} from '../tools/io.js';

const root = new URL('../../../', import.meta.url);
const clamp = x => Math.max(0, Math.min(1, x));
const back = k => { k = clamp(k); return 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); };
let fontReady;
async function font() {
  if (typeof FontFace === 'undefined') return;
  return fontReady ||= (async () => {
    if ([...document.fonts].some(f => f.family === 'AtlasDisplay')) return;
    const face = new FontFace('AtlasDisplay', `url(${new URL('../../../../../../_tools/explainer-kit/vendor/fonts/Archivo-900.ttf', import.meta.url)})`, {weight:'800 900'});
    document.fonts.add(await face.load());
  })();
}

// Literal grouping and timing rules from Proto.buildCaptions (187–199).
// Preserve punctuation-driven groups, gaps and the final 0.6 s hold.
export function buildTranscript(words, end, cfg = {}) {
  const max = cfg.maxWords || 3, gap = cfg.gap ?? .45, caps = [];
  let cur = [];
  const flush = () => {
    if (cur.length) caps.push({t0:cur[0].start, t1:cur.at(-1).end,
      text:cur.map(w => w.word.trim()).join(' ').replace(/[.,;:¿?¡!]+$/g, ''), words:cur});
    cur = [];
  };
  for (const w of words) {
    if (w.start > end) break;
    if (cur.length && (cur.length >= max || w.start - cur.at(-1).end > gap)) flush();
    cur.push(w); if (/[.,;:?!]$/.test(w.word.trim())) flush();
  }
  flush();
  caps.forEach((c, i) => { c.t1 = Math.min(i + 1 < caps.length ? caps[i + 1].t0 : c.t1 + .6, c.t1 + .6); });
  return caps;
}

export function drawTranscript(g, st, caps, t, cfg = {}) {
  if (cfg.enabled === false) return;
  const c = caps.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  const land = st.W > st.H, U = Math.min(st.W, st.H) / 1080;
  const reduction = Math.max(0, Math.min(95, cfg.reductionPercent ?? 0));
  const size = (cfg.size || 45) * (1 - reduction / 100) * U * (land ? 1.1 : 1);
  const y = st.H * (land ? cfg.yLandscape ?? .915 : cfg.y ?? .9) + (land ? cfg.yOffsetLandscape ?? 0 : 0) * U;
  const text = cfg.upper === false ? c.text : c.text.toUpperCase(), k = back((t - c.t0) / .18);
  g.save();g.font = `${cfg.weight || 800} ${size}px ${cfg.font || 'AtlasDisplay, sans-serif'}`;
  g.textAlign = 'center';g.textBaseline = 'middle';g.translate(st.W / 2, y);
  const scale = .85 + .15 * k;g.scale(scale, scale);
  if (cfg.background) {
    const pad = (cfg.padding ?? 12) * U, w = g.measureText(text).width;
    g.fillStyle = cfg.background;g.beginPath();g.roundRect(-w / 2 - pad, -size * .65 - pad, w + pad * 2, size * 1.3 + pad * 2, (cfg.radius ?? 0) * U);g.fill();
  }
  const paint = (value, x, fill) => {
    if (cfg.stroke !== false) {
      g.lineJoin = 'round';g.lineWidth = cfg.strokeWidth != null ? cfg.strokeWidth * U * (land ? 1.1 : 1) : size * .22;
      g.strokeStyle = cfg.strokeColor || '#000';g.strokeText(value, x, 0);
    }
    g.fillStyle = fill;g.fillText(value, x, 0);
  };
  const fill = cfg.color || '#ffffff';
  if (!cfg.highlight || cfg.highlight === 'none') paint(text, 0, fill);
  else {
    const pieces = c.text.split(' '), space = g.measureText(' ').width;
    const values = pieces.map(w => cfg.upper === false ? w : w.toUpperCase());
    let x = -g.measureText(text).width / 2;g.textAlign = 'left';
    values.forEach((value, n) => {
      const w = c.words[n], active = cfg.highlight === 'progress' ? t >= w.start : t >= w.start && t < w.end;
      paint(value, x, active ? cfg.activeColor || fill : cfg.inactiveColor || fill);
      x += g.measureText(value).width + space;
    });
  }
  g.restore();
}

Tactico.component('caption.transcript', {
  layer:100, summary:'Transcripción configurable: blanco con borde negro, reducción predeterminada 35,6 %, +10 U en horizontal y enabled true/false; entrada original de 0,18 s.',
  params:{enabled:{type:'boolean',default:true},reductionPercent:{type:'number',default:35.6,min:0,max:95},yOffsetLandscape:{type:'number',default:10,min:-200,max:200},lyricsUrl:{type:'string',default:'assets/lyrics.json'},color:{type:'string',default:'#ffffff'},activeColor:{type:'string',default:'#ffffff'},inactiveColor:{type:'string',default:'#ffffff'},stroke:{type:'boolean',default:true},strokeColor:{type:'string',default:'#000000'},strokeWidth:{type:'number',default:null,min:0,max:100},font:{type:'string',default:'AtlasDisplay, sans-serif'},weight:{type:'number',default:800,min:100,max:1000},size:{type:'number',default:45,min:1,max:200},upper:{type:'boolean',default:true},y:{type:'number',default:.9,min:0,max:1},yLandscape:{type:'number',default:.915,min:0,max:1},maxWords:{type:'number',default:3,min:1,max:30},gap:{type:'number',default:.45,min:0,max:10},highlight:{type:'enum',values:['none','word','progress'],default:'none'},background:{type:'string',default:''},padding:{type:'number',default:12,min:0,max:100},radius:{type:'number',default:0,min:0,max:100},timeOffset:{type:'number',default:0},fade:{type:'number',default:0}},
  states:[],
  validate(i){return [...(i.reductionPercent!=null&&(!Number.isFinite(i.reductionPercent)||i.reductionPercent<0||i.reductionPercent>95)?['reductionPercent debe estar entre 0 y 95']:[]),...(i.enabled!=null&&typeof i.enabled!=='boolean'?['enabled debe ser true o false']:[]),...(i.yOffsetLandscape!=null&&(!Number.isFinite(i.yOffsetLandscape)||Math.abs(i.yOffsetLandscape)>200)?['yOffsetLandscape debe estar entre -200 y 200']:[]),...(!Number.isInteger(i.maxWords ?? 3)?['maxWords debe ser entero']:[]),...(/^(?:[a-z]+:|\/\/|\/)/i.test(i.lyricsUrl??'') || (i.lyricsUrl??'').split('/').includes('..') ? ['lyricsUrl debe ser local a la plantilla']:[])];},
  async prepare(i,c){
    await font();
    const useContext = c.words?.length && (!i.lyricsUrl || i.lyricsUrl === 'assets/lyrics.json');
    const data = useContext ? null : await readJSON(new URL(i.lyricsUrl || 'assets/lyrics.json', root));
    const words = (useContext ? c.words : (data.segments || []).flatMap(s => s.words || [])).filter(w => w && isFinite(w.start));
    return {caps:buildTranscript(words, c.scene.end ?? c.scene.duration ?? Infinity, i)};
  },
  draw(g,s,v,e){drawTranscript(g,e,s.internal.caps,s.t+(s.item.timeOffset??0),s.item);},
  demo:{id:'demo-transcript',type:'caption.transcript',t:0,dur:14,fade:0,lyricsUrl:'assets/lyrics.json'},
});
