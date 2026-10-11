const FALLBACK_CONFIG = {
  brand: {
    name: "NODE",
    centerText: ["WHERE", "IDEAS", "CONNECT"],
  },
  palette: {
    background: "#151816",
    ink: "#304431",
    paper: "#f2f0e5",
    line: "#d5cbb7",
    pattern: "#c2d0d1",
    accent: "#78917d",
  },
  topSymbols: [
    {
      id: "nodemotion",
      name: "NODEMOTION",
      category: "Music & motion",
      asset: "assets/nodemotion/logo-kraken.png",
      identity: "The pulse behind every idea.",
      description: "Música, movimiento y piezas audiovisuales hechas para despertar emociones. En NODEMOTION exploramos sonidos e ideas y les damos una identidad visual propia.",
      locales: {
        es: { category: "Música y movimiento", identity: "El pulso detrás de cada idea.", description: "Música, movimiento y piezas audiovisuales hechas para despertar emociones. En NODEMOTION exploramos sonidos e ideas y les damos una identidad visual propia.", youtube: { description: "Música, movimiento y piezas audiovisuales hechas para despertar emociones. En NODEMOTION exploramos sonidos e ideas y les damos una identidad visual propia.\n\nSÉ PARTE DE NODEMOTION\nCada pieza lleva tiempo y dedicación. Si conectas con la música y lo visual, suscríbete y comparte el canal con alguien que también disfrute descubrir nuevos sonidos. Tu apoyo nos ayuda a seguir creando. Gracias por acompañarnos." } },
        en: { category: "Music & motion", identity: "The pulse behind every idea.", description: "Music, motion and audiovisual pieces made to stir emotion. At NODEMOTION, we explore sounds and ideas and give them a visual identity of their own.", youtube: { description: "Music, motion and audiovisual pieces made to stir emotion. At NODEMOTION, we explore sounds and ideas and give them a visual identity of their own.\n\nBE PART OF NODEMOTION\nEvery piece takes time and care. If you connect with music and visual storytelling, subscribe and share the channel with someone who also enjoys discovering new sounds. Your support helps us keep creating. Thank you for being here." } },
      },
      gallery: [
        { type: "logo", asset: "assets/nodemotion/logo-kraken.png", alt: "Kraken de NODEMOTION" },
        { type: "image", asset: "assets/nodemotion/signal-wave.svg", alt: "Señal de movimiento de NODEMOTION" },
        { type: "visual", eyebrow: "RHYTHM", title: "Feel the signal", note: "Sound becomes movement." },
      ],
    },
    {
      id: "nodetech",
      name: "NODETECH",
      category: "Technology",
      asset: "assets/nodetech/logo-dragon.png",
      identity: "Build what comes next.",
      description: "La tecnología no solo cambia dispositivos: cambia cómo vivimos. En NODETECH exploramos inventos, avances y preguntas del mundo digital con claridad y curiosidad.",
      locales: {
        es: { category: "Tecnología", identity: "Construye lo que viene.", description: "La tecnología no solo cambia dispositivos: cambia cómo vivimos. En NODETECH exploramos inventos, avances y preguntas del mundo digital con claridad y curiosidad.", youtube: { description: "La tecnología no solo cambia dispositivos: cambia cómo vivimos. En NODETECH exploramos inventos, avances y preguntas del mundo digital con claridad y curiosidad.\n\nSÉ PARTE DE NODETECH\nCada video lleva tiempo y dedicación. Si te gusta entender la tecnología con claridad, suscríbete y comparte el canal con alguien que también tenga curiosidad por el mundo digital. Tu apoyo nos ayuda a seguir creando. Gracias por acompañarnos." } },
        en: { category: "Technology", identity: "Build what comes next.", description: "Technology changes more than devices: it changes how we live. At NODETECH, we explore inventions, breakthroughs and questions about the digital world with clarity and curiosity.", youtube: { description: "Technology changes more than devices: it changes how we live. At NODETECH, we explore inventions, breakthroughs and questions about the digital world with clarity and curiosity.\n\nBE PART OF NODETECH\nEvery video takes time and care. If you enjoy understanding technology clearly, subscribe and share the channel with someone who's also curious about the digital world. Your support helps us keep creating. Thanks for joining us." } },
      },
      gallery: [
        { type: "logo", asset: "assets/nodetech/logo-dragon.png", alt: "Dragón de NODETECH" },
        { type: "image", asset: "assets/nodetech/system-grid.svg", alt: "Sistema conectado de NODETECH" },
        { type: "visual", eyebrow: "SYSTEMS", title: "Think beyond", note: "The future has a structure." },
      ],
    },
    {
      id: "nodehistory",
      name: "NODEHISTORY",
      category: "History",
      asset: "assets/nodehistory/logo-deer.png",
      identity: "The past still speaks.",
      description: "El pasado no está tan lejos como parece. En NODEHISTORY contamos las decisiones, los conflictos y las personas detrás de los hechos que todavía dan forma al presente.",
      locales: {
        es: { category: "Historia", identity: "El pasado todavía habla.", description: "El pasado no está tan lejos como parece. En NODEHISTORY contamos las decisiones, los conflictos y las personas detrás de los hechos que todavía dan forma al presente.", youtube: { description: "El pasado no está tan lejos como parece. En NODEHISTORY contamos las decisiones, los conflictos y las personas detrás de los hechos que todavía dan forma al presente.\n\nSÉ PARTE DE NODEHISTORY\nCada video lleva tiempo y dedicación. Si disfrutas estas historias, suscríbete y compártelas con alguien a quien también le interese el pasado. Tu apoyo nos ayuda a seguir creando. Gracias por acompañarnos." } },
        en: { category: "History", identity: "The past still speaks.", description: "The past is closer than it seems. At NODEHISTORY, we tell the stories of decisions, conflicts and people behind the events that still shape the present.", youtube: { description: "The past is closer than it seems. At NODEHISTORY, we tell the stories of decisions, conflicts and people behind the events that still shape the present.\n\nBE PART OF NODEHISTORY\nEvery video takes time and care. If you enjoy these stories, subscribe and share them with someone else who's curious about the past. Your support helps us keep creating. Thanks for being here." } },
      },
      gallery: [
        { type: "logo", asset: "assets/nodehistory/logo-deer.png", alt: "Venado de NODEHISTORY" },
        { type: "image", asset: "assets/nodehistory/archive-trace.svg", alt: "Archivo histórico de NODEHISTORY" },
        { type: "visual", eyebrow: "ARCHIVE", title: "Look closer", note: "Every detail leaves a trace." },
      ],
    },
    {
      id: "nodepolitics",
      name: "NODEPOLITICS",
      category: "Politics & society",
      asset: "assets/nodepolitics/logo-eagle-medallion.png",
      identity: "Power, people, perspective.",
      description: "Detrás de cada decisión política hay intereses, personas y consecuencias. En NODEPOLITICS seguimos las fuerzas que mueven el poder y explicamos cómo afectan al mundo que habitamos.",
      downloadAsset: "assets/nodepolitics/logo-eagle-medallion.png",
      locales: {
        es: { category: "Política y sociedad", identity: "Poder, personas, perspectiva.", description: "Detrás de cada decisión política hay intereses, personas y consecuencias. En NODEPOLITICS seguimos las fuerzas que mueven el poder y explicamos cómo afectan al mundo que habitamos.", youtube: { description: "Detrás de cada decisión política hay intereses, personas y consecuencias. En NODEPOLITICS seguimos las fuerzas que mueven el poder y explicamos cómo afectan al mundo que habitamos.\n\nSÉ PARTE DE NODEPOLITICS\nCada video lleva tiempo y dedicación. Si te interesa entender las decisiones que afectan nuestra vida, suscríbete y comparte el canal con alguien que también quiera mirar más allá de los titulares. Tu apoyo nos ayuda a seguir creando. Gracias por acompañarnos." } },
        en: { category: "Politics & society", identity: "Power, people, perspective.", description: "Behind every political decision are interests, people and consequences. At NODEPOLITICS, we follow the forces that move power and explain how they affect the world we live in.", youtube: { description: "Behind every political decision are interests, people and consequences. At NODEPOLITICS, we follow the forces that move power and explain how they affect the world we live in.\n\nBE PART OF NODEPOLITICS\nEvery video takes time and care. If you want to understand the decisions that affect our lives, subscribe and share the channel with someone who also wants to look beyond the headlines. Your support helps us keep creating. Thanks for being here." } },
      },
      gallery: [
        { type: "logo", asset: "assets/nodepolitics/logo-eagle-medallion.png", alt: "Águila de NODEPOLITICS" },
        { type: "image", asset: "assets/nodepolitics/civic-signal.svg", alt: "Señal cívica de NODEPOLITICS" },
        { type: "visual", eyebrow: "CIVIC", title: "See the forces", note: "Ideas, power and consequence." },
      ],
    },
  ],
};

