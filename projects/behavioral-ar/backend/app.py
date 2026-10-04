from __future__ import annotations

import asyncio
import json
from pathlib import Path
from time import time
from typing import Any, Literal
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator

from pipeline.baseline import BaselineStore, baseline_observations, numeric_observations
from pipeline.fusion import fuse_events

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "data" / "private" / "baselines.json"
app = FastAPI(title="Behavioral AR Prototype", version="0.3.0")
baselines = BaselineStore(path=BASELINE_PATH, min_samples=5)


class Event(BaseModel):
    id: str | None = None
    timestamp_ms: int
    layer: Literal["observation"] = "observation"
    channel: Literal["visual", "vocal", "language", "motion", "context"]
    kind: str
    value: Any = None
    confidence: float = Field(default=1.0, ge=0, le=1)
    quality: float = Field(default=1.0, ge=0, le=1)

    @field_validator("channel", mode="before")
    @classmethod
    def normalize_channel(cls, value):
        if isinstance(value, str) and value.lower() == "face":
            return "visual"
        return value


class IngestRequest(BaseModel):
    subject_id: str = Field(min_length=1, max_length=128)
    events: list[Event]
    learn: bool = True


class Signal(BaseModel):
    channel: Literal["visual", "vocal", "language", "motion", "context"]
    kind: str
    deviation: float = Field(ge=0, le=10)
    confidence: float = Field(ge=0, le=1)
    quality: float = Field(default=1, ge=0, le=1)

    @field_validator("channel", mode="before")
    @classmethod
    def normalize_signal_channel(cls, value):
        if isinstance(value, str) and value.lower() == "face":
            return "visual"
        return value


class FusionRequest(BaseModel):
    signals: list[Signal]


class HudBroker:
    def __init__(self):
        self._subscribers: set[asyncio.Queue] = set()

    async def publish(self, event: dict) -> None:
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                try:
                    queue.get_nowait()
                    queue.put_nowait(event)
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    pass

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=32)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)


hud_broker = HudBroker()


@app.get("/")
def hud():
    return FileResponse(ROOT / "web" / "index.html")


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "behavioral-ar",
        "version": "0.3.0",
        "baseline_subjects": len(baselines.snapshot()),
    }


@app.post("/api/audio")
async def ingest_audio(req: IngestRequest):
    return await _ingest(req, expected_channels={"vocal", "language", "context"})


@app.post("/api/video")
async def ingest_video(req: IngestRequest):
    return await _ingest(req, expected_channels={"visual", "motion", "context"})


@app.get("/api/baseline/{subject_id}")
def baseline_lookup(subject_id: str):
    return {"subject_id": subject_id, "features": baselines.snapshot(subject_id).get(subject_id, {})}


@app.delete("/api/baseline/{subject_id}")
def baseline_delete(subject_id: str):
    deleted = baselines.clear_subject(subject_id)
    if deleted:
        baselines.save()
    return {"subject_id": subject_id, "deleted": deleted}


@app.get("/api/hud/stream")
async def hud_stream(request: Request):
    queue = hud_broker.subscribe()

    async def generate():
        try:
            yield "retry: 1000\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"event: hud\ndata: {json.dumps(event, separators=(',', ':'))}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            hud_broker.unsubscribe(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/fuse")
async def fuse(req: FusionRequest):
    # Backward-compatible adapter for the original prototype endpoint.
    timestamp_ms = int(time() * 1000)
    events = [{
        "id": str(uuid4()),
        "timestamp_ms": timestamp_ms,
        "layer": "observation",
        "channel": signal.channel,
        "kind": signal.kind,
        "value": min(signal.deviation / 4.0, 1.0) if signal.channel == "motion" else signal.deviation,
        "confidence": signal.confidence,
        "quality": signal.quality,
    } for signal in req.signals]
    hud_events = fuse_events(events)
    hud_event = hud_events[-1]
    await hud_broker.publish(hud_event)
    return hud_event


async def _ingest(req: IngestRequest, expected_channels: set[str]) -> dict:
    events = [event.model_dump() for event in req.events]
    accepted = [event for event in events if event["channel"] in expected_channels]

    # Compare against the baseline that existed before this batch. This avoids
    # training on the same measurement before scoring its deviation.
    deviations = baseline_observations(baselines, req.subject_id, accepted)
    combined = accepted + deviations
    hud_events = fuse_events(combined)

    for hud_event in hud_events:
        hud_event["subject_id"] = req.subject_id
        await hud_broker.publish(hud_event)

    if req.learn:
        features = numeric_observations(accepted)
        if features:
            baselines.update_many(req.subject_id, features)
            baselines.save()

    return {
        "subject_id": req.subject_id,
        "accepted_events": len(accepted),
        "baseline_events": deviations,
        "hud_events": hud_events,
        "learned": req.learn,
    }
