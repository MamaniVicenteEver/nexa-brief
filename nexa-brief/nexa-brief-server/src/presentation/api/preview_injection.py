"""Scripts que se inyectan en el HTML de una plantilla cuando se previsualiza
dentro de la app (tarjetas de /plantillas, modal, landing, drafts del Estudio).

Extraído de routers/templates.py para que cualquier endpoint que sirva un
index.html de plantilla (showcase, drafts) aplique EXACTAMENTE lo mismo.

Parámetros de query soportados:
  preview=card  → reproducción controlada por hover (tarjetas)
  controls=1    → controles del modal (play/pausa/seek/tiempo por postMessage)
  muted=1       → audio silenciado
  volume=<0..1> → volumen inicial (con controls=1)
  limit=<s>     → corta la vista previa a N segundos
"""

from __future__ import annotations

from collections.abc import Mapping

HIDE_RECORDER_STYLE = "<style>#rec-btn,#rec-panel{display:none!important}</style>"


def inject_preview_scripts(content: str, query_params: Mapping[str, str]) -> str:
    preview_script = ""
    if query_params.get("preview") == "card" or query_params.get("controls") == "1":
        preview_script = """
    <script>
    (() => {
      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
      const nativeSetInterval = window.setInterval.bind(window);
      const nativePlay = HTMLMediaElement.prototype.play;
      const queuedFrames = new Map();
      const queryParams = new URLSearchParams(window.location.search);
      const isCardPreview = queryParams.get("preview") === "card";
      const isControlledPreview = queryParams.get("controls") === "1";
      const requestedLimit = Number(queryParams.get("limit"));
      const maxDuration = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? requestedLimit
        : Number.POSITIVE_INFINITY;
      const initialPlaying = !isCardPreview;
      let requestedPlaying = initialPlaying;
      let isPlaying = initialPlaying;
      let resetVersion = 0;

      const previewStyle = document.createElement("style");
      previewStyle.textContent = `
        #hint,
        #tap {
          display: none !important;
        }
        html[data-nexa-preview-paused] *,
        html[data-nexa-preview-paused] *::before,
        html[data-nexa-preview-paused] *::after {
          animation-play-state: paused !important;
          transition: none !important;
        }
      `;
      document.head.appendChild(previewStyle);

      window.requestAnimationFrame = (callback) => {
        const id = nativeRequestAnimationFrame((time) => {
          if (!isPlaying) {
            queuedFrames.set(id, callback);
            return;
          }
          queuedFrames.delete(id);
          callback(time);
        });
        return id;
      };

      window.cancelAnimationFrame = (id) => {
        queuedFrames.delete(id);
        nativeCancelAnimationFrame(id);
      };

      window.setInterval = (callback, delay, ...args) => nativeSetInterval(() => {
        if (isPlaying) callback(...args);
      }, delay);

      HTMLMediaElement.prototype.play = function () {
        if (this.tagName === "VIDEO" || isCardPreview) {
          this.muted = true;
          this.volume = 0;
        }
        if (!isPlaying) {
          this.pause();
          return Promise.resolve();
        }
        return nativePlay.call(this);
      };

      const setMediaPlaying = (playing) => {
        document.querySelectorAll("audio, video").forEach((media) => {
          if (media.tagName === "VIDEO" || isCardPreview) {
            media.muted = true;
            media.volume = 0;
          }
          if (playing) {
            void media.play().catch(() => {});
          } else {
            media.pause();
          }
          });
      };

      const getPrimaryMedia = () => document.querySelector("audio") || document.querySelector("video");

      const flushQueuedFrames = () => {
        const callbacks = [...queuedFrames.values()];
        queuedFrames.clear();
        callbacks.forEach((callback) => {
          nativeRequestAnimationFrame((time) => callback(time));
        });
      };

      const reportMediaTime = (media) => {
        if (!isControlledPreview) return;
        window.parent.postMessage({
          type: "nexa-template-time",
          currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
          duration: Number.isFinite(media.duration) ? media.duration : 0,
        }, "*");
      };

      const finishPreview = () => {
        if (!isControlledPreview) return;
        setPlaying(false);
        window.parent.postMessage({ type: "nexa-template-ended" }, "*");
      };

      const seekMedia = (time) => {
        const media = getPrimaryMedia();
        if (!media) return;
        const duration = Number.isFinite(media.duration) && media.duration > 0
          ? Math.min(media.duration, maxDuration)
          : maxDuration;
        const nextTime = Math.max(0, Math.min(Number(time) || 0, duration));
        media.currentTime = nextTime;
        reportMediaTime(media);
        if (nextTime >= maxDuration) finishPreview();
      };

      const setPlaying = (playing) => {
        isPlaying = playing;
        document.documentElement.toggleAttribute("data-nexa-preview-paused", !playing);
        setMediaPlaying(playing);

        if (playing) {
          flushQueuedFrames();
        }
      };

      const startCardRuntime = () => {
        if (!isCardPreview) return;

        // Some legacy templates start their render loop only after an interaction
        // (#screen click or window pointerdown). The card itself owns the pointer,
        // so reproduce that interaction inside the isolated preview document.
        const startScreen = document.querySelector("#screen");
        if (startScreen) {
          startScreen.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
        document.body?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      };

      const resetPreview = () => {
        const version = ++resetVersion;
        requestedPlaying = false;
        setPlaying(false);

        const media = getPrimaryMedia();
        if (!media) {
          flushQueuedFrames();
          return;
        }

        media.pause();
        media.muted = true;
        media.volume = 0;
        try {
          // The template clocks use currentTime while media is playing. A tiny
          // positive value renders the deterministic t=0 scene before we pause.
          media.currentTime = 0.06;
        } catch (_) {}

        const drawFirstFrame = () => {
          if (version !== resetVersion || requestedPlaying) return;
          try { media.currentTime = 0.06; } catch (_) {}
          flushQueuedFrames();
          media.pause();
          try { media.currentTime = 0; } catch (_) {}
          reportMediaTime(media);
        };

        // Let the browser expose `paused === false` for the one render pass. This
        // prevents template clocks from falling back to their wall-clock branch.
        void Promise.resolve(nativePlay.call(media))
          .then(() => nativeRequestAnimationFrame(drawFirstFrame))
          .catch(() => {
            if (version === resetVersion && !requestedPlaying) flushQueuedFrames();
          });
      };

      window.addEventListener("message", (event) => {
        if (event.data?.type === "nexa-template-reset") {
          resetPreview();
          return;
        }

        if (event.data?.type === "nexa-template-seek") {
          seekMedia(event.data.time);
          return;
        }

        if (event.data?.type === "nexa-template-skip") {
          const media = getPrimaryMedia();
          if (media) seekMedia(media.currentTime + (Number(event.data.seconds) || 0));
          return;
        }

        if (
          event.data?.type !== "nexa-template-preview" &&
          event.data?.type !== "nexa-template-playback"
        ) return;
        requestedPlaying = event.data.playing === true;
        if (requestedPlaying) {
          resetVersion += 1;
          startCardRuntime();
        }
        setPlaying(requestedPlaying);
      });

      document.addEventListener("timeupdate", (event) => {
        if (!isControlledPreview || !(event.target instanceof HTMLMediaElement)) return;
        if (event.target !== getPrimaryMedia()) return;
        reportMediaTime(event.target);
        if (event.target.currentTime >= maxDuration) finishPreview();
      }, true);

      document.addEventListener("loadedmetadata", (event) => {
        if (event.target instanceof HTMLMediaElement && event.target === getPrimaryMedia()) {
          reportMediaTime(event.target);
        }
      }, true);

      document.addEventListener("ended", (event) => {
        if (event.target instanceof HTMLMediaElement && event.target === getPrimaryMedia()) {
          finishPreview();
        }
      }, true);

      window.addEventListener(
        "load",
        () => {
          window.setTimeout(() => {
            setPlaying(requestedPlaying);
            if (isCardPreview && !requestedPlaying) resetPreview();
          }, 100);
          if (isCardPreview) {
            [250, 600, 1200].forEach((delay) => {
              window.setTimeout(() => {
    if (!requestedPlaying) resetPreview();
              }, delay);
            });
          }
        },
        { once: true },
      );
    })();
    </script>
    """

    mute_script = """
    <script>
    (() => {
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (this.tagName === "AUDIO") {
          this.muted = true;
          this.volume = 0;
        }
        return play.call(this);
      };
      document.querySelectorAll("audio").forEach((audio) => {
        audio.muted = true;
        audio.volume = 0;
      });
    })();
    </script>
    """
    volume_script = """
    <script>
    (() => {
      let volume = Number(new URLSearchParams(window.location.search).get("volume"));
      if (!Number.isFinite(volume)) volume = 0.05;
      volume = Math.max(0, Math.min(1, volume));
      let muted = false;

      const applyVolume = (media) => {
        if (media.tagName === "VIDEO") {
          media.muted = true;
          media.volume = 0;
          return;
        }
        media.volume = volume;
        media.muted = muted;
      };

      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        applyVolume(this);
        return play.call(this);
      };

      const applyToAllMedia = () => {
        document.querySelectorAll("audio, video").forEach(applyVolume);
      };

      document.addEventListener("play", (event) => {
        if (event.target instanceof HTMLMediaElement) applyVolume(event.target);
      }, true);

      window.addEventListener("message", (event) => {
        if (event.data?.type !== "nexa-template-volume") return;
        volume = Math.max(0, Math.min(1, Number(event.data.volume) || 0));
        muted = event.data.muted === true;
        applyToAllMedia();
      });

      document.addEventListener("DOMContentLoaded", applyToAllMedia, { once: true });
      window.addEventListener("load", applyToAllMedia, { once: true });
      applyToAllMedia();
    })();
    </script>
    """
    scripts = ""
    if query_params.get("preview") == "card" or query_params.get("controls") == "1":
        scripts += preview_script
    if query_params.get("muted") == "1":
        scripts += mute_script
    if query_params.get("controls") == "1":
        scripts += volume_script
    # El motor de grabación ahora vive en la app (Estudio de /plantillas): el
    # que trae cada plantilla se oculta SIEMPRE, en toda vista previa.
    scripts += HIDE_RECORDER_STYLE
    return content.replace("</head>", f"{scripts}</head>", 1)
