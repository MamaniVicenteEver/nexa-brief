"""La decisión de miniatura se obtiene en la llamada de textos, con A seguro por defecto."""
import asyncio
import pytest
from src.core.metadata.copy_renderer import CopyPieces, RenderedCopy
from src.modules import copy_writer


@pytest.mark.parametrize('choice,expected', [('B','B'),('a','A'),('invalid','A'),(None,'A')])
def test_ai_choice_is_validated_with_safe_fallback(monkeypatch, choice, expected):
    class FakeAI:
        async def complete_json(self, system, user):
            self.prompt=user
            return {'thumbnail_options': {'A':'Nombre de canción','B':'Una frase potente'}, 'thumbnail_selected':choice}
    monkeypatch.setattr(copy_writer, 'parse_pieces', lambda raw, strategies: (CopyPieces(None,None), []))
    monkeypatch.setattr(copy_writer, 'render_copy', lambda *args: RenderedCopy('test','title','desc',[]))
    monkeypatch.setattr(copy_writer, 'build_copy_prompt', lambda *args: ('system','facts'))
    ai=FakeAI()
    result=asyncio.run(copy_writer.write_copy(ai,'facts','es','seed',strategies={'youtube':object()},include_thumbnail_options=True))
    assert result.thumbnail_selected == expected
    assert 'thumbnail_selected' in ai.prompt
    assert result.thumbnail_options['B'] == 'Una frase potente'


def test_ai_choice_follows_the_accepted_response_after_retry(monkeypatch):
    class FakeAI:
        def __init__(self):self.i=0
        async def complete_json(self, system, user):
            self.i+=1
            return ({'thumbnail_options':{'A':'Titulo','B':'Frase distinta'},'thumbnail_selected':'B'} if self.i==1 else
                    {'thumbnail_options':{'A':'Titulo','B':'Titulo'},'thumbnail_selected':'A'})
    # La primera respuesta no tiene error; se simula error de textos de publicación.
    monkeypatch.setattr(copy_writer, 'parse_pieces', lambda raw, strategies: (CopyPieces(None,None), ['faltan datos'] if raw['thumbnail_selected']=='B' else ['faltan datos']))
    monkeypatch.setattr(copy_writer, 'render_copy', lambda *args: RenderedCopy('test','title','desc',[]))
    monkeypatch.setattr(copy_writer, 'build_copy_prompt', lambda *args: ('system','facts'))
    monkeypatch.setattr(copy_writer, 'build_retry_note', lambda errors: ' retry')
    result=asyncio.run(copy_writer.write_copy(FakeAI(),'facts','es','seed',strategies={'youtube':object()},include_thumbnail_options=True))
    assert result.thumbnail_selected == 'B'
    assert result.thumbnail_options['B'] == 'Frase distinta'


def test_generated_details_carry_ai_choice_and_real_lyric_fallback(monkeypatch):
    from types import SimpleNamespace
    from src.adapters.ai import factory
    from src.core import draft_details, video_usage
    from src.core.job import Job, JobArtifacts, JobInput
    from src.modules import content_language

    async def language(_job):
        return SimpleNamespace(code='es')

    async def copy(*args, **kwargs):
        return SimpleNamespace(
            pieces=SimpleNamespace(song='Canción real', artist='Artista'),
            copies={}, thumbnail_options={'A':'Canción real', 'B':''}, thumbnail_selected='B',
        )

    monkeypatch.setattr(factory, 'get_copy_ai', lambda: object())
    monkeypatch.setattr(content_language, 'resolve_content_language', language)
    monkeypatch.setattr(video_usage, 'for_video', lambda ai, *_args: ai)
    monkeypatch.setattr(copy_writer, 'copy_profile', lambda _niche: 'lyrics')
    monkeypatch.setattr(copy_writer, 'copy_language', lambda _profile, language: language)
    monkeypatch.setattr(copy_writer, 'build_facts', lambda *_args: 'facts')
    monkeypatch.setattr(copy_writer, 'write_copy', copy)
    job=Job(input=JobInput(category_name='lyrics_video_caution'),artifacts=JobArtifacts(lyrics_json={'segments':[{'text':'Nunca voy a olvidarte mi amor'}]}))
    details=asyncio.run(draft_details.generate(job,'lyrics_video_caution','seed'))
    assert details._thumbnail_selected == 'B'
    assert details._thumbnail_texts == {'A':'Canción real','B':'Nunca voy a olvidarte mi amor'}
