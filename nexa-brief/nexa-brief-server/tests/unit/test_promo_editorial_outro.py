"""El cierre es compartido; no altera la música, otras promos ni los datos del video."""
import json
import shutil
import subprocess
from pathlib import Path
from urllib.request import urlopen

import pytest

SERVER = Path(__file__).resolve().parents[2]
COMPONENT = SERVER / "src/templates/nodemotion/commercial/promo-editorial/components/outro.js"


@pytest.mark.skipif(not shutil.which("node"), reason="Node no disponible")
def test_outro_timeline_reserves_tail_and_honors_json():
    subprocess.run(["node", "-e", r"""
      const assert = require('node:assert/strict');
      const context = { module: { exports: {} } };
      require('node:vm').runInNewContext(require('node:fs').readFileSync(process.argv[1], 'utf8'), context);
      const outro = context.module.exports;
      const scenes = [0, 10, 20, 28].map((t0, i, starts) => ({
        idx:i, t0, t1:starts[i+1] || 30, dur:(starts[i+1] || 30)-t0,
        type:'logo', slot:{type:'logo'}, seg:{text:'MARCA'}, words:[]
      }));
      const before = JSON.stringify(scenes);
      const tail = outro.timeline(scenes, 30);
      assert.equal(tail.at(-1).t0, 26.5);
      assert.equal(tail.at(-1).t1, 30);
      assert.equal(tail.at(-1).dur, 3.5);
      assert.equal(tail.at(-1).type, 'outro');
      assert.equal(tail.at(-2).t1, 26.5);
      assert.equal(JSON.stringify(scenes), before);
      assert.equal(outro.timeline(scenes,30,{enabled:false}), scenes);
      assert.equal(outro.timeline(scenes,30,{sec:4}).at(-1).t0,26);
      assert.equal(outro.timeline(scenes,30,{sec:'bad'}).at(-1).dur,3.5);
      assert.equal(outro.timeline(scenes,30,{type:'stack'},{stack(){}}).at(-1).type,'stack');
      assert.equal(outro.timeline(scenes,30,{type:'missing'},{}).at(-1).type,'outro');
      assert.equal(outro.timeline(scenes,2).at(-1).dur,2);
      assert.equal(outro.timeline([],30).at(-1).t0,26.5);
      assert.equal(outro.options({title:'Hasta pronto',url:''}).title,'Hasta pronto');
      assert.equal(outro.options({url:''}).url,'');
    """, str(COMPONENT)], check=True, capture_output=True, text=True)


def test_browser_serves_current_shared_component_in_both_layouts(tmp_path):
    from src.adapters.recorder.infrastructure.playwright_ffmpeg_adapter import _serve_directory
    current = tmp_path / "canonical.js"
    current.write_text("shared-v1")
    local = tmp_path / "job"
    (local / "assets/components").mkdir(parents=True)
    (local / "assets/components/outro.js").write_text("stale")
    (local / "config.json").write_text('{"own":true}')
    paths = {"/components/outro.js": current, "/assets/components/outro.js": current}
    with _serve_directory(local, shared_assets=paths) as origin:
        assert urlopen(origin + "/assets/components/outro.js?v=1").read() == b"shared-v1"
        current.write_text("shared-v2")
        assert urlopen(origin + "/components/outro.js?v=2").read() == b"shared-v2"
        assert json.load(urlopen(origin + "/config.json")) == {"own": True}
    assert (local / "assets/components/outro.js").read_text() == "stale"


def test_editorial_declares_local_component_for_recording():
    catalog = json.loads((SERVER / "src/templates/templates.json").read_text())["templates"]
    assert "components" in catalog["promo-editorial"]["runtime_assets"]
    for name in ("promo-sports", "promo-urban", "promo-dynamic", "promo-kinetic", "promo-trendy"):
        assert "components" not in catalog[name]["runtime_assets"]
