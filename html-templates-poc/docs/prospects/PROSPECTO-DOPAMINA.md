# PROSPECTO — MOTOR DE DOPAMINA
### Investigación: mecánicas de retención y recompensa visual para las plantillas del pipeline
**Fecha:** Julio 2026 · **Tipo:** Solo investigación (las plantillas/JSON vienen después)

---

## 1. FUNDAMENTO: QUÉ DISPARA DOPAMINA REALMENTE

La dopamina no se libera por el estímulo en sí — se libera por la **anticipación de
la recompensa** y por la **sorpresa de recompensa** (reward prediction error). Para
un loop visual con música esto se traduce en 4 palancas:

| Palanca | Qué es | Cómo se ve en pantalla |
|---|---|---|
| **Anticipación** | El cerebro detecta que "algo viene" | Build-up visual: una palabra que se carga/tensa justo ANTES del beat; partículas que aceleran antes del drop |
| **Recompensa sincronizada** | La coincidencia exacta audio↔visual se percibe como acierto | La palabra estalla EN el beat, no cerca del beat; el flash cae EN el golpe |
| **Recompensa variable** | Lo impredecible engancha más que lo fijo (Skinner) | Micro-variaciones: no todas las palabras entran igual; cada loop tiene un detalle distinto |
| **Cierre perfecto (loop)** | Un ciclo sin costura invita a verlo otra vez sin darse cuenta | Nuestro seamless: no se sabe dónde termina el video NI dónde termina el loop |

**Insight clave para nuestro sistema:** ya tenemos la palanca 4 resuelta (la ilusión
seamless ES una mecánica de dopamina — elimina la señal de "esto terminó" que corta
la retención). Este prospecto agrega las palancas 1–3.

---

## 2. MECÁNICAS CONCRETAS (ordenadas por impacto/esfuerzo)

### 2.1 Sincronización letra↔beat (impacto MUY ALTO, esfuerzo medio)
La mecánica reina. Una palabra que aparece EXACTAMENTE en su sílaba cantada produce
el "acierto" que el cerebro premia. Requisitos:
- Timestamps por palabra (ver PROSPECTO-TOTAL §4: Whisper/transcripción forzada).
- Entrada en ≤120ms (el ojo percibe >150ms como "tarde").
- Anticipación: la palabra puede pre-materializarse tenue 200–300ms antes
  (opacity 0.15, escala 0.8) y ESTALLAR en el timestamp.

### 2.2 Partículas ambientales coherentes con la escena (impacto ALTO, esfuerzo medio)
La idea de jav.html / jav-2.html: pétalos, pájaros, polvo, brasas — elegidos SEGÚN el
fondo de la imagen. Dan "vida" a una imagen estática y sostienen la mirada entre
beats (la palanca de anticipación necesita un "reposo activo").
- **Automatizable**: el JSON de visión ya describe la escena (`scene_overview.style`,
  colores) → un campo nuevo `ambient` elegido por la IA:
  `{ type: "petals" | "birds" | "dust" | "embers" | "snow" | "rain" | "none",
     density: 0-1, tint: "#HEX" }`.
- Regla de coherencia: el `tint` de las partículas sale de la paleta medida del
  fondo (nunca colores ajenos a la imagen).
- Presupuesto de rendimiento: canvas único (NO divs), ≤120 partículas, solo
  transform/alpha.

### 2.3 Micro-variación por ciclo (impacto MEDIO, esfuerzo bajo)
Recompensa variable: en cada repetición del loop cambia UN detalle menor —
la trayectoria de las partículas, qué palabra recibe el glow, el ángulo del
destello. Implementación barata: seed = número de loop → parámetros ligeramente
distintos. El espectador no sabe por qué, pero "algo" lo mantiene mirando.
- ⚠️ Para grabación headless: el seed debe ser determinista (loop N → seed N),
  nunca Math.random() sin semilla.

