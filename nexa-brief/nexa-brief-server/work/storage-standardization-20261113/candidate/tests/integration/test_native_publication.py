"""Language isolation, A/B/C and exact-artifact approval through real HTTP services."""
from copy import deepcopy
import hashlib

import pytest

from test_editions_service import environment as environment
from test_editions_service import wait_job, BASE, VIDEO, hashes
from src.core.explainer.editions.io import read, write
from src.core.explainer.editions.packaging import resolve_video
from src.core.explainer.catalog import get_video
from src.core.explainer import thumbnails
from src.core.localization.packaging import NativePackaging


def native(client):
    return next(row for row in client.get(BASE).json()["locales"] if row["locale"] == "en-US")


def test_native_abc_approval_and_opening_never_modify_frozen_or_es(environment, monkeypatch):
    client, service, runner, tools, profile, production = environment
    source = hashes(production)
    runner.gate.set()
    job = client.post(BASE, json={"locale": "en-US"}).json()["job_id"]
    assert wait_job(client, job)["status"] == "completed"
    row = native(client)
    studio = row["studio"]
    assert {x["option"] for x in studio["thumbnails"]["options"]} == set("ABC")
    assert len(studio["publish_package"]["package"]["titles"]["youtube"]) == 3
    assert studio["capabilities"]["record"] and not studio["publish_ready"]
    record_url = BASE.removesuffix("/localizations") + "/record"
    request = {"locale": "en-US", "revision": row["revision"], "duration": "full", "publish": True,
               "account_selectors": ["youtube:test-only"]}
    assert client.post(record_url, json=request).status_code == 422
    selected = resolve_video(get_video(VIDEO), "en-US", row["revision"])
    folder = selected.edition_path
    frozen_names = ["config.json", "storyboard.json", "edition.json", "script.json", "song-with-outro.mp3", "checkpoints.json"]
    frozen = {n: hashlib.sha256((folder/n).read_bytes()).hexdigest() for n in frozen_names}
    response = client.post(BASE + "/en-US/approve", json={"revision": row["revision"], "artifact_sha256": studio["approval_token"]})
    assert response.status_code == 200, response.text
    assert native(client)["studio"]["publish_ready"]
    from src.presentation.api.routers import explainer
    from src.core.explainer.recorder import RecordJob
    recorded = []
    original_recorder = explainer.get_recorder()
    def submit(video, **kwargs):
        recorded.append((video, kwargs))
        return RecordJob(job_id="spy", video_id=video.video_id, category_path=video.category_path, duration="full",
                         publish=True, privacy="private", account_selector="youtube:test-only", locale=video.locale,
                         revision=video.revision, title=video.youtube_title)
    monkeypatch.setattr(original_recorder, "submit", submit)
    response = client.post(record_url, json=request)
    assert response.status_code == 202, response.text
    assert response.json()["locale"] == "en-US" and response.json()["title"] == row["title"]
    assert recorded[0][0].edition_path == folder and recorded[0][0].publish_ready
    assert client.post(record_url, json={**request, "revision": "rev-999"}).status_code == 422
    assert selected.youtube_title == runner.output["publish"]["youtube"]["title"]
    for option in "ABC":
        thumbnails.choose(selected, option)
        assert thumbnails.chosen_option(selected) == option
        cfg = read(folder / "config.publication.json")
        assert cfg["storyboardUrl"].endswith("/storyboard.publication.json")
        assert read(folder / "storyboard.publication.json")["beats"][0]["use"] == thumbnails.intro_specs(selected)[option]["component"]
        assert thumbnails.thumbnail_file(selected, option).parent == folder
    assert frozen == {n: hashlib.sha256((folder/n).read_bytes()).hexdigest() for n in frozen_names}
    assert native(client)["studio"]["publish_ready"]  # switching among reviewed variants is safe
    package = read(folder / "publication.json")
    changed = deepcopy(package)
    changed["thumbnail"]["with_image"]["text"] = "UNREVIEWED COPY"
    write(folder / "publication.json", changed)
    assert not native(client)["studio"]["publish_ready"]
    write(folder / "publication.json", package)
    assert native(client)["studio"]["publish_ready"]
    assert source == {k:v for k,v in hashes(production).items() if k in source}
    assert client.get(row["preview_url"].split("index.html")[0] + "assets/config.json?edition=en-US&revision=rev-999").status_code == 404
    for private in ("approval.json", "edition.json", "publication.json", "agent/prompt.md"):
        assert client.get(row["preview_url"].split("index.html")[0] + f"languages/en-US/revisions/{row['revision']}/{private}").status_code == 404
    # A changed audio artifact invalidates the approval rather than reporting a missing title.
    with (folder / "song-with-outro.mp3").open("ab") as stream:
        stream.write(b"changed")
    assert not native(client)["studio"]["publish_ready"]
    assert any(i["field"] == "review" for i in native(client)["studio"]["issues"])
    assert client.post(BASE + "/en-US/approve", json={"revision": row["revision"], "artifact_sha256": studio["approval_token"]}).status_code == 409


def test_packaging_requires_three_distinct_angles_and_no_media_paths(environment):
    _, _, runner, _, _, _ = environment
    value = deepcopy(runner.output["packaging"])
    value["titles"][2]["option"] = "A"
    with pytest.raises(ValueError):
        NativePackaging.model_validate(value)
    value = deepcopy(runner.output["packaging"])
    value["with_image"]["image"] = "/etc/passwd"
    with pytest.raises(ValueError):
        NativePackaging.model_validate(value)