const FALLBACK_UI = {
  es: {
    pageLabel: "NEXA BRANDING / EMBLEM BUILDER",
    languageButton: "ENGLISH",
    languageToEnglish: "Cambiar a inglés",
    languageToSpanish: "Cambiar a español",
    lightMode: "MODO CLARO",
    darkMode: "MODO OSCURO",
    themeToDark: "Cambiar a tema oscuro",
    themeToLight: "Cambiar a tema claro",
    emblemLabel: "Emblema de NODE",
    sectionKicker: "NODE MEDIA NETWORK",
    sectionTitle: "Cuatro líneas. Una misma mirada.",
    sectionIntro: "Cada canal nace de una obsesión distinta, pero todos comparten el mismo cuidado por contar algo que importe.",
    nodeLine: "LÍNEA NODE",
    previewButton: "PREVIEW",
    galleryLabel: "Galería de",
    showImage: "Mostrar imagen",
    previewKicker: "PREVISUALIZACIÓN DE CANAL DE YOUTUBE",
    closePreview: "Cerrar preview",
    copyTitle: "Copiar título",
    copyDescription: "Copiar descripción",
    downloadLogo: "Descargar logo",
    downloadHeader: "Descargar header",
    subscribe: "Suscribirse",
    tabHome: "Inicio",
    tabVideos: "Videos",
    tabShorts: "Shorts",
    tabCommunity: "Comunidad",
    tabOutro: "Cierre",
    firstVideo: "PRIMER VIDEO",
    firstVideoTitle: "Construye el canal, historia a historia.",
    outroKicker: "CIERRE DE VIDEO",
    outroTitle: "Gracias por ver",
    outroLike: "Dale like al video",
    outroSubscribeLabel: "Suscríbete",
    outroNotify: "Activa la campana",
    outroSubscribe: "Suscríbete para ver el próximo video.",
    outroSupport: "Tu apoyo hace posible que sigamos creando historias que valen la pena.",
    titleCopied: "Nombre copiado",
    descriptionCopied: "Descripción copiada",
    logoDownloaded: "Logo descargado",
    headerDownloaded: "Header descargado",
    copyError: "No se pudo copiar automáticamente",
    imageError: "No se pudo descargar el header",
  },
  en: {
    pageLabel: "NEXA BRANDING / EMBLEM BUILDER",
    languageButton: "ESPAÑOL",
    languageToEnglish: "Switch to English",
    languageToSpanish: "Cambiar a español",
    lightMode: "LIGHT MODE",
    darkMode: "DARK MODE",
    themeToDark: "Switch to dark theme",
    themeToLight: "Switch to light theme",
    emblemLabel: "NODE emblem",
    sectionKicker: "NODE MEDIA NETWORK",
    sectionTitle: "Four lines. One point of view.",
    sectionIntro: "Each channel begins with a different obsession, but they share the same care for telling something that matters.",
    nodeLine: "NODE LINE",
    previewButton: "PREVIEW",
    galleryLabel: "Gallery of",
    showImage: "Show image",
    previewKicker: "YOUTUBE CHANNEL PREVIEW",
    closePreview: "Close preview",
    copyTitle: "Copy title",
    copyDescription: "Copy description",
    downloadLogo: "Download logo",
    downloadHeader: "Download header",
    subscribe: "Subscribe",
    tabHome: "Home",
    tabVideos: "Videos",
    tabShorts: "Shorts",
    tabCommunity: "Community",
    tabOutro: "Outro",
    firstVideo: "YOUR FIRST VIDEO",
    firstVideoTitle: "Build the channel one story at a time.",
    outroKicker: "VIDEO OUTRO",
    outroTitle: "Thanks for watching",
    outroLike: "Like the video",
    outroSubscribeLabel: "Subscribe",
    outroNotify: "Turn on notifications",
    outroSubscribe: "Subscribe to see the next video.",
    outroSupport: "Your support helps us keep creating stories worth watching.",
    titleCopied: "Title copied",
    descriptionCopied: "Description copied",
    logoDownloaded: "Logo downloaded",
    headerDownloaded: "Header downloaded",
    copyError: "Could not copy automatically",
    imageError: "Could not download the header",
  },
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const stage = document.querySelector("#emblem");
const lines = document.querySelector("#lines");
const previewModal = document.querySelector("#preview-modal");
const emblem = document.querySelector("#emblem");
const pageLabel = document.querySelector("#page-label");
const languageToggle = document.querySelector("#language-toggle");
const languageToggleLabel = document.querySelector("#language-toggle-label");
const themeToggle = document.querySelector("#theme-toggle");
const themeToggleLabel = document.querySelector("#theme-toggle-label");
let loadedConfig = null;
let currentLocale = "es";
let currentUi = FALLBACK_UI.es;

const getUi = (config = loadedConfig) => config?.ui?.[currentLocale] || FALLBACK_UI[currentLocale];

const getChannelCopy = (channel) =>
  channel.locales?.[currentLocale] || channel.locales?.es || channel;

const applyUiCopy = (ui) => {
  currentUi = ui || FALLBACK_UI[currentLocale];
  document.documentElement.lang = currentLocale;
  if (pageLabel) pageLabel.textContent = currentUi.pageLabel;
  if (emblem) emblem.setAttribute("aria-label", currentUi.emblemLabel);
  if (languageToggleLabel) languageToggleLabel.textContent = currentUi.languageButton;
  if (languageToggle) {
    languageToggle.setAttribute("aria-pressed", String(currentLocale === "en"));
    languageToggle.setAttribute(
      "aria-label",
      currentLocale === "es" ? currentUi.languageToEnglish : currentUi.languageToSpanish,
    );
  }
  if (themeToggleLabel) {
    themeToggleLabel.textContent = document.documentElement.dataset.theme === "light"
      ? currentUi.darkMode
      : currentUi.lightMode;
  }
  if (themeToggle) {
    const isLight = document.documentElement.dataset.theme === "light";
    themeToggle.setAttribute("aria-label", isLight ? currentUi.themeToDark : currentUi.themeToLight);
  }
};

const setTheme = (theme, save = true) => {
  const isLight = theme === "light";
  document.documentElement.dataset.theme = isLight ? "light" : "dark";

  if (themeToggle) {
    themeToggle.setAttribute("aria-pressed", String(isLight));
    themeToggle.setAttribute("aria-label", isLight ? currentUi.themeToDark : currentUi.themeToLight);
  }

  if (themeToggleLabel) {
    themeToggleLabel.textContent = isLight ? currentUi.darkMode : currentUi.lightMode;
  }

  if (save) {
    try {
      localStorage.setItem("node-brand-theme", isLight ? "light" : "dark");
    } catch {
      // La página también funciona cuando el navegador bloquea localStorage.
    }
  }
};

let savedTheme = "dark";
try {
  savedTheme = localStorage.getItem("node-brand-theme") || "dark";
} catch {
  savedTheme = "dark";
}

setTheme(savedTheme, false);

themeToggle?.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  setTheme(nextTheme);
});

