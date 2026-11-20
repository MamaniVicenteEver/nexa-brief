"""«Completar datos» de canciones: solo campos vacíos, nunca título ni licencia, sin inventar."""

import asyncio
import urllib.error
from types import SimpleNamespace

import pytest

from src.adapters.library import music_sources
from src.adapters.library.music_sources import MusicSourcesHttp
from src.core.library import music_enrichment as me

KDA_EXTRACT = (
    '"The Baddest" is a song by virtual K-pop girl group K/DA. It was released on August 27, 2020, '
    "as the pre-release single from their debut extended play All Out."
)


def _entry(**overrides):
    base = dict(
        track_name="",
        original_filename="cancion.mp3",
        artist="",
        genre="",
        description="",
        tags="",
        license_note="unknown",
        category="uploads",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class FakeLibrary:
    def __init__(self, entry):
        self.entry = entry
        self.updates = []

    def get_music_entry(self, asset_id):
        return self.entry

    async def update_asset_metadata(self, kind, asset_id, changes):
        self.updates.append((kind, asset_id, changes))


class FakeSources:
    def __init__(self, recordings=(), articles=()):
        self._recordings = list(recordings)
        self._articles = list(articles)
        self.calls = []

    async def recordings(self, title, artist):
        self.calls.append(("recordings", title, artist))
        return self._recordings

    async def articles(self, title, artist):
        self.calls.append(("articles", title, artist))
        return self._articles


def _kda_recording(**overrides):
    base = {
        "id": "e0a4",
        "title": "THE BADDEST",
        "score": 100,
        "artist": "K/DA",
        "release": "ALL OUT",
        "date": "2020-11-06",
        "tags": ["pop rap", "r&b"],
        "url": "https://musicbrainz.org/recording/e0a4",
    }
    base.update(overrides)
    return base


def _kda_article(**overrides):
    base = {
        "title": "The Baddest (K/DA song)",
        "url": "https://en.wikipedia.org/wiki/The_Baddest_(K/DA_song)",
        "extract": KDA_EXTRACT,
        "lang": "en",
    }
    base.update(overrides)
    return base


def _research(**overrides):
    base = dict(
        identified=True,
        artist="",
        description="Sencillo de K/DA que anticipó el EP All Out.",
        genre="pop rap",
        tags=["k-pop", "all-out"],
        confidence="alta",
    )
    base.update(overrides)
    return me.MusicResearch(**base)


def _ask_returning(research, seen=None):
    async def ask(facts):
        if seen is not None:
            seen.append(facts)
        return research

    return ask


def test_search_hints_split_artist_from_title_and_drop_featured_artists():
    entry = _entry(track_name="K/DA - THE BADDEST con (G)I-DLE, Bea Miller, Wolftyla")
    assert me.search_hints(entry) == ("THE BADDEST", "K/DA")


def test_search_hints_drop_edit_notes_and_keep_known_artist():
    entry = _entry(track_name="Undaunted (90 s, montaje v2) (60 s)", artist="Kevin MacLeod")
    assert me.search_hints(entry) == ("Undaunted", "Kevin MacLeod")


def test_search_hints_fall_back_to_the_filename():
    assert me.search_hints(_entry(original_filename="upload-kda.mp3"))[0] == "upload kda"


def test_missing_fields_lists_only_the_empty_ones():
    entry = _entry(artist="K/DA", genre="pop", description="", tags="")
    assert me.missing_fields(entry) == ["description", "tags"]


def test_pick_recording_requires_exact_title_and_high_score():
    candidates = [
        _kda_recording(title="THE BADDEST (instrumental)", id="inst"),
        _kda_recording(score=80, id="low"),
        _kda_recording(),
    ]
    assert me.pick_recording(candidates, "THE BADDEST", "K/DA")["id"] == "e0a4"


def test_pick_recording_refuses_an_ambiguous_match_without_artist():
    candidates = [_kda_recording(artist="Artista A"), _kda_recording(artist="Artista B", id="zz")]
    assert me.pick_recording(candidates, "THE BADDEST", "") is None


def test_pick_recording_checks_the_artist_when_known():
    assert me.pick_recording([_kda_recording(artist="Otro")], "THE BADDEST", "K/DA") is None


def test_pick_article_needs_the_song_in_the_title_and_a_real_extract():
    short = _kda_article(extract="Corto.")
    other = _kda_article(title="The Baddest Girl (novel)", extract="x" * 200)
    picked = me.pick_article([short, other, _kda_article()], "THE BADDEST", "K/DA")
    assert picked["title"] == "The Baddest (K/DA song)"


def test_fills_only_empty_fields_and_never_touches_title_or_license():
    library = FakeLibrary(_entry(track_name="K/DA - THE BADDEST con (G)I-DLE", description="Escrita a mano"))
    sources = FakeSources(recordings=[_kda_recording()], articles=[_kda_article()])
    seen = []
    report = asyncio.run(
        me.enrich_music("a1", sources=sources, ask=_ask_returning(_research(artist="Otro"), seen), library=library)
    )

    assert report.status == "actualizado"
    assert report.fields == ("artist", "genre", "tags")
    # MusicBrainz manda en el artista; la descripción escrita a mano no se toca.
    assert library.updates == [("music", "a1", {"artist": "K/DA", "genre": "pop rap", "tags": "k-pop, all-out"})]
    assert report.sources == (
        "https://musicbrainz.org/recording/e0a4",
        "https://en.wikipedia.org/wiki/The_Baddest_(K/DA_song)",
    )
    # El modelo recibe solo las fuentes y el pedido: nada de la letra.
    assert set(seen[0].keys()) == {"pedido", "musicbrainz", "wikipedia"}


def test_without_any_source_nothing_is_written_and_the_model_is_not_called():
    library = FakeLibrary(_entry(track_name="Tema raro"))
    seen = []
    report = asyncio.run(
        me.enrich_music("a1", sources=FakeSources(), ask=_ask_returning(_research(), seen), library=library)
    )
    assert report.status == "no_encontrada"
    assert seen == []
    assert library.updates == []


def test_overwrite_replaces_description_and_tags_but_keeps_title_license_and_category():
    library = FakeLibrary(
        _entry(
            track_name="K/DA - THE BADDEST",
            artist="K/DA",
            genre="pop",
            description="Escrita a mano",
            tags="viejo, etiqueta",
            license_note="CC BY 4.0",
            category="nodemotion",
        )
    )
    sources = FakeSources(recordings=[_kda_recording()], articles=[_kda_article()])
    report = asyncio.run(
        me.enrich_music("a1", sources=sources, ask=_ask_returning(_research()), library=library, overwrite=True)
    )

    assert report.status == "actualizado"
    assert library.updates == [
        ("music", "a1", {"description": "Sencillo de K/DA que anticipó el EP All Out.", "tags": "k-pop, all-out"})
    ]


def test_overwrite_without_new_text_keeps_the_existing_description():
    library = FakeLibrary(_entry(track_name="Tema", artist="Zeta", description="Mía", tags="mía"))
    report = asyncio.run(
        me.enrich_music("a1", sources=FakeSources(), ask=_ask_returning(_research()), library=library, overwrite=True)
    )
    assert report.status == "no_encontrada"
    assert library.updates == []


def test_missing_genre_alone_does_not_trigger_research():
    entry = _entry(artist="K/DA", genre="", description="Ya descrita", tags="pop")
    sources = FakeSources()
    report = asyncio.run(
        me.enrich_music("a1", sources=sources, ask=_ask_returning(_research()), library=FakeLibrary(entry))
    )
    assert report.status == "completo"
    assert sources.calls == []


def test_complete_entry_is_not_searched_at_all():
    entry = _entry(artist="K/DA", genre="pop", description="Ya descrita", tags="pop")
    sources = FakeSources()
    report = asyncio.run(
        me.enrich_music("a1", sources=sources, ask=_ask_returning(_research()), library=FakeLibrary(entry))
    )
    assert report.status == "completo"
    assert sources.calls == []


def test_model_saying_not_identified_writes_nothing_without_musicbrainz():
    library = FakeLibrary(_entry(track_name="Something", artist="Zeta"))
    sources = FakeSources(articles=[_kda_article(title="Something (Zeta song)", extract="y" * 200)])
    report = asyncio.run(
        me.enrich_music("a1", sources=sources, ask=_ask_returning(_research(identified=False)), library=library)
    )
    assert report.status == "no_encontrada"
    assert library.updates == []


def test_musicbrainz_only_match_describes_the_song_from_its_record():
    library = FakeLibrary(_entry(track_name="Undaunted", artist="Kevin MacLeod"))
    record = _kda_recording(title="Undaunted", artist="Kevin MacLeod", tags=[], release="The Descent", date="2009")
    research = _research(
        artist="", description="Pista del álbum The Descent, de Kevin MacLeod (2009).", genre="", tags=[]
    )
    report = asyncio.run(
        me.enrich_music("a1", sources=FakeSources(recordings=[record]), ask=_ask_returning(research), library=library)
    )
    assert report.status == "actualizado"
    assert library.updates == [("music", "a1", {"description": "Pista del álbum The Descent, de Kevin MacLeod (2009)."})]


def test_musicbrainz_adapter_parses_artist_credit_and_tags():
    payload = {
        "recordings": [
            {
                "id": "e0a4",
                "score": 100,
                "title": "THE BADDEST",
                "artist-credit": [{"name": "K/DA", "joinphrase": "", "artist": {"name": "K/DA"}}],
                "releases": [{"title": "ALL OUT", "date": "2020-11-06"}],
                "tags": [{"name": "r&b", "count": 1}, {"name": "pop rap", "count": 3}],
            }
        ]
    }
    seen = []

    async def fake_get_json(url, params):
        seen.append((url, params))
        return payload

    sources = MusicSourcesHttp(get_json=fake_get_json, min_interval=0)
    found = asyncio.run(sources.recordings("THE BADDEST", "K/DA"))

    assert found == [
        {
            "id": "e0a4",
            "title": "THE BADDEST",
            "score": 100,
            "artist": "K/DA",
            "release": "ALL OUT",
            "date": "2020-11-06",
            "tags": ["pop rap", "r&b"],
            "url": "https://musicbrainz.org/recording/e0a4",
        }
    ]
    url, params = seen[0]
    assert url == "https://musicbrainz.org/ws/2/recording/"
    assert params["query"] == 'recording:"THE BADDEST" AND artist:"K/DA"'


def test_network_failure_is_reported_as_unavailable_not_as_empty():
    async def offline(url, params):
        raise OSError("sin red")

    sources = MusicSourcesHttp(get_json=offline, min_interval=0)
    with pytest.raises(me.MusicSourceUnavailable):
        asyncio.run(sources.recordings("THE BADDEST", "K/DA"))
    with pytest.raises(me.MusicSourceUnavailable):
        asyncio.run(sources.articles("THE BADDEST", "K/DA"))


class DownSources:
    async def recordings(self, title, artist):
        raise me.MusicSourceUnavailable("MusicBrainz")

    async def articles(self, title, artist):
        raise me.MusicSourceUnavailable("Wikipedia")


def test_unavailable_sources_end_in_error_not_in_not_found():
    library = FakeLibrary(_entry(track_name="THE BADDEST", artist="K/DA"))
    report = asyncio.run(
        me.enrich_music("a1", sources=DownSources(), ask=_ask_returning(_research()), library=library)
    )
    assert report.status == "error"
    assert library.updates == []


def test_rate_limited_service_is_retried_once(monkeypatch):
    calls = []

    async def busy_then_ok(url, params):
        calls.append(url)
        if len(calls) == 1:
            raise urllib.error.HTTPError(url, 503, "Service Temporarily Unavailable", None, None)
        return {"recordings": [{"id": "e0a4", "score": 100, "title": "THE BADDEST", "artist-credit": []}]}

    monkeypatch.setattr(music_sources, "RETRY_SECONDS", 0)
    sources = MusicSourcesHttp(get_json=busy_then_ok, min_interval=0)
    found = asyncio.run(sources.recordings("THE BADDEST", "K/DA"))

    assert len(calls) == 2
    assert found[0]["id"] == "e0a4"


def test_client_errors_are_not_retried(monkeypatch):
    calls = []

    async def not_found(url, params):
        calls.append(url)
        raise urllib.error.HTTPError(url, 404, "Not Found", None, None)

    monkeypatch.setattr(music_sources, "RETRY_SECONDS", 0)
    sources = MusicSourcesHttp(get_json=not_found, min_interval=0)

    with pytest.raises(me.MusicSourceUnavailable):
        asyncio.run(sources.recordings("THE BADDEST", "K/DA"))
    assert len(calls) == 1
