import asyncio, json, time
from src.core.library import asset_library
from src.adapters.lyrics.factory import get_lyrics_transcriber

async def main():
    path = asset_library.resolve_music_path("713985a2")
    t = time.time()
    out = await get_lyrics_transcriber().transcribe(path, language="es")
    json.dump(out, open("work/results/latin_es.json", "w"), ensure_ascii=False)
    print("listo en", round(time.time() - t), "s;", len(out.get("segments", [])), "segmentos;", out.get("metadata"))

asyncio.run(main())