const setLanguage = (locale) => {
  currentLocale = locale === "en" ? "en" : "es";
  currentUi = getUi(loadedConfig);
  applyUiCopy(currentUi);

  if (loadedConfig) render(loadedConfig);
};

setLanguage(currentLocale);

languageToggle?.addEventListener("click", () => {
  setLanguage(currentLocale === "es" ? "en" : "es");
});

const renderGalleryItem = (item, channel, index, isDefaultItem) => {
  const defaultClass = isDefaultItem ? " is-default-gallery-item" : "";

  if (item.type === "logo") {
    return `
      <figure class="line-gallery-item line-gallery-logo${defaultClass}" data-gallery-index="${index}">
        <img src="${escapeHtml(item.asset)}" alt="${escapeHtml(item.alt || channel.name)}" />
      </figure>
    `;
  }

  if (item.type === "image") {
    return `
      <figure class="line-gallery-item line-gallery-image${defaultClass}" data-gallery-index="${index}">
        <img src="${escapeHtml(item.asset)}" alt="${escapeHtml(item.alt || channel.name)}" />
      </figure>
    `;
  }

  return `
    <div class="line-gallery-item line-gallery-visual ${escapeHtml(channel.id)}${defaultClass}" data-gallery-index="${index}">
      <span class="visual-grid"></span>
      <span class="visual-orbit"></span>
      <span class="visual-copy">
        <small>${escapeHtml(item.eyebrow)}</small>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.note)}</span>
      </span>
    </div>
  `;
};

