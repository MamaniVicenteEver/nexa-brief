import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'src/templates/_tools/explainer-kit/tools'))
spec = importlib.util.spec_from_file_location('outro_under_test', str(ROOT / 'src/templates/_tools/explainer-kit/tools/outro.py'))
outro = importlib.util.module_from_spec(spec)
spec.loader.exec_module(outro)
spec2 = importlib.util.spec_from_file_location('src.core.explainer.editions.application', str(ROOT / 'src/core/explainer/editions/application.py'))
app = importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(app)

@pytest.mark.parametrize('native', [True, False])
def test_outro_preserves_narration_only_for_native_edition(tmp_path,monkeypatch,native):
    video=tmp_path/'video'; assets=video/'assets'; assets.mkdir(parents=True)
    words=[{'word':' First','start':.2,'end':.4},{'word':' Last','start':2.0,'end':2.4}]
    (assets/'lyrics.json').write_text(json.dumps({'segments':[{'text':' First Last','words':words}]}))
    (assets/'storyboard.json').write_text(json.dumps({'beats':[{'t':1.0,'use':'rough.outrov1'}]}))
    (assets/'config.json').write_text('{}')
    meta={'voice':'test','dur':2.,'timings':{},'words':[{'word':' Bye','start':.1,'end':.4}]}
    data={'channel':'N','texts':{'channel':'N'},'use':'rough.outrov1','audio':tmp_path/'voice.mp3','meta':meta}
    monkeypatch.setattr(outro,'spec_for_edition',lambda ctx:data)
    monkeypatch.setattr(outro,'spec_for',lambda p:data)
    commands=[]
    monkeypatch.setattr(outro.subprocess,'run',lambda cmd,**kw:commands.append(cmd))
    names={'lyrics':'lyrics.json','storyboard':'storyboard.json','audio':'song.mp3','audio_with_outro':'song-with-outro.mp3','config':'config.json'}
    ctx=SimpleNamespace(path_of=lambda name:assets/names[name],rel=lambda name:names[name]) if native else None
    result=outro.apply(video,ctx)
    lyrics=json.loads((assets/'lyrics.json').read_text())
    got=[w['word'] for s in lyrics['segments'] if not s.get('outro') for w in s['words']]
    assert got == ([' First',' Last'] if native else [' First'])
    assert result['start'] == (3.6 if native else 1.6)
    assert json.loads((assets/'storyboard.json').read_text())['beats']==[]


def test_duplicate_closing_warns_without_mutating_narration():
    seg=SimpleNamespace(id='s16',text='Thanks for watching. Your support helps us keep asking better questions.')
    ed=SimpleNamespace(outro=SimpleNamespace(thanks='THANKS FOR WATCHING'),outro_spoken=SimpleNamespace(text='Thanks for sticking with us. Your support helps us keep asking better questions.'))
    warning=app.duplicate_closing_warning([seg],ed)
    assert warning['kind']=='possible_duplicate_closing' and warning['segment_id']=='s16'
    assert seg.text.startswith('Thanks for watching.')
    other=SimpleNamespace(id='s16',text='The idea was vague, but exciting.')
    assert app.duplicate_closing_warning([other],ed) is None
