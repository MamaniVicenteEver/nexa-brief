# =============================================================================
#  PRUEBA DE CONCEPTO — Qwen3-TTS (los 3 MODOS del modelo más nuevo)
#  Narración: "La caída de Constantinopla (1453)" con emociones
# =============================================================================
#  Son DOS CELDAS de Colab. ANTES de correr nada:
#    · Entorno de ejecución → Cambiar tipo de entorno → GPU (T4 sirve).
#    · Si en ESTE runtime ya corriste algo con "pip install -U" que rompió el
#      torch (error "Torch not compiled with CUDA enabled"): Entorno de
#      ejecución → "Desconectar y eliminar entorno" (factory reset) para volver
#      al torch-CUDA original de Colab. Eso re-descarga los modelos (~10 min),
#      pero es la forma 100% segura de arrancar limpio.
#
#  Doc oficial: https://github.com/QwenLM/Qwen3-TTS
# =============================================================================


# #############################################################################
# ###############################  CELDA  A  ##################################
# ####  (instalar SIN romper el torch-CUDA de Colab · NO reinicia nada)  ######
# #############################################################################
#  Clave: NO usamos -U y NO reinstalamos torch/torchaudio. En un runtime limpio,
#  Colab YA trae torch + torchaudio con CUDA; solo añadimos lo que falta con
#  --no-deps, así el torch bueno queda intacto y NO hay que reiniciar.
import subprocess
def _sh(c):
    print("＋", c)
    subprocess.run(c, shell=True)

_sh("pip install -q qwen-tts --no-deps")   # no arrastra torch/torchaudio
# deps de qwen-tts SIN torch/torchaudio (gradio se omite: solo es para su demo web).
# 'sox' es el paquete PYTHON (qwen_tts hace `import sox`) y necesita el binario apt de abajo.
_sh("pip install -q transformers==4.57.3 accelerate==1.12.0 librosa soundfile onnxruntime einops sox")
_sh("apt-get -qq install -y sox")

import torch
_ok = torch.cuda.is_available()
print("\n" + "=" * 62)
print(f"torch={torch.__version__}  cuda={torch.version.cuda}  GPU_disponible={_ok}")
if _ok:
    print("✅ Todo bien. Corre la CELDA B (NO hace falta reiniciar).")
else:
    print("✖ Sin CUDA. Haz 2 cosas y repite ESTA celda:")
    print("   1) Activa GPU (Entorno → Cambiar tipo de entorno → GPU).")
    print("   2) 'Desconectar y eliminar entorno' para restaurar el torch de Colab.")
print("=" * 62)


# #############################################################################
# ###############################  CELDA  B  ##################################
# #########  (ejecutar los 3 modos · DESPUÉS de la Celda A + reiniciar)  ######
# #############################################################################
import gc, shutil
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

# --- Chequeo DURO de CUDA: si no hay, se detiene con mensaje claro (no baja nada) ---
if not torch.cuda.is_available():
    raise SystemExit(
        "✖ CUDA NO disponible — no sigo para no perder tiempo.\n"
        f"  torch={torch.__version__}  cuda_build={torch.version.cuda}\n"
        "  Revisa: (1) GPU activada (Entorno→Cambiar tipo→GPU),\n"
        "          (2) corriste la CELDA A, (3) REINICIASTE el entorno."
    )
print("✅ GPU:", torch.cuda.get_device_name(0),
      "| torch:", torch.__version__, "| cuda:", torch.version.cuda)

# ----------------------------------------------------------------------------
# 1) CONFIG — ajusta a gusto
# ----------------------------------------------------------------------------
SIZE    = "1.7B"      # "1.7B" (mejor calidad/emoción) o "0.6B" (más rápido)
LANG    = "Spanish"
OUT_DIR = Path("/content/output_qwen"); OUT_DIR.mkdir(exist_ok=True)

# Voces de HOMBRE graves para el MODO 1 (CustomVoice):
#   Uncle_Fu (grave, maduro) · Aiden (americano)  — Ryan QUITADO (sonaba exagerado)
CUSTOM_VOICE_SPEAKERS = ["Uncle_Fu"]

