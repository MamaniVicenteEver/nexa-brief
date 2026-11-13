"""The agent's editorial output; never contains host configuration or timings."""
from pydantic import BaseModel, ConfigDict, Field
from .packaging import NativePackaging


class Closed(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Segment(Closed):
    id: str
    text: str = Field(min_length=1, max_length=2400)
    delivery_note: str = Field(min_length=1, max_length=1400)


class Cue(Closed):
    segment_id: str
    target_phrase: str = Field(min_length=1)


class Chapter(Closed):
    segment_id: str
    title: str = Field(min_length=1, max_length=160)


class Youtube(Closed):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    tags: list[str]
    chapters: list[Chapter]
    pinned: str


class Social(Closed):
    title: str
    description: str


class Tiktok(Closed):
    caption: str
    hashtags: list[str]


class Publish(Closed):
    youtube: Youtube
    instagram: Social
    facebook: Social
    tiktok: Tiktok


class EditionOutput(Closed):
    locale: str
    segments: list[Segment]
    strings: dict[str, str]
    cues: dict[str, Cue]
    publish: Publish
    observations: list[str]
    packaging: NativePackaging | None = None  # historical checkpoints remain readable