const renderLines = (symbols, ui = currentUi) => {
  if (!lines) return;

  lines.innerHTML = `
    <div class="lines-heading">
      <div>
        <p class="section-kicker">${escapeHtml(ui.sectionKicker)}</p>
        <h2 id="lines-title">${escapeHtml(ui.sectionTitle)}</h2>
      </div>
      <p class="section-intro">${escapeHtml(ui.sectionIntro)}</p>
    </div>
    <div class="line-cards">
      ${symbols
        .map((channel) => {
          const copy = getChannelCopy(channel);
          const gallery = channel.gallery?.length
            ? channel.gallery
            : [{ type: "logo", asset: channel.asset, alt: channel.name }];

          return `
            <article class="line-card ${escapeHtml(channel.id)}">
              <div class="line-card-gallery">
                ${gallery.map((item, index) => renderGalleryItem(item, channel, index, index < 3)).join("")}
                <div class="line-gallery-dots" role="tablist" aria-label="${escapeHtml(ui.galleryLabel)} ${escapeHtml(channel.name)}">
                  ${gallery
                    .map(
                      (_, index) => `
                        <button
                          class="gallery-dot${index === 0 ? " is-active" : ""}"
                          type="button"
                          role="tab"
                          aria-selected="${index === 0}"
                          aria-label="${escapeHtml(ui.showImage)} ${index + 1} ${currentLocale === "es" ? "de" : "of"} ${gallery.length}"
                          data-gallery-dot="${index}"
                        ></button>
                      `,
                    )
                    .join("")}
                </div>
              </div>
              <div class="line-card-copy">
                <div class="line-card-meta">
                  <span>${escapeHtml(copy.category)}</span>
                  <span class="line-dot"></span>
                  <span>${escapeHtml(ui.nodeLine)}</span>
                </div>
                <h3>${escapeHtml(channel.name)}</h3>
                <p class="line-identity">${escapeHtml(copy.identity)}</p>
                <p class="line-description">${escapeHtml(copy.description)}</p>
                <div class="line-card-actions">
                  <button class="preview-button" type="button" data-preview-id="${escapeHtml(channel.id)}">
                    <span aria-hidden="true">↗</span> ${escapeHtml(ui.previewButton)}
                  </button>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  lines.querySelectorAll(".line-card-gallery").forEach((gallery) => {
    const items = [...gallery.querySelectorAll("[data-gallery-index]")];
    const dots = [...gallery.querySelectorAll("[data-gallery-dot]")];

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const selectedIndex = Number(dot.dataset.galleryDot);
        const isDefaultView = selectedIndex === 0;

        gallery.classList.toggle("has-active-slide", !isDefaultView);
        gallery.dataset.activeSlide = String(selectedIndex);

        items.forEach((item) => {
          item.classList.toggle("is-active-slide", Number(item.dataset.galleryIndex) === selectedIndex);
        });

        dots.forEach((item) => {
          const isSelected = item === dot;
          item.classList.toggle("is-active", isSelected);
          item.setAttribute("aria-selected", String(isSelected));
        });
      });
    });
  });

  lines.querySelectorAll("[data-preview-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const channel = symbols.find((item) => item.id === button.dataset.previewId);
      if (channel) openPreview(channel);
    });
  });
};

