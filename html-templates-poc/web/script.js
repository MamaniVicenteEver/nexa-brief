/* ═══════════════════════════════════════════════════════════════════════
   Nexa Brief — dashboard prototype
   Todo el contenido (canales, cuentas, plantillas, videos, horarios,
   historial) se lee de data.json. Bajo file:// el fetch() de JSON local
   está bloqueado por CORS, así que si falla se usa window.NEXA_DATA
   (cargado por data.js, mismo contenido).
   ═══════════════════════════════════════════════════════════════════════ */

let DATA = null;

const ICONS = {
  youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="4"/><path d="M10 9l6 3-6 3V9z" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M13.2 21v-7h2.1l.3-2.6h-2.4V9.7c0-.75.2-1.26 1.28-1.26h1.37V6.1c-.24-.03-1.05-.1-2-.1-1.97 0-3.33 1.2-3.33 3.4v1.9H8v2.6h2.5V21"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="5 12 10 17 19 7"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>',
  chevron: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M10 8l6 4-6 4V8z" fill="currentColor" stroke="none"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
};

const ACTIVITY_ICON = { ok: ICONS.check, ready: ICONS.film, error: ICONS.cross, new: ICONS.plus };

function escapeHtml(str) {
  return str.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function channelById(id) {
  return DATA.channels.find((c) => c.id === id);
}

function channelLabel(id) {
  const c = channelById(id);
  return c ? c.label : id;
}

/* ── Carga de datos ──────────────────────────────────────────────────── */

async function loadData() {
  try {
    const res = await fetch('./data.json');
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } catch (e) {
    // fetch() a archivos locales falla bajo file:// (CORS) — se usa el
    // respaldo cargado por data.js.
    return window.NEXA_DATA;
  }
}

/* ── Render: Dashboard ───────────────────────────────────────────────── */

const STAT_CATEGORIES = [
  { cat: 'hoy', label: 'Videos hoy', headerLabel: 'Videos de hoy' },
  { cat: 'cola', label: 'En cola', headerLabel: 'En cola' },
  { cat: 'publicados', label: 'Publicados', headerLabel: 'Publicados' },
  { cat: 'fallidos', label: 'Fallidos', headerLabel: 'Fallidos' },
];

const DRILLDOWN_PAGE_SIZE = 5;
let selectedStatCategory = null;
let drilldownPage = 1;

function renderStats(stats) {
  const el = document.getElementById('statsGrid');
  const values = { hoy: stats.videosHoy, cola: stats.enCola, publicados: stats.publicados, fallidos: stats.fallidos };
  const deltas = { hoy: stats.videosHoyDelta, cola: stats.enColaMeta, publicados: stats.publicadosMeta, fallidos: stats.fallidosMeta };

  el.innerHTML = STAT_CATEGORIES.map((s) => `
    <button type="button" class="card stat-card" data-category="${s.cat}" onclick="selectStatCategory('${s.cat}')">
      <span class="filter-indicator">Filtrando ✓</span>
      <div class="label">${s.label}</div>
      <div class="value">${values[s.cat]}</div>
      <div class="delta">${deltas[s.cat]}</div>
    </button>`).join('');
}

function selectStatCategory(category) {
  selectedStatCategory = selectedStatCategory === category ? null : category;
  drilldownPage = 1;
  updateDashboardActivityView();
}

function resetDashboardActivity() {
  selectedStatCategory = null;
  updateDashboardActivityView();
}

function updateDashboardActivityView() {
  document.querySelectorAll('.stat-card').forEach((c) => c.classList.toggle('selected', c.dataset.category === selectedStatCategory));

  const generic = document.getElementById('activityList');
  const drill = document.getElementById('drilldownWrap');
  const header = document.getElementById('activityHeader');

  if (!selectedStatCategory) {
    generic.style.display = '';
    drill.style.display = 'none';
    header.textContent = 'Actividad reciente';
    return;
  }

  generic.style.display = 'none';
  drill.style.display = '';
  header.textContent = STAT_CATEGORIES.find((s) => s.cat === selectedStatCategory).headerLabel;
  renderDrilldownPage();
}

function renderDrilldownPage() {
  const list = (DATA.dashboardLists && DATA.dashboardLists[selectedStatCategory]) || [];
  const totalPages = Math.max(1, Math.ceil(list.length / DRILLDOWN_PAGE_SIZE));
  drilldownPage = Math.min(Math.max(1, drilldownPage), totalPages);

  const start = (drilldownPage - 1) * DRILLDOWN_PAGE_SIZE;
  const pageItems = list.slice(start, start + DRILLDOWN_PAGE_SIZE);

  document.getElementById('drilldownRows').innerHTML = pageItems.length
    ? pageItems.map((row) => `
        <div class="drill-row">
          <div class="drill-title">${row.title}</div>
          <div class="drill-channels">${
            row.channel && row.channel.length
              ? row.channel.map((c) => `<span class="channel-chip">${channelLabel(c)}</span>`).join('')
              : '<span class="drill-empty">— sin canal aún —</span>'
          }</div>
          <div class="drill-time">${row.time}${row.meta ? `<div class="drill-meta">${row.meta}</div>` : ''}</div>
          <button class="btn btn-ghost btn-sm" onclick="goToBibliotecaTab('${row.tab}')">Ir →</button>
        </div>`).join('')
    : `<div class="empty-state">Sin videos en esta categoría todavía.</div>`;

  document.getElementById('drilldownPagination').innerHTML = `
    <button class="btn btn-secondary btn-sm" ${drilldownPage <= 1 ? 'disabled' : ''} onclick="changeDrilldownPage(-1)">‹ Anterior</button>
    <span class="page-info">Página ${drilldownPage} de ${totalPages}</span>
    <button class="btn btn-secondary btn-sm" ${drilldownPage >= totalPages ? 'disabled' : ''} onclick="changeDrilldownPage(1)">Siguiente ›</button>`;
}

function changeDrilldownPage(delta) {
  drilldownPage += delta;
  renderDrilldownPage();
}

function goToBibliotecaTab(tab) {
  goTo('biblioteca');
  const tabBtn = document.querySelector(`.tab[data-tab="${tab}"]`);
  if (tabBtn) tabBtn.click();
}

function renderActivity(activity) {
  const el = document.getElementById('activityList');
  el.innerHTML = activity.map((a) => `
    <div class="activity-row">
      <div class="icon">${ACTIVITY_ICON[a.type] || ICONS.clock}</div>
      <div>
        <div class="title">${a.title}</div>
        <div class="meta">${a.meta}</div>
      </div>
      <div class="time">${a.time}</div>
    </div>`).join('');
}

/* ── Render: Plantillas ──────────────────────────────────────────────── */

function configRows(config) {
  return Object.entries(config).map(([key, value]) => `
    <div class="config-row">
      <span class="config-key">${escapeHtml(key)}</span>
      <span class="config-value">${escapeHtml(typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value))}</span>
    </div>`).join('');
}

function renderTemplates(templates) {
  const el = document.getElementById('templatesGrid');
  el.innerHTML = templates.map((t, i) => {
    const row = Math.floor(i / 2) + 1;
    const col = (i % 2) + 1;
    const partnerCol = col === 1 ? 2 : 1;

    return `
    <div class="template-card" id="card-${t.id}" style="grid-row:${row}; grid-column:${col};">
      <div class="template-thumb"><img src="${t.thumb}" alt="${t.name}" loading="lazy"></div>
      <div class="template-body">
        <div class="head-row">
          <span class="name">${t.order}. ${t.name}</span>
        </div>
        <div class="example">Ejemplo: ${t.example}</div>
        <div class="desc">${t.description}</div>
        <div class="footer-row">
          <span class="input-tag">Entrada: ${t.input}</span>
          <button class="btn btn-secondary btn-sm" onclick="useTemplate('${t.id}')">Usar esta plantilla</button>
        </div>
        <div class="footer-row-2">
          <button class="btn btn-ghost btn-sm info-toggle" id="infoToggle-${t.id}" onclick="toggleTemplateDetail('${t.id}')">
            Ver información ${ICONS.chevron}
          </button>
          <button class="btn btn-ghost btn-sm" onclick="goToBibliotecaFilteredByTemplate('${t.id}')">Ver videos creados →</button>
        </div>
      </div>
    </div>
    <div class="template-detail-row" id="detailRow-${t.id}" style="display:none; grid-row:${row}; grid-column:${partnerCol};">
      <div class="template-detail">
        <div class="template-detail-head">
          <div>
            <div class="template-detail-title">${t.order}. ${t.name} — detalle técnico</div>
            <div class="template-detail-sub">Carpeta: production/${t.folder}/ · Config: ${t.configFile}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="toggleTemplateDetail('${t.id}')">Cerrar ✕</button>
        </div>
        <div class="config-rows">
          <div class="config-row"><span class="config-key">entrada</span><span class="config-value">${t.input}</span></div>
          <div class="config-row"><span class="config-key">ejemplo</span><span class="config-value">${t.example}</span></div>
          <div class="config-row"><span class="config-key">formatos</span><span class="config-value">16:9 (desktop) y 9:16 (móvil)</span></div>
          ${configRows(t.config)}
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleTemplateDetail(templateId) {
  const templates = DATA.templates;
  const i = templates.findIndex((t) => t.id === templateId);
  const isFirstInPair = i % 2 === 0;
  const partnerIndex = isFirstInPair ? i + 1 : i - 1;
  const partner = partnerIndex >= 0 && partnerIndex < templates.length ? templates[partnerIndex] : null;

  const row = document.getElementById(`detailRow-${templateId}`);
  const btn = document.getElementById(`infoToggle-${templateId}`);
  const opening = row.style.display === 'none';

  row.style.display = opening ? 'block' : 'none';
  btn.classList.toggle('open', opening);

  if (partner) {
    document.getElementById(`card-${partner.id}`).style.display = opening ? 'none' : '';
    if (opening) {
      // por si el partner tenía su propio detalle abierto (defensivo)
      document.getElementById(`detailRow-${partner.id}`).style.display = 'none';
      document.getElementById(`infoToggle-${partner.id}`).classList.remove('open');
    }
  }
}

function renderPlantillaSelect(templates) {
  const el = document.getElementById('plantilla');
  el.innerHTML = templates.map((t) => `<option value="${t.id}">${t.order}. ${t.name}</option>`).join('');
}

function useTemplate(templateId) {
  goTo('crear');
  document.getElementById('plantilla').value = templateId;
  updateSummary();
}

/* ── Crear video: nicho (opcional + agregar categoría) ───────────────── */

let customNiches = [];

function renderNichoSelect() {
  const el = document.getElementById('nicho');
  const options = ['<option value="">Sin preferencia — el sistema elige</option>']
    .concat(DATA.niches.map((n) => `<option>${n}</option>`))
    .concat(customNiches.map((n) => `<option>${n}</option>`));
  el.innerHTML = options.join('');
}

function toggleAddNicho() {
  const row = document.getElementById('addNichoRow');
  row.classList.toggle('show');
  if (row.classList.contains('show')) document.getElementById('newNichoInput').focus();
}

function confirmAddNicho() {
  const input = document.getElementById('newNichoInput');
  const name = input.value.trim();
  if (!name) return;
  customNiches.push(name);
  renderNichoSelect();
  document.getElementById('nicho').value = name;
  input.value = '';
  document.getElementById('addNichoRow').classList.remove('show');
  updateSummary();
}

function cancelAddNicho() {
  document.getElementById('newNichoInput').value = '';
  document.getElementById('addNichoRow').classList.remove('show');
}

/* ── Render: Crear video — canales/cuentas ──────────────────────────── */

function renderChannelTargets(channels) {
  const el = document.getElementById('channelTargets');
  el.innerHTML = channels.map((c) => {
    const accountsHtml = c.accounts.length
      ? c.accounts.map((a) => `
          <label class="account-check">
            <input type="checkbox" ${a.status === 'connected' ? 'checked' : ''}>
            <span class="alias">${a.label}</span>
            <span class="sub">${a.sub}</span>
          </label>`).join('')
      : `<div class="no-accounts-note">Sin cuentas conectadas — ve a <a onclick="event.stopPropagation(); goTo('canales')">Canales</a> para conectar una.</div>`;

    return `
      <div class="channel-target" data-channel="${c.id}">
        <button type="button" class="btn channel-toggle" onclick="toggleChannelTarget(this)">
          <span class="left">${ICONS[c.id] || ''} ${c.label}</span>
          ${ICONS.chevron}
        </button>
        <div class="account-select-row">${accountsHtml}</div>
      </div>`;
  }).join('');
}

function toggleChannelTarget(btn) {
  btn.closest('.channel-target').classList.toggle('open');
}

/* ── Render: Canales ─────────────────────────────────────────────────── */

function renderCanales(channels) {
  const el = document.getElementById('canalesGrid');
  el.innerHTML = channels.map((c) => {
    if (!c.accounts.length) {
      return `
        <div class="card channel-card">
          <div class="channel-card-head">
            <div class="platform"><span class="icon">${ICONS[c.id] || ''}</span>${c.label}</div>
            <span class="badge badge-warn"><span class="badge-dot"></span>Sin conectar</span>
          </div>
          <div class="account-row" style="justify-content:center; border-top:none; padding-top:18px;">
            <button class="btn btn-primary btn-sm">Conectar cuenta</button>
          </div>
        </div>`;
    }

    const hasIssue = c.accounts.some((a) => a.status !== 'connected');
    const badge = hasIssue
      ? `<span class="badge badge-warn"><span class="badge-dot"></span>${c.accounts.filter((a) => a.status !== 'connected').length} requiere atención</span>`
      : `<span class="badge badge-ok"><span class="badge-dot"></span>Conectado</span>`;

    const rows = c.accounts.map((a) => `
      <div class="account-row">
        <div><div class="alias">${a.label}</div><div class="sub">${a.sub}</div></div>
        ${a.status === 'connected'
          ? `<button class="btn btn-ghost btn-sm">Gestionar</button>`
          : `<button class="btn btn-secondary btn-sm">Reconectar</button>`}
      </div>`).join('');

    return `
      <div class="card channel-card">
        <div class="channel-card-head">
          <div class="platform"><span class="icon">${ICONS[c.id] || ''}</span>${c.label}</div>
          ${badge}
        </div>
        ${rows}
      </div>`;
  }).join('');
}

/* ── Render: Programación ───────────────────────────────────────────── */

function renderSchedule(schedule) {
  const el = document.getElementById('scheduleBody');
  el.innerHTML = schedule.map((s) => `
    <tr>
      <td><span class="channel-chip">${ICONS[s.channel] || ''}${channelLabel(s.channel)}</span></td>
      <td>${s.account}</td>
      <td>${s.days}</td>
      <td>${s.times.map((t) => `<span class="time-slot">${t}</span>`).join('')}</td>
      <td><button class="btn btn-ghost btn-sm">Editar</button></td>
    </tr>`).join('');
}

/* ── Render: Biblioteca ──────────────────────────────────────────────── */

let bibliotecaFilters = { template: '', channel: '' };

function itemChannels(v) {
  if (v.channels) return v.channels;
  if (v.channel) return [v.channel];
  return [];
}

function templateLabel(id) {
  const t = DATA.templates.find((tpl) => tpl.id === id);
  return t ? t.name : id;
}

function matchesBibliotecaFilters(v) {
  if (bibliotecaFilters.template && v.template !== bibliotecaFilters.template) return false;
  if (bibliotecaFilters.channel && !itemChannels(v).includes(bibliotecaFilters.channel)) return false;
  return true;
}

function renderBibliotecaFilterSelects() {
  document.getElementById('filterPlantilla').innerHTML =
    '<option value="">Todas las plantillas</option>' +
    DATA.templates.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');

  document.getElementById('filterCanal').innerHTML =
    '<option value="">Todos los canales</option>' +
    DATA.channels.map((c) => `<option value="${c.id}">${c.label}</option>`).join('');
}

function applyBibliotecaFilters() {
  bibliotecaFilters.template = document.getElementById('filterPlantilla').value;
  bibliotecaFilters.channel = document.getElementById('filterCanal').value;
  renderBiblioteca();
}

function clearBibliotecaFilters() {
  document.getElementById('filterPlantilla').value = '';
  document.getElementById('filterCanal').value = '';
  applyBibliotecaFilters();
}

function goToBibliotecaFilteredByTemplate(templateId) {
  goTo('biblioteca');
  document.getElementById('filterPlantilla').value = templateId;
  applyBibliotecaFilters();
}

function renderBiblioteca() {
  const videos = DATA.videos;
  const filterActive = !!(bibliotecaFilters.template || bibliotecaFilters.channel);

  const listos = videos.listos.filter(matchesBibliotecaFilters);
  const cola = videos.cola.filter(matchesBibliotecaFilters);
  const publicados = videos.publicados.filter(matchesBibliotecaFilters);
  const fallidos = videos.fallidos.filter(matchesBibliotecaFilters);

  document.getElementById('countListos').textContent = `· ${listos.length}`;
  document.getElementById('countCola').textContent = `· ${cola.length}`;
  document.getElementById('countPublicados').textContent = `· ${filterActive ? publicados.length : DATA.stats.publicados}`;
  document.getElementById('countFallidos').textContent = `· ${fallidos.length}`;

  const emptyRow = (msg) => `<div class="empty-state">${msg}</div>`;

  document.getElementById('listosGrid').innerHTML = listos.length ? listos.map((v) => `
    <div class="video-card">
      <div class="video-thumb">
        <button class="play-btn" onclick="openPlayer('${v.title}')">${ICONS.play}</button>
        <span class="duration">${v.duration}</span>
      </div>
      <div class="video-body">
        <div class="title">${v.title}</div>
        <div class="channels">${v.channels.map((c) => `<span class="channel-chip">${channelLabel(c)}</span>`).join('')}<span class="input-tag">${templateLabel(v.template)}</span></div>
        <div class="footer-row">
          <span style="font-size:0.76rem;color:var(--text-tertiary)">${v.readySince}</span>
          <button class="btn btn-primary btn-sm">Publicar ahora</button>
        </div>
      </div>
    </div>`).join('') : emptyRow('Ningún video coincide con los filtros aplicados.');

  document.getElementById('colaList').innerHTML = cola.length ? cola.map((v) => `
    <div class="activity-row">
      <div class="icon">${ICONS.clock}</div>
      <div><div class="title">${v.title}</div><div class="meta">${v.stage} · ${templateLabel(v.template)}</div></div>
      <div class="time">${v.eta}</div>
    </div>`).join('') : emptyRow('Ningún video coincide con los filtros aplicados.');

  document.getElementById('publicadosGrid').innerHTML = (publicados.length ? publicados.map((v) => `
    <div class="video-card">
      <div class="video-thumb">
        <button class="play-btn" onclick="openPlayer('${v.title}')">${ICONS.play}</button>
        <span class="duration">${v.duration}</span>
      </div>
      <div class="video-body">
        <div class="title">${v.title}</div>
        <div class="channels">${v.channels.map((c) => `<span class="channel-chip">${channelLabel(c)}</span>`).join('')}<span class="input-tag">${templateLabel(v.template)}</span></div>
        <div class="footer-row">
          <span class="badge badge-ok"><span class="badge-dot"></span>Publicado</span>
          <span style="font-size:0.76rem;color:var(--text-tertiary)">${v.publishedAt}</span>
        </div>
      </div>
    </div>`).join('') : emptyRow('Ningún video coincide con los filtros aplicados.')) + (!filterActive && videos.publicadosExtra
    ? `<div class="empty-state">+ ${videos.publicadosExtra} videos más publicados</div>`
    : '');

  document.getElementById('fallidosList').innerHTML = fallidos.length ? fallidos.map((v) => `
    <div class="activity-row">
      <div class="icon">${ICONS.cross}</div>
      <div><div class="title">${v.title}</div><div class="meta">${channelLabel(v.channel)} · ${v.account} — ${v.reason} · ${templateLabel(v.template)}</div></div>
      <button class="btn btn-secondary btn-sm" style="margin-left:auto">Reintentar</button>
    </div>`).join('') : emptyRow('Ningún video coincide con los filtros aplicados.');
}

/* ── Render: Historial ───────────────────────────────────────────────── */

function renderHistorial(historial) {
  document.getElementById('logVideo').innerHTML = historial.videos.map((v) => `<option>${v}</option>`).join('');
  document.getElementById('timelineBody').innerHTML = historial.steps.map((s) => `
    <div class="timeline-step ${s.done ? '' : 'pending'}">
      <div class="marker">${s.done ? ICONS.check.replace('stroke-width="2"', 'stroke-width="2.5"') : s.n}</div>
      <div>
        <div class="step-title">${s.n}. ${s.title}</div>
        <div class="step-meta">${s.meta}</div>
      </div>
    </div>`).join('');
}

/* ── Crear video: duración ───────────────────────────────────────────── */

let currentSongSeconds = 210; // 3:30 — estimación por defecto sin canción subida

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function recomputeAutoTotal() {
  const repeats = parseInt(document.getElementById('repeatCount').value, 10) || 1;
  document.getElementById('totalDurationAuto').textContent = formatDuration(currentSongSeconds * repeats);
  updateSummary();
}

function setDurationMode(mode) {
  document.querySelectorAll('#durationMode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('panelAuto').classList.toggle('active', mode === 'auto');
  document.getElementById('panelManual').classList.toggle('active', mode === 'manual');
  updateSummary();
}

/* ── Crear video: resumen en vivo ─────────────────────────────────────── */

function updateSummary() {
  const nichoEl = document.getElementById('nicho');
  document.getElementById('sumNicho').textContent = nichoEl.value ? nichoEl.value : 'Sin preferencia';

  const plantillaEl = document.getElementById('plantilla');
  document.getElementById('sumPlantilla').textContent = plantillaEl.options.length
    ? plantillaEl.options[plantillaEl.selectedIndex].text
    : '—';

  const lines = [];
  document.querySelectorAll('.channel-target').forEach((ct) => {
    const checked = Array.from(ct.querySelectorAll('.account-check input:checked'))
      .map((i) => i.closest('.account-check').querySelector('.alias').textContent);
    if (checked.length) {
      lines.push(`<div class="summary-channel-line">${channelLabel(ct.dataset.channel)} <span class="accounts">· ${checked.join(', ')}</span></div>`);
    }
  });
  document.getElementById('sumCanales').innerHTML = lines.length ? lines.join('') : 'Ninguno seleccionado aún';

  const bgName = document.getElementById('fileBgName').textContent;
  document.getElementById('sumFondo').textContent = bgName.startsWith('El sistema') ? 'Automático' : bgName;

  const songName = document.getElementById('fileSongName').textContent;
  document.getElementById('sumCancion').textContent = songName.startsWith('El sistema') ? 'Automática' : songName;

  const mode = document.querySelector('#durationMode button.active').dataset.mode;
  document.getElementById('sumDuracion').textContent = mode === 'auto'
    ? document.getElementById('totalDurationAuto').textContent
    : `${document.getElementById('manualHours').value} horas (manual)`;
}

/* ── Crear video: uploads ────────────────────────────────────────────── */

function setupUploads() {
  document.getElementById('fileBg').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const nameEl = document.getElementById('fileBgName');
    const previewEl = document.getElementById('previewBg');
    if (!file) {
      nameEl.textContent = 'El sistema elegirá una imagen automáticamente';
      previewEl.classList.remove('show');
      previewEl.innerHTML = '';
      updateSummary();
      return;
    }
    nameEl.textContent = file.name;
    const url = URL.createObjectURL(file);
    previewEl.innerHTML = file.type.startsWith('video/')
      ? `<video src="${url}" muted></video>`
      : `<img src="${url}" alt="">`;
    previewEl.classList.add('show');
    updateSummary();
  });

  document.getElementById('fileSong').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const nameEl = document.getElementById('fileSongName');
    if (!file) {
      nameEl.textContent = 'El sistema elegirá una canción de la biblioteca';
      currentSongSeconds = 210;
      document.getElementById('songDuration').textContent = 'Sin canción — se estima 3:30';
    } else {
      nameEl.textContent = file.name;
      currentSongSeconds = 222; // demo: duración detectada de muestra (3:42)
      document.getElementById('songDuration').textContent = `${file.name} · 3:42 detectados`;
    }
    recomputeAutoTotal();
  });

  document.getElementById('repeatCount').addEventListener('input', recomputeAutoTotal);
  document.getElementById('manualHours').addEventListener('input', updateSummary);
  document.getElementById('nicho').addEventListener('change', updateSummary);
  document.getElementById('plantilla').addEventListener('change', updateSummary);
  document.getElementById('channelTargets').addEventListener('change', updateSummary);
}

/* ── Sidebar colapsable ──────────────────────────────────────────────── */

let sidebarCollapsed = localStorage.getItem('nb_sidebar_collapsed') === '1';

function applySidebarState() {
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem('nb_sidebar_collapsed', sidebarCollapsed ? '1' : '0');
  applySidebarState();
}

/* ── Tema claro / oscuro ─────────────────────────────────────────────── */

let currentTheme = localStorage.getItem('nb_theme') || 'light';

function applyTheme(theme) {
  currentTheme = theme;
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('nb_theme', theme);

  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.querySelector('.theme-icon').innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
    btn.querySelector('.nav-label-text').textContent = theme === 'dark' ? 'Tema claro' : 'Tema oscuro';
  }
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

applySidebarState();
applyTheme(currentTheme);

/* ── Navegación / tabs / modal (igual que la versión anterior) ──────── */

function goTo(sectionId) {
  const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  if (navItem) navItem.click();
}

function setupNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((i) => i.classList.remove('active'));
      item.classList.add('active');

      document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
      document.getElementById(`sec-${item.dataset.section}`).classList.add('active');

      document.getElementById('pageTitle').textContent = item.dataset.title;
      document.getElementById('pageSubtitle').textContent = item.dataset.subtitle;
    });
  });
}

function showTab(tabId, btn) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');
}

function openPlayer(title) {
  document.getElementById('modalTitle').textContent = title;
  const modal = document.getElementById('videoModal');
  modal.classList.add('active');
  document.getElementById('modalVideo').play().catch(() => {});
}

function closePlayer() {
  const video = document.getElementById('modalVideo');
  video.pause();
  document.getElementById('videoModal').classList.remove('active');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePlayer();
});

/* ── Init ─────────────────────────────────────────────────────────────── */

(async function init() {
  DATA = await loadData();

  renderStats(DATA.stats);
  renderActivity(DATA.activity);
  renderTemplates(DATA.templates);
  renderNichoSelect();
  renderPlantillaSelect(DATA.templates);
  renderChannelTargets(DATA.channels);
  renderCanales(DATA.channels);
  renderSchedule(DATA.schedule);
  renderBibliotecaFilterSelects();
  renderBiblioteca();
  renderHistorial(DATA.historial);

  setupNav();
  setupUploads();
  recomputeAutoTotal();
  updateSummary();
})();
