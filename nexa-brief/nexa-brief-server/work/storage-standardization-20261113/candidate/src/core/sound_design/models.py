from pydantic import BaseModel, ConfigDict, Field, model_validator


class SoundCue(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    asset_id: str = Field(min_length=1, max_length=100)
    start: float = Field(ge=0)
    source_in: float = Field(default=0, ge=0)
    duration: float = Field(gt=0, le=600)
    gain_db: float = Field(default=-18, ge=-60, le=0)
    fade_in: float = Field(default=0.25, ge=0, le=30)
    fade_out: float = Field(default=0.5, ge=0, le=30)

    @model_validator(mode="after")
    def check_fades(self):
        if self.fade_in + self.fade_out > self.duration:
            raise ValueError("Las entradas y salidas no pueden superar la duración del efecto.")
        return self


class SoundMixPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(default=1, ge=1, le=1)
    cues: list[SoundCue] = Field(default_factory=list, max_length=100)
    ducking: bool = True
