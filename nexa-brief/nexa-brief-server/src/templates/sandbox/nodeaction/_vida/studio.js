import { drawCharacter, posePreset, VIEWS, EXPRESSIONS, VISEMES, HANDS, BODY_POSES, HAIR, OUTFITS } from './engine/index.js';
import { drawSheetRow, drawGroupSheet, SHEET_ROWS, SHEET_WIDTH, ROW_HEIGHT } from './engine/sheets.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const defaultIds = ['tomas', 'nico', 'valeria', 'mama'];
const characterMap = {};
const addOptions = (id, values) => { for (const value of values) $(id).add(new Option(value, value)); };
let running = true, time = 0, previous = null, pointer = null;
try {
  // El estudio sigue disponible con el elenco original si falta el catálogo.
  let extraIds = [];
  try {
    const response = await fetch('./catalog.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    if (!Array.isArray(catalog.characters)) throw new Error('characters no es una lista');
    extraIds = catalog.characters.map(entry => entry?.name)
      .filter(id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id) && !defaultIds.includes(id));
    extraIds = [...new Set(extraIds)];
  } catch (error) { console.warn('Catálogo no disponible; se usa el elenco original.', error); }
  async function loadCharacter(id) {
    const response = await fetch(`./characters/${id}.json`);
    if (!response.ok) throw new Error(`No se pudo cargar ${id}: ${response.status}`);
    const character = await response.json();
    if (character.id !== id) throw new Error(`El id de ${id} no coincide con su archivo`);
    return character;
  }
  const characters = await Promise.all(defaultIds.map(loadCharacter));
  // Una entrada desactualizada no debe impedir abrir el resto del estudio.
  const extras = await Promise.all(extraIds.map(async id => {
    try { return await loadCharacter(id); }
    catch (error) { console.warn(`No se pudo cargar ${id} del catálogo.`, error); return null; }
  }));
  characters.push(...extras.filter(Boolean));
  for (const c of characters) { characterMap[c.id] = c; $('character').add(new Option(c.name, c.id)); }
  // Catalog demos can preview a trait without editing or mutating a character card.
  const demo = characterMap[params.get('character') ?? 'tomas'];
  if (demo) {
    if (HAIR.includes(params.get('hair'))) demo.hair = { ...demo.hair, style: params.get('hair') };
    if (OUTFITS.includes(params.get('outfit'))) demo.outfit = { ...demo.outfit, style: params.get('outfit') };
    if (['forward', 'backward'].includes(params.get('cap'))) demo.accessories = { ...demo.accessories, cap: params.get('cap'), capColor: '#5886bf' };
  }
  const sheetId = params.get('sheet');
  if (sheetId) {
    document.body.classList.add('sheet');
    const heading = document.createElement('p');
    const back = document.createElement('a'); back.href = `./studio.html?character=${encodeURIComponent(sheetId)}`; back.textContent = '← Volver al estudio'; heading.append(back); $('sheet').append(heading);
    if (sheetId === 'group') {
      const canvas = document.createElement('canvas'); canvas.width = 3840; canvas.height = 2160;
      drawGroupSheet(canvas.getContext('2d'), characters); $('sheet').append(canvas);
    } else {
      const character = characterMap[sheetId]; if (!character) throw new Error(`Personaje desconocido: ${sheetId}`);
      for (let i = 0; i < SHEET_ROWS.length; i++) {
        const canvas = document.createElement('canvas'); canvas.width = SHEET_WIDTH; canvas.height = ROW_HEIGHT;
        canvas.setAttribute('aria-label', SHEET_ROWS[i].title); drawSheetRow(canvas.getContext('2d'), character, i); $('sheet').append(canvas);
      }
    }
    document.documentElement.dataset.ready = 'true';
  } else {
    addOptions('view', Object.keys(VIEWS)); addOptions('expression', Object.keys(EXPRESSIONS));
    addOptions('viseme', [...VISEMES, 'A→O']); addOptions('pose', ['idle', ...BODY_POSES]); addOptions('hand', HANDS);
    for (const key of ['character', 'expression', 'view', 'viseme', 'pose', 'hand']) {
      if (params.has(key) && [...$(key).options].some(o => o.value === params.get(key))) $(key).value = params.get(key);
    }
    if (!params.has('expression')) $('expression').value = characterMap[$('character').value].face.expression;
    $('yaw').value = VIEWS[$('view').value];
    if (params.has('t')) { time = Math.max(0, Math.min(20, Number(params.get('t')) || 0)); running = false; }
    const canvas = $('canvas'), ctx = canvas.getContext('2d');
    function render() {
      const character = characterMap[$('character').value], close = $('framing').value === 'close';
      ctx.fillStyle = '#faf8f2'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = close ? 2450 : 1050, y = close ? 630 + .796 * scale * character.height : 1280;
      const pose = posePreset($('pose').value, { x: 540, y, scale, view: Number($('yaw').value) });
      if ($('hand').value) pose.handShapes.right = $('hand').value;
      if ($('secondary').checked) pose.secondary = { at: 0, amplitude: .32, frequency: 2, damping: .35 };
      const blink = { auto: 'auto', off: false, half: .5, closed: 1 }[$('blink').value];
      const viseme = $('viseme').value === 'A→O' ? { from: 'A', to: 'O', mix: Number($('mix').value) } : $('viseme').value;
      drawCharacter(ctx, character, pose, { expression: $('expression').value, intensity: Number($('intensity').value),
        eyeScale: Number($('eyeScale').value), blink, closeUp: close, viseme, open: Number($('open').value),
        lookAt: $('look').checked ? pointer : null }, time);
      $('time').value = time; $('clock').value = `${time.toFixed(2)} s`;
      $('play').textContent = running ? 'Pausar' : 'Reproducir'; $('play').setAttribute('aria-label', $('play').textContent);
      $('sheetLink').href = `?sheet=${character.id}`;
      $('status').textContent = `${character.name} · ${$('expression').value} · ${Math.round(Number($('yaw').value) * 90)}°`;
    }
    $('controls').addEventListener('submit', event => event.preventDefault());
    $('controls').addEventListener('input', event => {
      if (event.target.id === 'view') $('yaw').value = VIEWS[$('view').value];
      if (event.target.id === 'character') $('expression').value = characterMap[$('character').value].face.expression;
      render();
    });
    $('play').onclick = () => { running = !running; previous = null; render(); };
    $('time').oninput = () => { time = Number($('time').value); running = false; previous = null; render(); };
    $('reset').onclick = () => { $('controls').reset(); $('expression').value = characterMap[$('character').value].face.expression; time = 0; previous = null; render(); };
    canvas.onpointermove = event => {
      const rect = canvas.getBoundingClientRect(); pointer = [(event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height];
      if ($('look').checked) render();
    };
    $('download').onclick = () => { const link = document.createElement('a'); link.download = `${$('character').value}-${time.toFixed(2)}.png`; link.href = canvas.toDataURL('image/png'); link.click(); };
    // Wall clock lives only in the interactive studio. The engine receives explicit t.
    function frame(timestamp) {
      if (running && previous !== null) { time = (time + (timestamp - previous) / 1000) % 20; render(); }
      previous = timestamp; requestAnimationFrame(frame);
    }
    render(); requestAnimationFrame(frame); document.documentElement.dataset.ready = 'true';
  }
} catch (error) {
  $('error').hidden = false; $('error').textContent = error.message; document.documentElement.dataset.ready = 'error';
}