### 2.4 Acentos de color de alta saturación (impacto MEDIO, esfuerzo bajo)
El ojo va primero a lo más saturado. Regla de diseño automatizable:
- Fondo desaturado o plano (ya lo medimos) + UN acento saturado (`colors.glow`)
  reservado para los momentos de recompensa (la palabra activa, el flash).
- El glow lo elige la IA de visión: el color más saturado presente en el sujeto
  (nunca inventado) → coherencia garantizada.

### 2.5 Respiración de la imagen (impacto BAJO-MEDIO, esfuerzo bajo)
Zoom lentísimo (scale 1.00→1.04 en 20–30s, alternando) + parallax sutil de capas.
Elimina la sensación de "póster muerto" sin robar atención. Con imagen sin fondo
(PNG del sujeto separado): el sujeto y el fondo se mueven a velocidades distintas
(parallax real, como 1.HTML/2.html del usuario).

---

## 3. EL CICLO DE DOPAMINA COMPLETO (cómo se orquestan)

```
   REPOSO ACTIVO          ANTICIPACIÓN           RECOMPENSA          RESOLUCIÓN
 (entre beats)          (200-300ms antes)         (en el beat)        (después)
 partículas flotan  →   palabra pre-brilla   →   palabra ESTALLA  →  palabra se
 imagen respira         partículas aceleran      + glow + flash      dispersa suave
 letra pasada tenue     micro-tensión visual     sincronizado        vuelve el reposo
        ▲                                                                 │
        └─────────────────────── loop sin costura ────────────────────────┘
```

Regla de oro: **nunca dos recompensas seguidas sin reposo**. La saturación de
estímulos mata la anticipación (y la dopamina). Ratio sano: ~70% reposo activo,
~20% anticipación, ~10% recompensa.

---

## 4. PARÁMETROS CALIBRABLES (para el futuro CONFIG)

| Parámetro | Rango sano | Default | Nota |
|---|---|---|---|
| `ambient.density` | 0–1 | 0.4 | >0.7 distrae de las letras |
| `ambient.speed` | 0.2–1.5 | 0.6 | px/frame relativo |
| `anticipation_ms` | 150–350 | 250 | pre-brillo antes del beat |
| `reward_scale` | 1.1–1.6 | 1.3 | escala del estallido de palabra |
| `variation_per_loop` | on/off | on | seed determinista por ciclo |
| `breathe_amplitude` | 0–0.06 | 0.03 | zoom respiración |
| `glow_color` | de la paleta | — | el más saturado del sujeto |

---

## 5. RIESGOS Y LÍMITES

1. **Sobreestimulación**: más estímulo ≠ más dopamina. Pasado el umbral, el cerebro
   se desensibiliza y abandona. El ratio 70/20/10 del §3 es el control.
2. **Fotosensibilidad**: los destellos pertenecen al PROSPECTO-ADRENALINA — ahí se
   fijan los límites (≤3 flashes/s, WCAG 2.3.1). Las mecánicas de este prospecto
   son seguras por diseño.
3. **Rendimiento**: partículas SOLO en canvas, animaciones SOLO transform/opacity.
   Nada de box-shadow animado por frame en muchos nodos (mata el headless a 60fps).
4. **Determinismo para grabación**: toda aleatoriedad con seed; el análisis de
   audio pre-computado offline (ver PROSPECTO-TOTAL §5).

## 6. QUÉ APORTA A LAS PLANTILLAS EXISTENTES

Este prospecto NO reemplaza el motor v7/v8/v9 — se monta encima:
- v9 aporta: seamless, regiones, tinta, keepOut, orientación.
- Dopamina aporta: `ambient{}` (partículas coherentes), `breathe{}`, glow de paleta,
  micro-variación por loop, y las reglas de ritmo del §3 que gobiernan al motor de
  letras (PROSPECTO-TOTAL).

**Prototipos del usuario que ya apuntan aquí**: jav.html y jav-2.html (partículas
ambientales + letras vivas) son la semilla directa de §2.2; 1.HTML/2.html (sujeto
sin fondo con movimiento) son la semilla de §2.5.
