# PROSPECTO-TOTAL — "LA EDICIÓN"
### El formato completo: canción muy conocida + letras entrando y saliendo todo el tiempo + todas las mecánicas orquestadas
**Fecha:** Julio 2026 · **Tipo:** Investigación y arquitectura (sin implementación) · Integra: motor seamless v7–v9 + PROSPECTO-DOPAMINA + PROSPECTO-ADRENALINA + los 5 prospectos HTML

---

## 1. QUÉ ES "LA EDICIÓN"

Una pieza de 30–90 segundos sobre una canción MUY conocida donde la letra es la
protagonista: cada palabra entra y sale sincronizada con la voz, el medio (imagen
o video) vive en loop seamless detrás, y las mecánicas de dopamina/adrenalina
suben y bajan siguiendo la estructura de la canción. El espectador reconoce la
canción en 1 segundo (gancho), lee las palabras que ya conoce (participación) y
recibe los picos visuales en los momentos que su memoria anticipa (recompensa).

Es el formato de mayor potencial de los estudiados, porque apila tres ganchos que
los prospectos individuales usan por separado: reconocimiento (canción famosa),
karaoke mental (letra sincronizada) y espectáculo (mecánicas visuales).

---

## 2. LA PREGUNTA CLAVE: ¿VARIOS MEDIOS O UNO SOLO?

**Recomendación: UN SOLO medio para la v1 — y la variedad se genera con "cambios
de modo", no con cambios de clip. Multi-media queda como evolución v2 sobre la
misma arquitectura.**

### Por qué un solo medio basta (y conviene) al principio

1. **La evidencia está en los propios prototipos**: 7.HTML impresiona con UNA foto
   y CERO contenido adicional; jav-2 sostiene una escena entera con UNA imagen.
   El 80% del impacto de una edición está en la sincronización letra↔beat y en la
   curva de intensidad — no en cortar entre clips.
2. **Costo de análisis lineal**: cada medio adicional = un análisis de visión
   completo (JSON v9). Con 1 medio, el costo por pieza es el que ya operamos hoy.
3. **La ilusión seamless es nuestra ventaja competitiva** — y un corte de clip la
   rompe. Las ediciones típicas de otros creadores cortan; la nuestra RESPIRA. Eso
   la diferencia.
4. **Validación más rápida**: con 1 medio, la v1 de La Edición reutiliza el motor
   v9 tal cual + el motor de letras. Multi-media exige además transiciones,
   precarga de N assets y decisiones de corte.

### El sustituto de la variedad: CAMBIOS DE MODO por sección

La canción se divide en secciones (intro/verso/coro/drop/puente — detectables
offline, ver §5) y cada sección activa un "modo" distinto SOBRE EL MISMO MEDIO:

```
INTRO   → modo ambient  (PROSPECTO-1: partículas, respiración, letra tenue)
VERSO   → modo dopamina (anticipación, palabra a palabra, glow de paleta)
CORO    → modo hype     (PROSPECTO-2: tinte intensificado + bass bounce + letras XL)
DROP    → modo adrenalina (PROSPECTO-5: glitch + flash + RGB-split + strobe seguro)
PUENTE  → vuelta a ambient (contraste = el próximo drop pega el doble)
```

El espectador percibe "cambió todo" sin que cambie el asset — la paleta se
intensifica, las partículas aceleran, el texto crece, el glitch entra. Esto da la
variedad de una edición multi-clip a costo de análisis CERO adicional.

### Cuándo SÍ pasar a multi-media (v2)

- Canciones con secciones muy narrativas (verso triste / coro eufórico) donde un
  solo medio no puede representar ambos.
- Regla de arquitectura: **1 medio por SECCIÓN de la canción** (no por compás ni
  por capricho), cortes SOLO en límites de sección, y la transición ES el flash
  de clímax (ADRENALINA §2.4) — el corte queda enmascarado por el destello, la
  ilusión seamless se conserva dentro de cada sección.
- Cada medio trae su propio JSON v9; el timeline (§4) ya contempla `scenes[]`
  desde la v1, así que pasar de 1 a N medios NO cambia la arquitectura, solo
  añade entradas al array.

---

## 3. LAS LETRAS: EL SISTEMA DE ENTRADA/SALIDA CONTINUA

El corazón del formato. Reglas de diseño (sintetizan dopamina + adrenalina):

1. **Ciclo de vida de cada palabra**: `upcoming` (pre-materializada tenue, 250ms
   antes — anticipación) → `active` (estalla EN el timestamp con el bezier
   elástico — recompensa) → `passed` (se dispersa a opacity 0.15 — resolución).
   Siempre hay algo entrando o saliendo: la pantalla nunca está "muerta".
2. **Posicionamiento por el motor v9**: las palabras caen en rectángulos seguros
   (fuera del sujeto, fuera de keepOut, tinta por región) — `bestFit`/`usable()`
   se reutilizan tal cual. Las líneas alternan de lado alrededor del sujeto.
3. **Jerarquía**: palabras clave de la canción (las que todos cantan) en tamaño
   XL con glow del acento; las conectivas pequeñas. La IA marca cuáles son
   (campo `emphasis` por palabra).
4. **Estilos por modo**: ambient = fade suave; dopamina = kinetic-pop; adrenalina
   = glitch/slide-bounce. El estilo lo decide la sección, no la palabra.
