# =============================================================================
#  QWEN3-TTS · ECONOMÍA DEL SIGLO XIV — 5 configuraciones para comparar
#  (misma narración que output_economia de Novita, para comparar oído a oído)
# =============================================================================
#  Objetivo: replicar/superar ese estilo GRAVE con sentimiento y énfasis que te
#  gustó del 01_hd_DeepVoiceMan de Novita. Genera 5 audios con configs distintas:
#    1) VoiceDesign · grave documental MEXICANO NEUTRO
#    2) VoiceDesign · grave cálida y emotiva (emula el Deep_Voice_Man que te gustó)
#    3) VoiceDesign · grave épica e intensa (estilo tráiler)
#    4) CustomVoice · Uncle_Fu (voz grave de catálogo)
#    5) CustomVoice · Uncle_Fu con MÁS énfasis y pausas
#
#  SON DOS CELDAS. Antes de nada:
#    · Entorno de ejecución → Cambiar tipo de entorno → GPU (T4).
#    · Si ya rompiste torch en este runtime: "Desconectar y eliminar entorno".
#  Doc: https://github.com/QwenLM/Qwen3-TTS
# =============================================================================


# #############################################################################
# ###############################  CELDA  A  ##################################
# ####  (instalar SIN romper el torch-CUDA de Colab · NO reinicia nada)  ######
# #############################################################################
import subprocess
def _sh(c):
    print("＋", c)
    subprocess.run(c, shell=True)

_sh("pip install -q qwen-tts --no-deps")   # no arrastra torch/torchaudio
_sh("pip install -q transformers==4.57.3 accelerate==1.12.0 librosa soundfile onnxruntime einops sox")
_sh("apt-get -qq install -y sox")

import torch
_ok = torch.cuda.is_available()
print("\n" + "=" * 62)
print(f"torch={torch.__version__}  cuda={torch.version.cuda}  GPU_disponible={_ok}")
if _ok:
    print("✅ Todo bien. Corre la CELDA B (NO hace falta reiniciar).")
else:
    print("✖ Sin CUDA: activa GPU y/o 'Desconectar y eliminar entorno', y repite.")
print("=" * 62)


# #############################################################################
# ###############################  CELDA  B  ##################################
# #############  (5 configs de economía · después de la Celda A)  #############
# #############################################################################
import gc, shutil
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

if not torch.cuda.is_available():
    raise SystemExit("✖ CUDA NO disponible — revisa GPU, corre la CELDA A y reinicia si hace falta.")
print("✅ GPU:", torch.cuda.get_device_name(0), "| torch:", torch.__version__)

# ── CONFIG ───────────────────────────────────────────────────────────────────
SIZE    = "1.7B"
LANG    = "Spanish"
OUT_DIR = Path("/content/output_qwen_economia"); OUT_DIR.mkdir(exist_ok=True)
DTYPE   = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
ATTN    = "sdpa"

# ── Narración de economía (misma que Novita), texto plano + emoción por segmento ──
SEGMENTS = [
    {"emo": "Voz épica, grave y solemne, ritmo pausado, como el inicio de un gran documental histórico.",
     "text": ("Europa, siglo catorce. El continente despierta a una era de comercio como jamás se "
              "había visto. Los caminos se llenan de mercaderes, y las grandes ferias de Champaña laten "
              "con oro, seda y especias traídas desde el otro extremo del mundo. En el corazón de todo, "
              "tres ciudades italianas —Florencia, Venecia y Génova— se convierten en el centro "
              "financiero del mundo conocido.")},
    {"emo": "Tono fluido, informativo y seguro, con ligera admiración.",
     "text": ("Es la época en que nace la banca moderna. Las casas Bardi y Peruzzi prestan fortunas a "
              "reyes, a nobles y hasta al mismísimo Papa. Se inventan la letra de cambio, el crédito, la "
              "contabilidad por partida doble. Por primera vez en la historia, el dinero viaja más rápido "
              "que los ejércitos. Europa parecía, sencillamente, imparable.")},
    {"emo": "Tono narrativo y descriptivo, con interés y calidez.",
     "text": ("En las ciudades, los gremios lo controlaban todo. En Florencia, el Arte de la Lana "
              "transformaba la lana inglesa en los paños más finos de Europa; en Flandes, telares enteros "
              "trabajaban sin descanso. Artesanos, tejedores y comerciantes tejían, sin saberlo, la "
              "primera economía verdaderamente internacional de la historia.")},
    {"emo": "Tensión creciente y preocupación, ritmo algo más urgente y voz firme.",
     "text": ("Pero bajo tanta prosperidad, algo comenzaba a agrietarse. Entre mil trescientos quince y "
              "mil trescientos diecisiete, la Gran Hambruna vació los campos: lluvias interminables "
              "pudrieron las cosechas, y millones pasaron hambre. Y cuando el rey de Inglaterra se negó a "
              "pagar sus enormes deudas, los bancos más poderosos de Florencia cayeron, uno tras otro.")},
    {"emo": "Seriedad y tristeza profunda; es el CLÍMAX trágico. Voz baja, lenta y solemne, con mucho sentimiento y énfasis marcados.",
     "text": ("Y entonces… llegó la muerte. Año mil trescientos cuarenta y ocho. La Peste Negra cruzó el "
              "continente como una sombra silenciosa. En apenas tres años, murió un tercio de toda Europa. "
              "Pueblos enteros quedaron vacíos. Los mercados, en silencio. Las rutas, abandonadas. La "
              "economía que parecía eterna… se detuvo de golpe.")},
    {"emo": "Tono reflexivo y esperanzador; la voz se ilumina y se eleva con emoción.",
     "text": ("Y sin embargo, de aquella tragedia nació un mundo nuevo. Con tan pocos trabajadores vivos, "
              "la mano de obra pasó a valer oro. Los salarios subieron, los campesinos exigieron libertad, "
              "y el viejo orden feudal empezó a desmoronarse para siempre. De las cenizas del siglo "
              "catorce nacería, siglos más tarde, la economía moderna que hoy conocemos.")},
    {"emo": "Tono conclusivo, sabio y emotivo, cerrando con fuerza.",
     "text": ("Lo que el siglo catorce le enseñó al mundo es que ninguna riqueza es eterna. Que hasta las "
              "crisis más terribles también siembran el futuro. Porque la economía, al final, no es solo "
              "dinero: es la historia de cómo los seres humanos caen, se reinventan, y vuelven a empezar.")},
]

