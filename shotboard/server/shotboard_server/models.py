"""Request bodies sent by the app."""

from typing import Literal

from pydantic import BaseModel, Field


class Column(BaseModel):
    id: str
    label: str


class PdfShot(BaseModel):
    number: str
    type: str
    type_label: str = Field(alias="typeLabel")
    lens: str
    duration: float
    notes: str = ""
    fields: dict[str, str] = {}
    # JPEG or PNG, base64 (no data: prefix); None if the shot has no picture yet.
    image: str | None = None

    model_config = {"populate_by_name": True}


class PdfRequest(BaseModel):
    title: str
    subtitle: str = ""
    layout: Literal["list", "storyboard"] = "storyboard"
    page_size: Literal["letter", "a4"] = Field("letter", alias="pageSize")
    aspect: float = 2.39
    columns: list[Column] = []
    shots: list[PdfShot]

    model_config = {"populate_by_name": True}


class AnimaticShot(BaseModel):
    number: str
    type: str
    lens: str
    frames: int = Field(gt=0)


class AnimaticRequest(BaseModel):
    title: str = ""
    fps: float = Field(24, gt=0, le=120)
    width: int = Field(gt=0, le=8192)
    height: int = Field(gt=0, le=8192)
    burn_in: bool = Field(True, alias="burnIn")
    shots: list[AnimaticShot]

    model_config = {"populate_by_name": True}

    @property
    def total_frames(self) -> int:
        return sum(s.frames for s in self.shots)