const getYoutubeData = (channel) => {
  const copy = getChannelCopy(channel);
  const localizedYoutube = copy.youtube || {};

  return {
    handle: localizedYoutube.handle || channel.youtube?.handle || `@${channel.id}`,
    description: localizedYoutube.description || copy.description || "",
    subscribers: localizedYoutube.subscribers || channel.youtube?.subscribers || (currentLocale === "es" ? "Canal nuevo" : "New channel"),
    accent: channel.youtube?.accent || "#78917d",
    bannerNote: localizedYoutube.bannerNote || copy.category || "NODE MEDIA NETWORK",
  };
};

const setPreviewStatus = (message) => {
  const status = previewModal?.querySelector(".preview-status");
  if (!status) return;
  status.textContent = message;
  status.classList.add("is-visible");
  window.setTimeout(() => status.classList.remove("is-visible"), 2200);
};

const copyText = async (value, message) => {
  try {
    await navigator.clipboard.writeText(value);
    setPreviewStatus(message);
  } catch {
    setPreviewStatus(currentUi.copyError);
  }
};

const downloadFile = (url, filename) => {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const downloadLogoImage = (channel) => {
  downloadFile(channel.downloadAsset || channel.asset, `${channel.id}-logo.png`);
  setPreviewStatus(currentUi.logoDownloaded);
};

// YouTube: lienzo recomendado de 2560 × 1440. El área segura de 1235 × 338
// a 2048 × 1152 equivale aproximadamente a 1544 × 423 en este tamaño.
const BANNER_WIDTH = 2560;
const BANNER_HEIGHT = 1440;

const createHeaderSvg = (channel) => {
  const youtube = getYoutubeData(channel);
  const title = escapeHtml(channel.name);
  const note = escapeHtml(youtube.bannerNote.toUpperCase());
  const accent = escapeHtml(youtube.accent);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#101412"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <radialGradient id="glow" cx="1280" cy="720" r="850" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${accent}" stop-opacity=".58"/>
      <stop offset=".55" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="98" height="98" patternUnits="userSpaceOnUse">
      <path d="M-24 98L98 -24" stroke="#f2f0e5" stroke-opacity=".055"/>
    </pattern>
  </defs>
  <rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="url(#bg)"/>
  <rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="url(#glow)"/>
  <rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="url(#grid)"/>
  <text x="1280" y="630" fill="#f2f0e5" fill-opacity=".68" font-family="Inter, Arial, Helvetica, sans-serif" font-size="25" font-weight="850" letter-spacing="6" text-anchor="middle">${note}</text>
  <text x="1280" y="825" fill="#f2f0e5" font-family="Georgia, Times New Roman, serif" font-size="160" font-weight="500" letter-spacing="-9" text-anchor="middle">${title}</text>
</svg>`;
};

const svgToPngBlob = async (svg) => {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = BANNER_WIDTH;
    canvas.height = BANNER_HEIGHT;
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG vacío"))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
};

const downloadHeaderImage = async (channel) => {
  try {
    const svg = createHeaderSvg(channel);
    const pngBlob = await svgToPngBlob(svg);
    const pngUrl = URL.createObjectURL(pngBlob);
    downloadFile(pngUrl, `${channel.id}-header.png`);
    window.setTimeout(() => URL.revokeObjectURL(pngUrl), 10000);
    setPreviewStatus(currentUi.headerDownloaded);
  } catch {
    setPreviewStatus(currentUi.imageError);
  }
};

const openPreview = (channel) => {
  if (!previewModal) return;
  const youtube = getYoutubeData(channel);
  const copy = getChannelCopy(channel);
  const ui = currentUi;

  previewModal.hidden = false;
  document.documentElement.classList.add("preview-is-open");
  previewModal.innerHTML = `
    <div class="preview-backdrop" data-close-preview></div>
    <section class="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <div class="preview-dialog-topbar">
        <div>
          <span class="preview-kicker">${escapeHtml(ui.previewKicker)}</span>
          <strong>${escapeHtml(channel.name)}</strong>
        </div>
        <button class="preview-close" type="button" aria-label="${escapeHtml(ui.closePreview)}" data-close-preview>×</button>
      </div>
      <div class="youtube-preview" style="--preview-accent: ${escapeHtml(youtube.accent)}">
        <div class="youtube-banner">
          <div class="youtube-banner-grid"></div>
          <div class="youtube-banner-content">
            <span>${escapeHtml(youtube.bannerNote.toUpperCase())}</span>
            <h2>${escapeHtml(channel.name)}</h2>
          </div>
        </div>
        <div class="youtube-channel-head">
          <div class="youtube-avatar"><img src="${escapeHtml(channel.asset)}" alt="Logo de ${escapeHtml(channel.name)}" /></div>
          <div class="youtube-channel-info">
            <h3 id="preview-title">${escapeHtml(channel.name)}</h3>
            <p class="youtube-handle">${escapeHtml(youtube.handle)} · ${escapeHtml(youtube.subscribers)}</p>
            <p>${escapeHtml(youtube.description)}</p>
          </div>
          <button class="youtube-subscribe" type="button">${escapeHtml(ui.subscribe)}</button>
        </div>
        <div class="youtube-tabs" role="tablist" aria-label="${escapeHtml(ui.previewKicker)}">
          <button class="youtube-tab is-active" type="button" role="tab" aria-selected="true" data-preview-tab="home">${escapeHtml(ui.tabHome)}</button>
          <button class="youtube-tab" type="button" role="tab" aria-selected="false" data-preview-tab="videos">${escapeHtml(ui.tabVideos)}</button>
          <button class="youtube-tab" type="button" role="tab" aria-selected="false" data-preview-tab="shorts">${escapeHtml(ui.tabShorts)}</button>
          <button class="youtube-tab" type="button" role="tab" aria-selected="false" data-preview-tab="community">${escapeHtml(ui.tabCommunity)}</button>
          <button class="youtube-tab" type="button" role="tab" aria-selected="false" data-preview-tab="outro">${escapeHtml(ui.tabOutro)}</button>
        </div>
        <div class="youtube-panel youtube-placeholder" data-preview-panel="home">
          <span>${escapeHtml(ui.firstVideo)}</span><strong>${escapeHtml(ui.firstVideoTitle)}</strong>
        </div>
        <div class="youtube-panel youtube-placeholder" data-preview-panel="videos" hidden>
          <span>${escapeHtml(ui.tabVideos)}</span><strong>${escapeHtml(ui.firstVideoTitle)}</strong>
        </div>
        <div class="youtube-panel youtube-placeholder" data-preview-panel="shorts" hidden>
          <span>${escapeHtml(ui.tabShorts)}</span><strong>${escapeHtml(ui.firstVideoTitle)}</strong>
        </div>
        <div class="youtube-panel youtube-placeholder" data-preview-panel="community" hidden>
          <span>${escapeHtml(ui.tabCommunity)}</span><strong>${escapeHtml(ui.firstVideoTitle)}</strong>
        </div>
        <div class="youtube-panel youtube-outro-preview" data-preview-panel="outro" hidden>
          <div class="outro-scene">
            <div class="outro-thanks">
              <strong>${escapeHtml(ui.outroTitle)}</strong>
            </div>
            <div class="outro-channel-name">${escapeHtml(channel.name)}</div>
            <div class="outro-divider" aria-hidden="true"></div>
            <div class="outro-actions">
              <div class="outro-action outro-like-action">
                <span class="outro-icon outro-like-icon" aria-hidden="true">
                  <svg viewBox="0 0 32 32" role="img"><path d="M10.5 14.2v13.1H6.2a2 2 0 0 1-2-2v-9.1a2 2 0 0 1 2-2h4.3Zm3.2 13.1V14.1l4.4-8.4a2.6 2.6 0 0 1 4.9 1.5l-.8 5h4.3a3 3 0 0 1 2.9 3.6l-1.6 8.2a4 4 0 0 1-3.9 3.2H13.7Z" /></svg>
                </span>
                <span>${escapeHtml(ui.outroLike)}</span>
              </div>
              <div class="outro-action outro-subscribe-action">
                <span class="outro-subscribe-button">${escapeHtml(ui.outroSubscribeLabel)}</span>
              </div>
              <div class="outro-action outro-notify-action">
                <span class="outro-icon outro-bell-icon" aria-hidden="true">
                  <svg viewBox="0 0 32 32" role="img"><path d="M16 4.2a7 7 0 0 0-7 7v3.5c0 1.8-.6 3.5-1.7 4.9L5.5 21.2h21l-1.8-1.6a7.5 7.5 0 0 1-1.7-4.9v-3.5a7 7 0 0 0-7-7Zm-3 20.2a3 3 0 0 0 6 0h-6Z" /></svg>
                </span>
                <span>${escapeHtml(ui.outroNotify)}</span>
              </div>
            </div>
            <p>${escapeHtml(copy.outroSupport || ui.outroSupport)}</p>
          </div>
        </div>
      </div>
      <div class="preview-tools">
        <div class="preview-copy-tools">
          <button class="preview-tool-button" type="button" data-copy-title>${escapeHtml(ui.copyTitle)}</button>
          <button class="preview-tool-button" type="button" data-copy-description>${escapeHtml(ui.copyDescription)}</button>
        </div>
        <div class="preview-download-tools">
          <button class="preview-tool-button" type="button" data-download-logo>${escapeHtml(ui.downloadLogo)}</button>
          <button class="preview-tool-button preview-tool-primary" type="button" data-download-header>${escapeHtml(ui.downloadHeader)}</button>
        </div>
      </div>
      <p class="preview-status" role="status"></p>
    </section>
  `;

  previewModal.querySelectorAll("[data-close-preview]").forEach((element) => {
    element.addEventListener("click", closePreview);
  });

  const tabs = [...previewModal.querySelectorAll("[data-preview-tab]")];
  const panels = [...previewModal.querySelectorAll("[data-preview-panel]")];
  const previewDialog = previewModal.querySelector(".preview-dialog");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const selectedTab = tab.dataset.previewTab;

      tabs.forEach((item) => {
        const isSelected = item === tab;
        item.classList.toggle("is-active", isSelected);
        item.setAttribute("aria-selected", String(isSelected));
      });

      panels.forEach((panel) => {
        panel.hidden = panel.dataset.previewPanel !== selectedTab;
      });

      previewDialog?.classList.toggle("is-outro-view", selectedTab === "outro");
      if (previewDialog) previewDialog.scrollTop = 0;
    });
  });

  previewModal.querySelector("[data-copy-title]")?.addEventListener("click", () =>
    copyText(channel.name, currentUi.titleCopied),
  );
  previewModal.querySelector("[data-copy-description]")?.addEventListener("click", () =>
    copyText(youtube.description, currentUi.descriptionCopied),
  );
  previewModal.querySelector("[data-download-logo]")?.addEventListener("click", () => downloadLogoImage(channel));
  previewModal.querySelector("[data-download-header]")?.addEventListener("click", () => downloadHeaderImage(channel));
};

const closePreview = () => {
  if (!previewModal) return;
  previewModal.hidden = true;
  document.documentElement.classList.remove("preview-is-open");
  previewModal.innerHTML = "";
};

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePreview();
});

const mergeAssetManifest = (config, manifest) => {
  if (!manifest || typeof manifest !== "object") return config;

  return {
    ...config,
    topSymbols: (config.topSymbols || []).map((channel) => {
      const folderAssets = Array.isArray(manifest[channel.id]) ? manifest[channel.id] : [];
      if (!folderAssets.length) return channel;

      const orderedFolderAssets = [...folderAssets].sort((left, right) => {
        if (left.asset === channel.asset) return -1;
        if (right.asset === channel.asset) return 1;
        if (left.type !== right.type) return left.type === "logo" ? -1 : 1;
        return left.asset.localeCompare(right.asset);
      });
      const configuredGallery = channel.gallery?.length
        ? channel.gallery
        : [{ type: "logo", asset: channel.asset, alt: channel.name }];
      const primaryGallery = configuredGallery.slice(0, 3);
      const primaryAssetPaths = new Set(
        primaryGallery.filter((item) => item.asset).map((item) => item.asset),
      );
      const newFolderAssets = orderedFolderAssets.filter(
        (item) => !primaryAssetPaths.has(item.asset),
      );
      const configuredAfterPrimary = configuredGallery.slice(3);

      return {
        ...channel,
        asset: channel.asset || orderedFolderAssets.find((item) => item.type === "logo")?.asset,
        gallery: [...primaryGallery, ...newFolderAssets, ...configuredAfterPrimary],
      };
    }),
  };
};

const render = (config) => {
  loadedConfig = config;
  currentUi = getUi(config);
  applyUiCopy(currentUi);

  const palette = config.palette;
  const allSymbols = config.topSymbols || [];
  const emblemSymbols = allSymbols.slice(0, 3);
  const centerText = Array.isArray(config.brand?.centerText)
    ? config.brand.centerText
    : String(config.brand?.centerText || "").split("\n");

  stage.style.setProperty("--background", palette.background);
  stage.style.setProperty("--ink", palette.ink);
  stage.style.setProperty("--paper", palette.paper);
  stage.style.setProperty("--line", palette.line);
  stage.style.setProperty("--pattern", palette.pattern);
  stage.style.setProperty("--accent", palette.accent);

  stage.innerHTML = `
    <div class="emblem-art">
      <div class="emblem-texture"></div>
      <div class="emblem-circle"></div>
      <div class="triangle triangle-back"></div>
      <div class="triangle triangle-front"></div>
      <div class="top-logos">
        ${emblemSymbols
          .map(
            (item, index) => `
              <div class="top-logo top-logo-${index + 1}">
                <img src="${escapeHtml(item.asset)}" alt="${escapeHtml(item.name)}" />
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="message-disc">
        <div class="message">
          ${centerText
            .map((line, index) => `<span class="message-line message-line-${index + 1}">${escapeHtml(line)}</span>`)
            .join("")}
        </div>
      </div>
    </div>
  `;

  renderLines(allSymbols, currentUi);
};

const loadConfig = async () => {
  try {
    const response = await fetch("./marca.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();

    try {
      const assetsResponse = await fetch("./assets/manifest.json", { cache: "no-store" });
      if (assetsResponse.ok) {
        render(mergeAssetManifest(config, await assetsResponse.json()));
        return;
      }
    } catch {
      // Si el manifest no está disponible, conserva la galería del JSON principal.
    }

    render(config);
  } catch {
    render(FALLBACK_CONFIG);
  }
};

loadConfig();
