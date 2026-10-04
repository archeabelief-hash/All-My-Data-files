"""Multimodal event fusion for the Behavioral AR HUD.

Consumes neutral observation events and statistical baseline-deviation events.
Produces presentation events based on timing, channel convergence, data quality,
and deviation magnitude. It does not infer emotion, deception, identity, intent,
diagnosis, or internal mental state.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from time import time
from typing import Iterable
from uuid import uuid4


@dataclass(slots=True)
class FusionConfig:
    window_ms: int = 1500
    min_quality: float = 0.35
    min_confidence: float = 0.35
    changed_threshold: float = 0.45
    baseline_shift_threshold: float = 0.72
    max_baseline_z: float = 4.0

    def __post_init__(self) -> None:
        if self.window_ms <= 0:
            raise ValueError("window_ms must be > 0")
        if self.max_baseline_z <= 0:
            raise ValueError("max_baseline_z must be > 0")


def fuse_events(events: Iterable[dict], config: FusionConfig | None = None) -> list[dict]:
    """Fuse events into HUD presentation events, one per temporal window."""
    config = config or FusionConfig()
    usable = [_normalize_event(event) for event in events]
    usable = [
        event for event in usable
        if event is not None
        and event["quality"] >= config.min_quality
        and event["confidence"] >= config.min_confidence
    ]
    if not usable:
        return [_hud_event("INSUFFICIENT EVIDENCE", 0.0, [], _now_ms())]

    windows: dict[int, list[dict]] = defaultdict(list)
    for event in usable:
        bucket = event["timestamp_ms"] // config.window_ms
        windows[bucket].append(event)

    return [
        _fuse_window(sorted(group, key=lambda e: e["timestamp_ms"]), config)
        for _, group in sorted(windows.items())
    ]


def _fuse_window(events: list[dict], config: FusionConfig) -> dict:
    baseline = [_baseline_signal(event, config) for event in events]
    baseline = [signal for signal in baseline if signal is not None]
    direct = [_direct_signal(event) for event in events]
    direct = [signal for signal in direct if signal is not None]

    channels = {event["channel"] for event in events if event["channel"] not in {"context", "fusion"}}
    convergence = min(len(channels) / 3.0, 1.0)

    if baseline:
        magnitude = sum(signal["strength"] for signal in baseline) / len(baseline)
        quality = sum(signal["weight"] for signal in baseline) / len(baseline)
        score = min(magnitude * quality * (0.70 + 0.30 * convergence), 1.0)
    elif direct:
        # Direct numeric observations can indicate that measurable signals are
        # present, but without a baseline they receive a deliberately lower cap.
        magnitude = sum(signal["strength"] for signal in direct) / len(direct)
        quality = sum(signal["weight"] for signal in direct) / len(direct)
        score = min(magnitude * quality * (0.45 + 0.20 * convergence), 0.60)
    else:
        score = 0.0

    if baseline and score >= config.baseline_shift_threshold and len(channels) >= 2:
        label = "BASELINE SHIFT"
    elif score >= config.changed_threshold:
        label = "SIGNALS CHANGED"
    else:
        label = "NORMAL"

    supports = [_support(event) for event in events]
    timestamp_ms = max(event["timestamp_ms"] for event in events)
    return _hud_event(label, score, supports, timestamp_ms)


def _baseline_signal(event: dict, config: FusionConfig) -> dict | None:
    if event["kind"] != "baseline_deviation" or not isinstance(event["value"], dict):
        return None
    value = event["value"]
    if not value.get("ready"):
        return None
    absolute_z = value.get("absolute_z")
    if not isinstance(absolute_z, (int, float)):
        return None
    strength = min(abs(float(absolute_z)) / config.max_baseline_z, 1.0)
    return {"strength": strength, "weight": event["confidence"] * event["quality"]}


def _direct_signal(event: dict) -> dict | None:
    value = event["value"]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None

    # Only intrinsically normalized observable measures can contribute before
    # a learned baseline exists. Counts, latency and speech rates require a
    # personal baseline and are therefore evidence/support only here.
    if event["kind"] == "frame_motion_energy":
        strength = min(max(float(value), 0.0), 1.0)
        return {"strength": strength, "weight": event["confidence"] * event["quality"]}
    return None


def _normalize_event(event: dict) -> dict | None:
    if event.get("layer") != "observation":
        return None
    try:
        timestamp_ms = int(event["timestamp_ms"])
    except (KeyError, TypeError, ValueError):
        return None
    channel = str(event.get("channel", "")).strip()
    kind = str(event.get("kind", "")).strip()
    if not channel or not kind:
        return None
    return {
        "id": str(event.get("id", "")),
        "timestamp_ms": timestamp_ms,
        "layer": "observation",
        "channel": channel,
        "kind": kind,
        "value": event.get("value"),
        "confidence": _unit(event.get("confidence", 1.0)),
        "quality": _unit(event.get("quality", 1.0)),
    }


def _support(event: dict) -> dict:
    support = {
        "timestamp_ms": event["timestamp_ms"],
        "channel": event["channel"],
        "kind": event["kind"],
        "confidence": event["confidence"],
        "quality": event["quality"],
    }
    if event["id"]:
        support["id"] = event["id"]
    if event["kind"] == "baseline_deviation" and isinstance(event["value"], dict):
        support["feature"] = event["value"].get("feature")
        support["absolute_z"] = event["value"].get("absolute_z")
    return support


def _hud_event(label: str, score: float, supports: list[dict], timestamp_ms: int) -> dict:
    return {
        "id": str(uuid4()),
        "timestamp_ms": timestamp_ms,
        "layer": "presentation",
        "channel": "fusion",
        "kind": "hud_state",
        "label": label,
        "confidence": round(min(max(score, 0.0), 1.0), 3),
        "supports": supports,
        "disclaimer": "Signal convergence and baseline deviation are not proof of deception or internal mental state.",
    }


def _unit(value) -> float:
    try:
        return min(max(float(value), 0.0), 1.0)
    except (TypeError, ValueError):
        return 0.0


def _now_ms() -> int:
    return int(time() * 1000)