# Voz a DISEÑAR en el MODO 2 (VoiceDesign) — con ACENTO MEXICANO NEUTRO:
VOICE_DESIGN_DESC = ("Voz masculina grave y potente de narrador de documental "
                     "histórico épico, timbre profundo, maduro y autoritario, con "
                     "acento español latino NEUTRO (mexicano neutro, estilo doblaje "
                     "profesional), sin acento marcado.")

# Referencia del MODO 3 (VoiceClone): la voz clonada COPIA el acento de la referencia.
#   El sample por defecto era INGLÉS -> por eso salía con acento fuerte.
#   ►► Para acento MEXICANO NEUTRO: sube a Colab un .wav en español neutro y pon su
#      ruta + el texto EXACTO que dice. TRUCO: usa uno de los audios que ya generaste
#      con Novita (p.ej. convierte 01_hd_DeepVoiceMan_economia.mp3 a .wav) como
#      referencia — es voz grave en español neutro.
REF_AUDIO = "/content/mi_referencia_es.wav"   # <- súbela a Colab y pon aquí su ruta
REF_TEXT  = "Escribe aquí EXACTAMENTE lo que se dice en tu audio de referencia."

# bf16 en A100/L4; fp16 en la T4 gratis. sdpa evita tener que compilar flash-attn.
DTYPE = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
ATTN  = "sdpa"

# ----------------------------------------------------------------------------
# 2) LA NARRACIÓN — momentos con EMOCIÓN distinta (arco dramático, ~1.5-2 min)
# ----------------------------------------------------------------------------
SEGMENTS = [
    {"emo": "Narra con voz épica, grave y solemne, ritmo pausado, como el inicio de un gran documental histórico.",
     "text": ("Año 1453. Constantinopla, la última luz del Imperio Romano, "
              "la ciudad que resistió mil años, se prepara para su hora final. "
              "Sus murallas, jamás conquistadas, están a punto de enfrentar "
              "la tormenta más grande de su historia.")},
    {"emo": "Con tensión creciente y sensación de peligro, ritmo más urgente, voz firme y dura.",
     "text": ("Más de ochenta mil soldados otomanos rodean la ciudad. "
              "Los colosales cañones del sultán Mehmed rugen día y noche, "
              "escupiendo fuego contra las piedras milenarias. "
              "Durante más de cuarenta días, el asedio no da tregua.")},
    {"emo": "Con miedo y desesperación contenida, voz baja, íntima y temblorosa.",
     "text": ("Dentro, apenas siete mil defensores sostienen lo imposible. "
              "El hambre carcome sus cuerpos, el agotamiento nubla sus ojos. "
              "Cada noche rezan sabiendo que quizá no vean el amanecer. "
              "El miedo se arrastra por las calles como una sombra.")},
    {"emo": "Con alegría y esperanza repentina, la voz se ilumina y se eleva con emoción.",
     "text": ("Pero entonces, ¡milagro! Cuatro barcos rompen el bloqueo otomano "
              "y alcanzan el puerto. La ciudad estalla en júbilo, las campanas "
              "repican, hay lágrimas de alegría. Por un instante, creen que "
              "el cielo no los ha abandonado.")},
    {"emo": "Con tristeza trágica y solemnidad final, voz lenta, profunda y muy emotiva.",
     "text": ("El alba del veintinueve de mayo lo cambió todo. Una pequeña puerta "
              "quedó abierta. Los otomanos irrumpieron como un río imparable. "
              "Constantino, el último emperador de Roma, arrojó sus insignias "
              "imperiales y se lanzó a la batalla para morir como un soldado más. "
              "Y así, después de mil años, Roma cayó para siempre.")},
]

