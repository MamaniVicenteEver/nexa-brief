"""Editorial A/B/C contract. Media and layout remain under host control."""
from typing import Literal
import re

from pydantic import BaseModel, ConfigDict, Field, model_validator

class Piece(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NativeTitle(Piece):
    option: Literal["A", "B", "C"]
    text: str = Field(min_length=1, max_length=100)
    strategy: int = Field(ge=1)
    emotion: str = Field(min_length=1)


class TextOnly(Piece):
    lines: list[str] = Field(min_length=1, max_length=3)
    highlight: str
    pair_title: Literal["A", "B", "C"] = "A"

    @property
    def text(self):
        return " ".join(self.lines)


class ImageText(Piece):
    text: str = Field(min_length=1)
    pair_title: Literal["A", "B", "C"] = "B"


class TabloidText(ImageText):
    accent: str = ""
    bullet: str = ""
    strap: str = ""
    seal: str = ""
    tape_text: str = ""
    before_label: str = ""
    after_label: str = ""
    pair_title: Literal["A", "B", "C"] = "C"


class NativePackaging(Piece):
    titles: list[NativeTitle] = Field(min_length=3, max_length=3)
    chosen_title: Literal["A", "B", "C"] = "A"
    text_only: TextOnly
    with_image: ImageText
    tabloid: TabloidText
    chosen_thumbnail: Literal["text_only", "with_image", "tabloid"] = "tabloid"
    kicker: str = ""

    @model_validator(mode="after")
    def validate_abc(self):
        if {t.option for t in self.titles} != {"A", "B", "C"}:
            raise ValueError("Se requieren títulos A, B y C distintos")
        if len({t.text.strip().casefold() for t in self.titles}) != 3:
            raise ValueError("Los tres títulos deben explorar ángulos distintos")
        if any(not t.text.strip() for t in self.titles):
            raise ValueError("Los títulos no pueden estar vacíos")
        for value in (self.text_only.text, self.with_image.text, self.tabloid.text):
            if not value.strip() or len(re.findall(r"\w+", value)) > 5:
                raise ValueError("Cada miniatura requiere entre una y cinco palabras")
        if len(self.text_only.lines) > 3:
            raise ValueError("La miniatura A admite hasta tres renglones")
        if self.text_only.highlight and not any(self.text_only.highlight in line for line in self.text_only.lines):
            raise ValueError("El resaltado A debe estar completo en un renglón")
        if self.tabloid.accent and self.tabloid.accent not in self.tabloid.text:
            raise ValueError("El acento C debe existir en su texto")
        return self