5. **Regla del 70/20/10** (DOPAMINA §3): la densidad visual respira — no todas
   las palabras pueden estallar igual o ninguna estalla.

---

## 4. MODELO DE DATOS (dirección para las futuras plantillas/JSON)

Tres archivos de entrada + el CONFIG que los une:

```
media/            → 1..N assets, cada uno con su JSON de visión v9 (ya resuelto)
lyrics.json       → [{ line, words: [{ text, start, end, emphasis }] }]
beats.json        → { bpm, bass_onsets[], drops[], sections: [{ start, end, type }], energy[] }

CONFIG v10 (dirección):
{
  scenes: [                        // v1: UNA entrada; v2: una por sección
    { media: {…v9 config…}, from: 0, to: 62.4, transition: "flash" }
  ],
  lyrics: {…lyrics.json…},
  modes: {                         // qué mecánicas activa cada tipo de sección
    intro:  { ambient: 0.4, lyricStyle: "fade",        adrenaline: 0   },
    verse:  { ambient: 0.4, lyricStyle: "kinetic-pop", adrenaline: 0.2 },
    chorus: { ambient: 0.6, lyricStyle: "kinetic-pop", adrenaline: 0.6, bounce: true },
    drop:   { ambient: 0.2, lyricStyle: "glitch",      adrenaline: 1.0, flashes: true },
    bridge: { ambient: 0.5, lyricStyle: "fade",        adrenaline: 0.1 }
  },
  safety: { flashCooldownMs: 350, maxBounce: 1.06, epilepsySafe: false }
}
```

Nada de esto se implementa aún — es el contrato que las plantillas y prompts
deberán cumplir.

---

## 5. PIPELINE DE PRODUCCIÓN COMPLETO (quién genera cada archivo)

```
[canción.mp3]
   ├─ Whisper (timestamps por PALABRA) ──────────→ lyrics.json   (automático)
   ├─ librosa/aubio (offline, 1 vez) ────────────→ beats.json    (bpm, onsets,
   │     · detección de secciones por energía        drops, secciones, energía)
   │     · determinista → grabaciones idénticas
[medio(s)]
   └─ Pipeline de visión v9 (captura → JSON) ────→ vision.json por medio

[los 3 JSON] → PROMPT 2 TOTAL (o script determinista) → index.html final
```

Puntos críticos ya investigados en los otros prospectos:
- **Determinismo**: beats.json pre-computado + RNG con semilla + reloj por
  `audio.currentTime` (ADRENALINA §4) → cada grabación sale idéntica.
- **Seguridad**: cooldown de flashes ≥350ms, bounce ≤1.06, modo epilepsy-safe
  (ADRENALINA §2.4). No negociable para publicación.
- **Letras de canciones conocidas y derechos**: la LETRA y la GRABACIÓN tienen
  copyright — para publicar hay que usar canciones con licencia disponible
  (biblioteca de la plataforma, acuerdos, o música libre con letra). El motor es
  agnóstico; la decisión de catálogo es de negocio, pero debe tomarse ANTES de
  producir en masa.

---

## 6. QUÉ APORTA CADA PIEZA YA ESTUDIADA

| Pieza | Aporte a La Edición |
|---|---|
| Motor v7–v9 (seamless, regiones, keepOut, orientación) | el escenario donde todo ocurre; posicionamiento seguro de cada palabra |
| PROSPECTO-1 (Escena Viva) | el modo ambient: partículas coherentes, reposo activo entre picos |
| PROSPECTO-2 (Tinte Total) | el modo coro: intensificación de paleta con una variable (hue) |
| PROSPECTO-4 (Spotlight) | mecánica especial: el foco revela palabras a su paso; reveal total en el drop |
| PROSPECTO-5 (Glitch Phonk) | el modo drop: glitch/strobe gobernado por beats |
| PROSPECTO-DOPAMINA | el ritmo 70/20/10 y el ciclo anticipación→recompensa de cada palabra |
| PROSPECTO-ADRENALINA | los 4 actuadores físicos + límites de seguridad + beats.json |

## 7. ROADMAP RECOMENDADO

| Fase | Entregable | Depende de |
|---|---|---|
| 1 | `beats.json` + `lyrics.json` (scripts de audio offline) | nada — es el desbloqueador de todo |
| 2 | Motor de letras cinéticas sobre plantilla v9 (1 medio, modo único) | Fase 1 |
| 3 | Modos por sección (ambient/hype/drop sobre el mismo medio) | Fases 1-2 + Prospectos 1, 2 y 5 refactorizados |
| 4 | La Edición v1 completa (1 medio, todos los modos, grabación determinista) | Fase 3 |
| 5 | Multi-media (1 medio por sección, transición flash) | Fase 4 validada con métricas |

## 8. VEREDICTO

La Edición no es una plantilla más — es el **formato integrador** hacia el que
apuntaba todo lo anterior. La decisión estructural más importante ya está tomada
con fundamento: **un solo medio + cambios de modo por sección** entrega la
experiencia completa con el costo de análisis actual, conserva la ilusión seamless
(nuestra diferencia), y deja la puerta abierta a multi-media sin re-arquitectura.
El desbloqueador real no es visual: son los dos JSON de audio (`beats.json`,
`lyrics.json`) — por ahí debe empezar la implementación.
