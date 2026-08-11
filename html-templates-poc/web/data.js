// Generado a partir de data.json — mismo contenido, cargado como <script> para
// que funcione al abrir el HTML con doble clic (fetch() de archivos locales
// esta bloqueado por CORS bajo file://). script.js intenta fetch primero y
// cae a esta variable si falla.
window.NEXA_DATA = {
  "channels": [
    {
      "id": "youtube",
      "label": "YouTube",
      "accounts": [
        {
          "id": "cuenta_1",
          "label": "cuenta_1",
          "sub": "Nexa Brief · Lofi & Jazz",
          "status": "connected"
        }
      ]
    },
    {
      "id": "tiktok",
      "label": "TikTok",
      "accounts": [
        {
          "id": "cuenta_1",
          "label": "cuenta_1",
          "sub": "Activa",
          "status": "connected"
        },
        {
          "id": "cuenta_2",
          "label": "cuenta_2",
          "sub": "Token expirado",
          "status": "expired"
        }
      ]
    },
    {
      "id": "facebook",
      "label": "Facebook",
      "accounts": []
    }
  ],
  "niches": [
    "Lofi",
    "Jazz",
    "Ambiente",
    "Clásico",
    "Estudio"
  ],
  "templates": [
    {
      "id": "image-bg",
      "order": 1,
      "folder": "01-image-bg",
      "name": "Imagen con fondo",
      "input": "Imagen",
      "description": "El fondo se funde con la página (ilusión de solo-objeto), letras cortas en las posiciones del JSON, imagen con movimiento suave, música acorde.",
      "example": "Mihawk — Swordsman Legend",
      "thumb": "../production/01-image-bg/pruebas-ia/mihawk-desktop-1625x983-AFTER.png",
      "configFile": "01-image-bg/pruebas-ia/config-mihawk-CORREGIDO.json",
      "config": {
        "img": {
          "w": 1080,
          "h": 1920,
          "src": "img/bg5.png"
        },
        "colors": {
          "bg": "#050505",
          "ink": "#FFFFFF"
        },
        "bgMode": "regions",
        "bgRegions": [
          {
            "color": "#050505",
            "ink": "#FFFFFF",
            "rect": [
              0,
              0,
              540,
              1920
            ]
          },
          {
            "color": "#F9F9F9",
            "ink": "#000000",
            "rect": [
              540,
              0,
              1080,
              1920
            ]
          }
        ],
        "zones": [
          [
            145,
            480,
            320,
            760
          ],
          [
            481,
            1050,
            280,
            800
          ],
          [
            1051,
            1920,
            190,
            890
          ]
        ],
        "subject": {
          "top": 145,
          "bottom": 1920,
          "left": 190,
          "right": 890
        },
        "keepOut": [
          [
            190,
            260,
            290,
            430
          ],
          [
            20,
            460,
            1060,
            940
          ],
          [
            740,
            1080,
            980,
            1170
          ],
          [
            740,
            1160,
            980,
            1360
          ]
        ],
        "texts": {
          "left": "SWORDSMAN",
          "right": "LEGEND"
        },
        "eqPosition": "bottom",
        "edgeFade": 0.07,
        "typography": "serif-display"
      }
    },
    {
      "id": "subject-png",
      "order": 2,
      "folder": "02-subject-png",
      "name": "Imagen sin fondo (PNG)",
      "input": "PNG recortado",
      "description": "La IA decide el fondo (colores fuertes) y pone letras EN GRANDE detrás (aura, poder, nombre del personaje...), animaciones suaves.",
      "example": "Power",
      "thumb": "../production/02-subject-png/pruebas-ia/power-desktop-1920x1080.png",
      "configFile": "02-subject-png/config2.json",
      "config": {
        "subject": {
          "src": "img/5.png",
          "w": 399,
          "h": 501,
          "label": "sharp-dressed man adjusting his tie, composed and severe",
          "knownName": "",
          "zones": {
            "head": [
              0,
              150,
              119,
              321
            ],
            "mid": [
              150,
              340,
              2,
              398
            ],
            "low": [
              340,
              500,
              0,
              398
            ]
          }
        },
        "bg": {
          "colors": [
            "#C9A227",
            "#231B0C",
            "#070603"
          ],
          "style": "radial"
        },
        "blend": "none",
        "giantWord": "POWER",
        "giantColor": "rgba(230,220,195,0.92)",
        "particles": {
          "type": "embers",
          "color": "#C9A227",
          "dark": "#100C04",
          "count": 16
        },
        "glow": {
          "color": "#C9A227",
          "intensity": 0.42
        },
        "effect": "sparks",
        "ink": "#E6DCC3",
        "brand": {
          "name": "NEXA",
          "sub": "BRIEF"
        },
        "audio": {
          "src": "song.mp3",
          "simulatedBpm": 92
        },
        "seed": 7
      }
    },
    {
      "id": "landscape-scene",
      "order": 3,
      "folder": "03-landscape-scene",
      "name": "Paisaje completo",
      "input": "Imagen de escena",
      "description": "Escena viva a pantalla completa: pétalos del color de la imagen, aves, letra corta vertical en la esquina calma.",
      "example": "Carmine — Haiku",
      "thumb": "../production/03-landscape-scene/pruebas-ia/carmine-desktop-1920x1080.png",
      "configFile": "03-landscape-scene/config.json",
      "config": {
        "img": {
          "src": "img/jav2.png",
          "w": 1672,
          "h": 941,
          "focal": [
            869,
            282
          ]
        },
        "palette": {
          "petals": [
            {
              "fill": "#FFA500",
              "stroke": "#FF4500",
              "vein": "rgba(255,200,150,0.8)"
            },
            {
              "fill": "#FF4500",
              "stroke": "#D2691E",
              "vein": "rgba(255,180,100,0.7)"
            },
            {
              "fill": "#FFD700",
              "stroke": "#B8860B",
              "vein": "rgba(255,255,200,0.9)"
            }
          ],
          "fog": "110,55,75",
          "bird": "#ff9a6c",
          "textCycle": [
            "#421A25",
            "#FFA500"
          ],
          "brand": "#ff9a6c"
        },
        "text": {
          "lines": [
            "花は散り",
            "名を覚えている",
            "風ばかり"
          ],
          "orientation": "vertical",
          "xPct": 10.0,
          "yPct": 10.0,
          "letterSpacing": 0.28,
          "lineHeight": 2.2,
          "fontMin": 32,
          "fontMax": 55
        },
        "brand": {
          "nexa": "NEXA",
          "brief": "BRIEF"
        },
        "birds": {
          "max": 5,
          "chance": 0.007
        },
        "physics": {
          "direction": -1,
          "petalCount": 160,
          "fogCount": 8,
          "gravity": 0.18,
          "turbulence": 0.6
        },
        "audio": {
          "src": "song.mp3"
        },
        "intro": {
          "artist": "SHIBUYA BASS",
          "title": "SORCERER KILLER",
          "sub": "Dark",
          "feats": "Jujutsu High"
        }
      }
    },
    {
      "id": "video-motion",
      "order": 4,
      "folder": "04-video-motion",
      "name": "Video en loop",
      "input": "Video corto",
      "description": "Como la plantilla de imagen con fondo, pero en video: margen de movimiento, rotación, letterbox, texto incrustado respetado.",
      "example": "Swift Blade",
      "thumb": "../production/04-video-motion/pruebas-ia/video1-desktop-1440x900.png",
      "configFile": "04-video-motion/pruebas-ia/config-video1.json",
      "config": {
        "id": "video1",
        "description": "Loop apaisado (16:9) en tinta sumi-e de una espadachina en pleno corte, con inscripción kanji. Blanco y negro dramático.",
        "video": {
          "w": 748,
          "h": 418,
          "rotation": 0,
          "content": [
            0,
            0,
            748,
            418
          ],
          "src": "video/video1.mp4"
        },
        "colors": {
          "bg": "#020203",
          "ink": "#EDECEA"
        },
        "bgMode": "solid",
        "zones": [
          [
            18,
            140,
            400,
            680
          ],
          [
            140,
            265,
            0,
            748
          ],
          [
            265,
            418,
            355,
            748
          ]
        ],
        "subject": {
          "top": 18,
          "bottom": 418,
          "left": 0,
          "right": 748
        },
        "keepOut": [
          [
            136,
            176,
            222,
            213
          ],
          [
            706,
            394,
            748,
            418
          ]
        ],
        "texts": {
          "left": "SWIFT",
          "right": "BLADE"
        },
        "eqPosition": "bottom",
        "edgeFade": 0.07,
        "typography": "serif-display",
        "anchorPreference": "bottom",
        "audio": {
          "src": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
        },
        "intro": {
          "artist": "RONIN LO-FI",
          "title": "SWIFT BLADE",
          "sub": "Lo-fi",
          "feats": "Samurai"
        },
        "outro": {
          "leadSec": 7,
          "songTitle": "SWIFT BLADE",
          "title": "Gracias",
          "sub": "Por ver",
          "feats": "Suscríbete"
        }
      }
    },
    {
      "id": "lyrics",
      "order": 5,
      "folder": "05-lyrics",
      "name": "Letras de la canción",
      "input": "Canción (audio)",
      "description": "Letras sincronizadas palabra a palabra durante toda la canción; el estilo visual (triste, suave, impacto, neón, romántico) lo decide el género musical.",
      "example": "Estilo Romántico — Bruses: Dueles Tan Bien",
      "thumb": "../production/05-lyrics/pruebas-ia/romantico-desktop-1920x1080.png",
      "configFile": "05-lyrics/romantico/config.json",
      "config": {
        "activeId": "dueles-tan-bien",
        "description": "Romántica — carta escrita a mano: serif itálica marfil + caligrafía rosa viejo que se escribe carácter a carácter, bokeh cálido y latido en las líneas enfatizadas.",
        "audio": {
          "src": "Bruses Dueles Tan Bien Audio.mp3"
        },
        "lyricsUrl": "lyrics-bruses-dueles-tan-bien.json",
        "bg": {
          "type": "image",
          "src": "bg8.jpg",
          "filter": "grayscale(0.35) brightness(0.30) contrast(1.05) sepia(0.35) hue-rotate(-24deg) saturate(1.25)"
        },
        "fonts": {
          "googleUrl": "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500;1,700&family=Great+Vibes&display=swap",
          "serif": "\"Playfair Display\", serif",
          "script": "\"Great Vibes\", cursive"
        },
        "colors": {
          "serif": "#F2E7DA",
          "script": "#D89A9E",
          "muted": "#cbb8ad"
        },
        "intro": {
          "artist": "Kevin Kaarl",
          "title": "Colapso",
          "sub": "",
          "feats": ""
        },
        "outro": {
          "leadSec": 8,
          "title": "Gracias",
          "sub": "por escuchar",
          "feats": "Suscríbete · NEXA BRIEF"
        },
        "layout": {
          "groupGapSec": 0.42,
          "maxRowChars": 22,
          "rowGapVh": 3.6,
          "scriptChanceSolo": 0.75,
          "maxTiltDeg": 1.6,
          "charStepMs": 55
        },
        "bokeh": {
          "count": 16,
          "tint": "216,140,140"
        },
        "seed": 14
      }
    }
  ],
  "dashboardLists": {
    "hoy": [
      {
        "title": "Ambiente Zen #7",
        "channel": [
          "tiktok"
        ],
        "time": "07:50",
        "meta": "Falló · token expirado",
        "tab": "fallidos"
      },
      {
        "title": "Lofi Nocturno #24",
        "channel": [
          "youtube"
        ],
        "time": "08:15",
        "meta": "Publicado",
        "tab": "publicados"
      },
      {
        "title": "Jazz de Estudio #11",
        "channel": [
          "youtube",
          "tiktok"
        ],
        "time": "09:40",
        "meta": "Listo para publicar",
        "tab": "listos"
      },
      {
        "title": "Ambiente Nocturno #5",
        "channel": [
          "youtube"
        ],
        "time": "10:05",
        "meta": "Listo para publicar",
        "tab": "listos"
      },
      {
        "title": "Lofi Nocturno #25",
        "channel": [],
        "time": "11:20",
        "meta": "En cola · Etapa 6",
        "tab": "cola"
      },
      {
        "title": "Ambiente Zen #8",
        "channel": [],
        "time": "11:45",
        "meta": "En cola · Etapa 3",
        "tab": "cola"
      }
    ],
    "cola": [
      {
        "title": "Lofi Nocturno #25",
        "channel": [
          "youtube",
          "tiktok"
        ],
        "time": "~ 8 min restantes",
        "meta": "Etapa 6 · Grabación con Playwright",
        "tab": "cola"
      },
      {
        "title": "Ambiente Zen #8",
        "channel": [
          "youtube"
        ],
        "time": "~ 15 min restantes",
        "meta": "Etapa 3 · Buscando recursos (imagen/música)",
        "tab": "cola"
      },
      {
        "title": "Estudio Sereno #3",
        "channel": [
          "tiktok"
        ],
        "time": "~ 22 min restantes",
        "meta": "Etapa 1 · Analizando categoría",
        "tab": "cola"
      }
    ],
    "publicados": [
      {
        "title": "Lofi Nocturno #24",
        "channel": [
          "youtube"
        ],
        "time": "Hace 12 min",
        "tab": "publicados"
      },
      {
        "title": "Jazz Cálido #10",
        "channel": [
          "tiktok"
        ],
        "time": "Ayer",
        "tab": "publicados"
      },
      {
        "title": "Ambiente Sereno #9",
        "channel": [
          "youtube"
        ],
        "time": "Ayer",
        "tab": "publicados"
      },
      {
        "title": "Clásico Relajante #1",
        "channel": [
          "youtube"
        ],
        "time": "Hace 2 días",
        "tab": "publicados"
      },
      {
        "title": "Estudio Nocturno #6",
        "channel": [
          "tiktok"
        ],
        "time": "Hace 2 días",
        "tab": "publicados"
      },
      {
        "title": "Lofi Atardecer #23",
        "channel": [
          "youtube"
        ],
        "time": "Hace 3 días",
        "tab": "publicados"
      },
      {
        "title": "Jazz Urbano #9",
        "channel": [
          "tiktok"
        ],
        "time": "Hace 3 días",
        "tab": "publicados"
      },
      {
        "title": "Ambiente Zen #6",
        "channel": [
          "youtube"
        ],
        "time": "Hace 4 días",
        "tab": "publicados"
      },
      {
        "title": "Clásico Sereno #4",
        "channel": [
          "youtube"
        ],
        "time": "Hace 4 días",
        "tab": "publicados"
      },
      {
        "title": "Estudio Cálido #5",
        "channel": [
          "tiktok"
        ],
        "time": "Hace 5 días",
        "tab": "publicados"
      },
      {
        "title": "Lofi Nocturno #22",
        "channel": [
          "youtube"
        ],
        "time": "Hace 5 días",
        "tab": "publicados"
      },
      {
        "title": "Jazz de Estudio #8",
        "channel": [
          "tiktok"
        ],
        "time": "Hace 6 días",
        "tab": "publicados"
      },
      {
        "title": "Ambiente Nocturno #4",
        "channel": [
          "youtube"
        ],
        "time": "Hace 6 días",
        "tab": "publicados"
      },
      {
        "title": "Clásico Relajante #0",
        "channel": [
          "youtube"
        ],
        "time": "Hace 7 días",
        "tab": "publicados"
      }
    ],
    "fallidos": [
      {
        "title": "Ambiente Zen #7",
        "channel": [
          "tiktok"
        ],
        "time": "Hace 1h 20m",
        "meta": "cuenta_2 — token expirado",
        "tab": "fallidos"
      }
    ]
  },
  "stats": {
    "videosHoy": 6,
    "videosHoyDelta": "+2 vs. ayer",
    "enCola": 3,
    "enColaMeta": "Grabación / empaquetado",
    "publicados": 128,
    "publicadosMeta": "Últimos 30 días",
    "fallidos": 1,
    "fallidosMeta": "Requiere atención"
  },
  "activity": [
    {
      "type": "ok",
      "title": "Lofi Nocturno #24 publicado en YouTube",
      "meta": "cuenta_1 · 2h 5m de duración",
      "time": "Hace 12 min"
    },
    {
      "type": "ready",
      "title": "Jazz de Estudio #11 terminó grabación",
      "meta": "Listo para publicar · TikTok, YouTube",
      "time": "Hace 40 min"
    },
    {
      "type": "error",
      "title": "Falló publicación de Ambiente Zen #7",
      "meta": "TikTok · cuenta_2 — token expirado",
      "time": "Hace 1h 20m"
    },
    {
      "type": "new",
      "title": "Nuevo lote creado: Clásico Relajante · 4 videos",
      "meta": "Duración: 2h · Canales: YouTube",
      "time": "Hace 3h"
    }
  ],
  "schedule": [
    {
      "channel": "youtube",
      "account": "cuenta_1",
      "days": "Todos los días",
      "times": [
        "09:00",
        "21:00"
      ]
    },
    {
      "channel": "tiktok",
      "account": "cuenta_1",
      "days": "Lun – Vie",
      "times": [
        "14:00",
        "18:00",
        "20:00"
      ]
    },
    {
      "channel": "tiktok",
      "account": "cuenta_2",
      "days": "Fines de semana",
      "times": [
        "12:00"
      ]
    }
  ],
  "videos": {
    "listos": [
      {
        "title": "Jazz de Estudio #11",
        "duration": "2:58:00",
        "channels": [
          "youtube",
          "tiktok"
        ],
        "readySince": "Listo hace 40 min",
        "template": "image-bg"
      },
      {
        "title": "Ambiente Nocturno #5",
        "duration": "1:59:40",
        "channels": [
          "youtube"
        ],
        "readySince": "Listo hace 2h",
        "template": "landscape-scene"
      },
      {
        "title": "Clásico Relajante #2",
        "duration": "3:00:12",
        "channels": [
          "tiktok"
        ],
        "readySince": "Listo hace 5h",
        "template": "video-motion"
      }
    ],
    "cola": [
      {
        "title": "Lofi Nocturno #25",
        "stage": "Etapa 6 · Grabación con Playwright",
        "eta": "~ 8 min restantes",
        "template": "lyrics"
      },
      {
        "title": "Ambiente Zen #8",
        "stage": "Etapa 3 · Buscando recursos (imagen/música)",
        "eta": "~ 15 min restantes",
        "template": "landscape-scene"
      },
      {
        "title": "Estudio Sereno #3",
        "stage": "Etapa 1 · Analizando categoría",
        "eta": "~ 22 min restantes",
        "template": "image-bg"
      }
    ],
    "publicados": [
      {
        "title": "Lofi Nocturno #24",
        "duration": "2:05:00",
        "channels": [
          "youtube"
        ],
        "publishedAt": "Hace 12 min",
        "template": "lyrics"
      },
      {
        "title": "Jazz Cálido #10",
        "duration": "1:00:00",
        "channels": [
          "tiktok"
        ],
        "publishedAt": "Ayer",
        "template": "subject-png"
      }
    ],
    "publicadosExtra": 126,
    "fallidos": [
      {
        "title": "Ambiente Zen #7",
        "channel": "tiktok",
        "account": "cuenta_2",
        "reason": "Token expirado",
        "template": "landscape-scene"
      }
    ]
  },
  "historial": {
    "videos": [
      "Jazz de Estudio #11",
      "Lofi Nocturno #25 (en curso)",
      "Ambiente Zen #7 (falló)"
    ],
    "steps": [
      {
        "n": 1,
        "title": "Análisis de entrada",
        "meta": "Gemini Flash-Lite · 01_input_completado.json",
        "done": true
      },
      {
        "n": 2,
        "title": "Diseño visual",
        "meta": "Skill: jazz.md · 02_diseno_visual.json",
        "done": true
      },
      {
        "n": 3,
        "title": "Recursos (imagen y música)",
        "meta": "Unsplash · biblioteca local",
        "done": true
      },
      {
        "n": 4,
        "title": "Arquitecto de prompts",
        "meta": "03_prompt_generacion.txt",
        "done": true
      },
      {
        "n": 5,
        "title": "Generación de HTML",
        "meta": "DeepSeek-V3.2 · 04_html_generado_log.json",
        "done": true
      },
      {
        "n": 6,
        "title": "Grabación (Playwright + FFmpeg)",
        "meta": "youtube_video.mp4 · tiktok_video.mp4",
        "done": true
      },
      {
        "n": 7,
        "title": "Resumen y empaquetado",
        "meta": "05_resumen_final.json · título, descripción, hashtags",
        "done": true
      },
      {
        "n": 8,
        "title": "Publicación",
        "meta": "En cola — se publicará según horario configurado",
        "done": false
      }
    ]
  }
};
