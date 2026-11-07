const query = new URLSearchParams(location.search);
const status = document.getElementById('status');
const canvas = document.getElementById('preview');
const context = canvas.getContext('2d');
const still = query.has('still') || query.get('autoplay') === '0';
const ready = () => { status.hidden = true; document.documentElement.dataset.ready = 'true'; parent.postMessage({type:'nexa-animation-ready'}, location.origin); };

async function boot() {
  const response = await fetch('showcase/components.json');
  if (!response.ok) throw new Error('No se pudo cargar la biblioteca.');
  const {components} = await response.json();
  const item = components.find(c => c.name === query.get('only'));
  if (!item) throw new Error('Componente desconocido.');
  const example = item.preview;
  if (example.kind === "guide") {
    const poster = new Image();
    poster.src = example.poster;
    await poster.decode();
    canvas.width = 960; canvas.height = 540;
    context.drawImage(poster, 0, 0, canvas.width, canvas.height);
    ready();
    return;
  }
  const childUrl = new URL("showcase-preview.html", location.href);
  childUrl.searchParams.set('t', String(example.time || 0));
  if (example.pose) childUrl.searchParams.set('pose', example.pose);
  if (example.character) childUrl.searchParams.set('character', example.character);
  if (example.sample) childUrl.searchParams.set('sample', example.sample);
  const frame = document.createElement('iframe');
  frame.title = item.name;
  frame.src = childUrl.href;
  document.body.append(frame);
  const deadline = performance.now() + 30000;
  await new Promise((resolve, reject) => {
    function check() {
      try {
        if (frame.contentWindow?.__promo && frame.contentDocument?.querySelector('canvas')) return resolve();
        const error = frame.contentDocument?.querySelector('[role="alert"]');
        if (error) return reject(new Error(error.textContent));
      } catch (error) { return reject(error); }
      if (performance.now() > deadline) return reject(new Error('La vista previa tardó demasiado en cargar.'));
      requestAnimationFrame(check);
    }
    requestAnimationFrame(check);
  });
  const child = frame.contentWindow;
  const source = frame.contentDocument.querySelector('canvas');
  const crop = example.crop || [0, 0, 1080, 1920];
  const vertical = query.get('aspect') === '9x16';
  canvas.width = vertical ? 540 : 960;
  canvas.height = vertical ? 960 : 540;
  const background = query.get('bg');
  function paint() {
    context.fillStyle = background === 'dark' ? '#202020' : '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / crop[2], canvas.height / crop[3]);
    const width = crop[2] * scale, height = crop[3] * scale;
    context.drawImage(source, ...crop, (canvas.width-width)/2, (canvas.height-height)/2, width, height);
  }
  async function draw(time) { await child.__promo.seek(time); paint(); }
  const start = Number(example.time) || 0;
  // La carga inicial del motor puede preparar el mismo instante en paralelo.
  // Una segunda búsqueda garantiza que el cuadro del video ya esté dibujado.
  const point = query.get("framePosition");
  const offset = point === "middle" ? .5 : point === "last" ? .98 : 0;
  const stillTime = start + (Number(example.duration) || 0) * offset;
  await child.__promo.seek(still ? stillTime : start);
  await draw(still ? stillTime : start);
  ready();
  if (!still && example.duration) {
    // Para ejemplos sin audio el reloj pertenece al Showcase y solo avanza la escena.
    const playWithoutAudio = () => {
      const epoch = performance.now();
      let busy = false, previous = 0;
      async function frameLoop(now) {
        if (!busy && now - previous > 100) {
          busy = true; previous = now;
          try { await draw(start + ((now - epoch) / 1000) % example.duration); }
          finally { busy = false; }
        }
        requestAnimationFrame(frameLoop);
      }
      requestAnimationFrame(frameLoop);
    };
    const audio = frame.contentDocument.querySelector('audio');
    if (!audio?.getAttribute('src')) { playWithoutAudio(); return; }
    try {
      audio.muted = true;
      if (audio.readyState < 1) await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Audio no disponible')), 5000);
        audio.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(); }, {once:true});
        audio.load();
      });
      audio.currentTime = start;
      await audio.play();
      child.__promo.release();
      let previous = 0;
      function frameLoop(now) {
        if (audio.currentTime >= start + example.duration) audio.currentTime = start;
        if (now - previous > 100) { paint(); previous = now; }
        requestAnimationFrame(frameLoop);
      }
      requestAnimationFrame(frameLoop);
    } catch (_) { playWithoutAudio(); }
  }
}
boot().catch(error => { status.hidden = false; status.setAttribute('role','alert'); status.textContent = error.message; document.documentElement.dataset.ready = 'error'; parent.postMessage({type:'nexa-animation-error'}, location.origin); console.error(error); });