# ----------------------------------------------------------------------------
# 3) Helpers
# ----------------------------------------------------------------------------
def load_model(model_id):
    print(f"→ Cargando {model_id} (dtype={DTYPE}) ...")
    for attn in (ATTN, "eager"):
        try:
            return Qwen3TTSModel.from_pretrained(
                model_id, device_map="cuda:0", dtype=DTYPE, attn_implementation=attn)
        except Exception as e:
            print(f"   attn={attn} falló: {e}")
    raise RuntimeError(f"No se pudo cargar {model_id}")

def free_model(m):
    del m; gc.collect()
    torch.cuda.empty_cache()

def stitch(generate_one, out_name):
    """Genera cada segmento (con su emoción) y los une en un solo audio."""
    pieces, sr = [], None
    for i, seg in enumerate(SEGMENTS, 1):
        print(f"    · segmento {i}/{len(SEGMENTS)} ...", flush=True)
        wavs, sr = generate_one(seg)
        pieces.append(np.asarray(wavs[0], dtype=np.float32))
        pieces.append(np.zeros(int(sr * 0.35), dtype=np.float32))  # pausa 0.35s
    audio = np.concatenate(pieces)
    path = OUT_DIR / out_name
    sf.write(str(path), audio, sr)
    print(f"    ✔ {out_name}  ({len(audio)/sr:.1f}s)")
    return path

def size_id(base):
    return f"Qwen/Qwen3-TTS-12Hz-{SIZE}-{base}"

results = []

# ----------------------------------------------------------------------------
# 4) MODO 1 — CustomVoice (voz de hombre grave + EMOCIÓN por segmento)
# ----------------------------------------------------------------------------
print("\n=== MODO 1 · CustomVoice (voces graves + emoción) ===")
try:
    m = load_model(size_id("CustomVoice"))
    for spk in CUSTOM_VOICE_SPEAKERS:
        print(f"  Voz: {spk}")
        gen = lambda seg, spk=spk: m.generate_custom_voice(
            text=seg["text"], language=LANG, speaker=spk, instruct=seg["emo"])
        results.append(stitch(gen, f"modo1_customvoice_{spk}.wav"))
    free_model(m)
except Exception as e:
    print("  ✖ MODO 1 falló:", e)

# ----------------------------------------------------------------------------
# 5) MODO 2 — VoiceDesign (diseña una voz épica + emoción)  [solo 1.7B]
# ----------------------------------------------------------------------------
print("\n=== MODO 2 · VoiceDesign (voz diseñada + emoción) ===")
try:
    m = load_model("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign")
    gen = lambda seg: m.generate_voice_design(
        text=seg["text"], language=LANG,
        instruct=f"{VOICE_DESIGN_DESC} En este pasaje: {seg['emo']}")
    results.append(stitch(gen, "modo2_voicedesign_epico.wav"))
    free_model(m)
except Exception as e:
    print("  ✖ MODO 2 falló:", e)

# ----------------------------------------------------------------------------
# 6) MODO 3 — VoiceClone (clona la voz de referencia)
# ----------------------------------------------------------------------------
print("\n=== MODO 3 · VoiceClone (voz clonada) ===")
try:
    m = load_model(size_id("Base"))
    gen = lambda seg: m.generate_voice_clone(
        text=seg["text"], language=LANG, ref_audio=REF_AUDIO, ref_text=REF_TEXT)
    results.append(stitch(gen, "modo3_voiceclone.wav"))
    free_model(m)
except Exception as e:
    print("  ✖ MODO 3 falló:", e)

# ----------------------------------------------------------------------------
# 7) Resultado + descarga
# ----------------------------------------------------------------------------
print("\n" + "=" * 60)
print(f"Listo: {len(results)} narraciones generadas en {OUT_DIR}")
for p in results:
    print("  -", p.name)

if results:
    try:
        zip_path = shutil.make_archive("/content/qwen_tts_resultados", "zip", OUT_DIR)
        print("\nDescargando", zip_path, "...")
        from google.colab import files
        files.download(zip_path)
    except Exception as e:
        print("\n(Descarga manual desde la carpeta", OUT_DIR, ")", e)
else:
    print("\n⚠️  No se generó nada — revisa los errores de cada MODO arriba.")