# ── Las 5 configuraciones a comparar ─────────────────────────────────────────
#   mode "design": desc = descripción de la voz (VoiceDesign)
#   mode "custom": speaker + extra (instrucción adicional de estilo)
CONFIGS = [
    {"key": "1_design_mx_neutro", "mode": "design",
     "desc": ("Voz masculina grave y profunda de narrador de documental histórico, con acento español "
              "latino NEUTRO (mexicano neutro, estilo doblaje profesional), timbre maduro, cálido y envolvente.")},
    {"key": "2_design_emotiva_grave", "mode": "design",
     "desc": ("Voz masculina muy grave, cálida y envolvente, que transmite mucha emoción y marca énfasis "
              "claros; acento español neutro, estilo de narrador de documental serio e íntimo.")},
    {"key": "3_design_epica_intensa", "mode": "design",
     "desc": ("Voz masculina muy grave, épica, cinematográfica e intensa, tipo tráiler de documental "
              "dramático, con gran presencia y fuerza; acento español neutro.")},
    {"key": "4_custom_UncleFu", "mode": "custom", "speaker": "Uncle_Fu", "extra": ""},
    {"key": "5_custom_UncleFu_enfatico", "mode": "custom", "speaker": "Uncle_Fu",
     "extra": " Marca mucho los énfasis y respira entre frases, con gran contundencia."},
]

DESIGN_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
CUSTOM_MODEL = f"Qwen/Qwen3-TTS-12Hz-{SIZE}-CustomVoice"


# ── Helpers ──────────────────────────────────────────────────────────────────
def load_model(model_id):
    print(f"→ Cargando {model_id} ...")
    for attn in (ATTN, "eager"):
        try:
            return Qwen3TTSModel.from_pretrained(
                model_id, device_map="cuda:0", dtype=DTYPE, attn_implementation=attn)
        except Exception as e:
            print(f"   attn={attn} falló: {e}")
    raise RuntimeError(f"No se pudo cargar {model_id}")

def free_model(m):
    del m; gc.collect(); torch.cuda.empty_cache()

def stitch(generate_one, out_name):
    pieces, sr = [], None
    for i, seg in enumerate(SEGMENTS, 1):
        print(f"    · seg {i}/{len(SEGMENTS)} ...", flush=True)
        wavs, sr = generate_one(seg)
        pieces.append(np.asarray(wavs[0], dtype=np.float32))
        pieces.append(np.zeros(int(sr * 0.35), dtype=np.float32))
    audio = np.concatenate(pieces)
    path = OUT_DIR / out_name
    sf.write(str(path), audio, sr)
    print(f"    ✔ {out_name}  ({len(audio)/sr:.0f}s)")
    return path


# ── Generación (agrupada por modelo para no recargar VRAM) ───────────────────
results = []
design_cfgs = [c for c in CONFIGS if c["mode"] == "design"]
custom_cfgs = [c for c in CONFIGS if c["mode"] == "custom"]

if design_cfgs:
    print("\n=== VoiceDesign (voces diseñadas) ===")
    try:
        m = load_model(DESIGN_MODEL)
        for c in design_cfgs:
            print(f"  {c['key']}")
            gen = lambda seg, c=c: m.generate_voice_design(
                text=seg["text"], language=LANG,
                instruct=f"{c['desc']} En este pasaje: {seg['emo']}")
            results.append(stitch(gen, f"{c['key']}.wav"))
        free_model(m)
    except Exception as e:
        print("  ✖ VoiceDesign falló:", e)

if custom_cfgs:
    print("\n=== CustomVoice (Uncle_Fu) ===")
    try:
        m = load_model(CUSTOM_MODEL)
        for c in custom_cfgs:
            print(f"  {c['key']}")
            gen = lambda seg, c=c: m.generate_custom_voice(
                text=seg["text"], language=LANG, speaker=c["speaker"],
                instruct=seg["emo"] + c.get("extra", ""))
            results.append(stitch(gen, f"{c['key']}.wav"))
        free_model(m)
    except Exception as e:
        print("  ✖ CustomVoice falló:", e)

# ── Resultado + descarga ─────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"Listo: {len(results)} audios en {OUT_DIR}")
for p in results:
    print("  -", p.name)

if results:
    try:
        zip_path = shutil.make_archive("/content/qwen_economia_resultados", "zip", OUT_DIR)
        print("\nDescargando", zip_path, "...")
        from google.colab import files
        files.download(zip_path)
    except Exception as e:
        print("\n(Descarga manual desde", OUT_DIR, ")", e)
else:
    print("\n⚠️  No se generó nada — revisa los errores de arriba.")
