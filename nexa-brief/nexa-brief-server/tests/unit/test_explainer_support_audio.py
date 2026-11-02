import json

import pytest

from src.core.explainer import producer


@pytest.fixture
def check_audio(monkeypatch, tmp_path):
    monkeypatch.syspath_prepend(str(producer.KIT_DIR / 'tools'))
    import style_media_policy

    def run(cues, *, supports=None, windows=None, design='imperio', plan_url='plan.json'):
        (tmp_path / 'plan.json').write_text(json.dumps({'cues': cues}))
        config = {'design': design, 'soundDesign': {'planUrl': plan_url,
                  'supportWindows': supports if supports is not None else
                  [{'asset_id': 'engine', 'start': 10, 'duration': 8}]}}
        errors = []
        report = style_media_policy.check_audio(tmp_path, config,
                  {'media': windows if windows is not None else [{'start': 10, 'end': 18}]}, errors)
        return report, errors
    return run


def cue(start, duration):
    return {'asset_id': 'engine', 'start': start, 'duration': duration}


def test_whole_support_and_crossfaded_reused_excerpts_pass(check_audio):
    for cues in ([cue(10, 8)], [cue(10, 6.8), cue(16.3, 1.7)]):
        report, errors = check_audio(cues)
        assert not errors
        assert report['supports'][0]['complete']


@pytest.mark.parametrize('cues', [
    [cue(10, 6.8)],  # original POC stopped before its 8-second video
    [cue(10.1, 7.9)],  # equal end is insufficient if onset is late
    [cue(10, 4), cue(14.25, 3.75)],  # internal silence
    [cue(10, 8.2)],  # continues past the visual support
])
def test_partial_gapped_shifted_or_overlong_support_is_rejected(check_audio, cues):
    assert check_audio(cues)[1]


def test_mapping_must_match_actual_media_not_a_claimed_shorter_window(check_audio):
    assert check_audio([cue(10, 8)], windows=[{'start': 10, 'end': 20}])[1]
    assert check_audio([cue(10, 8)], supports=[])[1]


def test_other_families_are_unchanged_and_plan_path_is_contained(check_audio):
    report, errors = check_audio([cue(10, 2)], design='rough')
    assert report is None and not errors
    assert check_audio([cue(10, 8)], plan_url='../outside.json')[1]
