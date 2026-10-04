from __future__ import annotations

from pathlib import Path
from time import time
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
app = FastAPI(title="Behavioral AR Prototype", version="0.1.0")

class Signal(BaseModel):
    channel: Literal["visual", "vocal", "language", "motion", "context"]
    kind: str
    deviation: float = Field(ge=0, le=10)
    confidence: float = Field(ge=0, le=1)
    quality: float = Field(default=1, ge=0, le=1)

class FusionRequest(BaseModel):
    signals: list[Signal]

@app.get("/")
def hud():
    return FileResponse(ROOT / "web" / "index.html")

@app.get("/health")
def health():
    return {"ok": True, "service": "behavioral-ar", "version": "0.1.0"}

@app.post("/api/fuse")
def fuse(req: FusionRequest):
    usable = [s for s in req.signals if s.quality >= 0.35 and s.confidence >= 0.35]
    if not usable:
        return result("INSUFFICIENT EVIDENCE", 0.0, [])

    # Conservative MVP score. Production must be empirically calibrated.
    weighted = [min(s.deviation / 4.0, 1.0) * s.confidence * s.quality for s in usable]
    channels = {s.channel for s in usable}
    convergence = min(len(channels) / 3.0, 1.0)
    score = min((sum(weighted) / len(weighted)) * (0.65 + 0.35 * convergence), 1.0)

    if score >= 0.72 and len(channels) >= 2:
        label = "BASELINE SHIFT"
    elif score >= 0.45:
        label = "SIGNALS CHANGED"
    else:
        label = "NORMAL"

    return result(label, score, usable)

def result(label: str, score: float, signals):
    return {
        "id": str(uuid4()),
        "timestamp_ms": int(time() * 1000),
        "layer": "presentation",
        "label": label,
        "confidence": round(score, 3),
        "supports": [{"channel": s.channel, "kind": s.kind} for s in signals],
        "disclaimer": "Behavioral signals are not proof of deception or internal mental state."
    }
