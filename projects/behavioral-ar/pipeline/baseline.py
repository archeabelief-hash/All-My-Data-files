"""Per-subject numeric baseline storage and deviation measurement.

This module stores distributions of observable numeric features. Subject IDs are
opaque application-provided keys; this module performs no identity recognition.
Deviation is a statistical distance from prior observations, not an emotion,
deception, diagnosis, intent, or mental-state classification.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
import json
import math
from pathlib import Path
from threading import RLock
from typing import Iterable


@dataclass(slots=True)
class RunningStat:
    count: int = 0
    mean: float = 0.0
    m2: float = 0.0
    minimum: float | None = None
    maximum: float | None = None

    def update(self, value: float) -> None:
        value = _finite(value)
        self.count += 1
        delta = value - self.mean
        self.mean += delta / self.count
        self.m2 += delta * (value - self.mean)
        self.minimum = value if self.minimum is None else min(self.minimum, value)
        self.maximum = value if self.maximum is None else max(self.maximum, value)

    @property
    def variance(self) -> float | None:
        return self.m2 / (self.count - 1) if self.count >= 2 else None

    @property
    def stddev(self) -> float | None:
        variance = self.variance
        return math.sqrt(variance) if variance is not None else None

    def deviation(self, value: float, min_samples: int = 5, std_floor: float = 1e-6) -> dict:
        value = _finite(value)
        if self.count < min_samples:
            return {
                "ready": False,
                "samples": self.count,
                "value": value,
                "mean": self.mean if self.count else None,
                "stddev": self.stddev,
                "z_score": None,
                "absolute_z": None,
            }

        std = self.stddev
        # A flat baseline should not turn tiny floating-point noise into huge z.
        scale = max(std or 0.0, std_floor)
        z = (value - self.mean) / scale
        return {
            "ready": True,
            "samples": self.count,
            "value": value,
            "mean": self.mean,
            "stddev": std,
            "z_score": z,
            "absolute_z": abs(z),
        }


class BaselineStore:
    """Thread-safe in-memory baselines with optional JSON persistence."""

    def __init__(self, path: str | Path | None = None, min_samples: int = 5):
        if min_samples < 2:
            raise ValueError("min_samples must be >= 2")
        self.path = Path(path) if path is not None else None
        self.min_samples = min_samples
        self._subjects: dict[str, dict[str, RunningStat]] = {}
        self._lock = RLock()
        if self.path and self.path.exists():
            self.load()

    def update(self, subject_id: str, feature: str, value: float) -> RunningStat:
        subject_id, feature = _keys(subject_id, feature)
        with self._lock:
            stat = self._subjects.setdefault(subject_id, {}).setdefault(feature, RunningStat())
            stat.update(value)
            return stat

    def update_many(self, subject_id: str, features: dict[str, float]) -> None:
        for feature, value in features.items():
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                continue
            self.update(subject_id, feature, float(value))

    def deviation(self, subject_id: str, feature: str, value: float) -> dict:
        subject_id, feature = _keys(subject_id, feature)
        with self._lock:
            stat = self._subjects.get(subject_id, {}).get(feature)
            if stat is None:
                return {
                    "ready": False, "samples": 0, "value": _finite(value),
                    "mean": None, "stddev": None, "z_score": None, "absolute_z": None,
                }
            return stat.deviation(value, min_samples=self.min_samples)

    def deviations(self, subject_id: str, features: dict[str, float]) -> dict[str, dict]:
        return {
            name: self.deviation(subject_id, name, float(value))
            for name, value in features.items()
            if not isinstance(value, bool) and isinstance(value, (int, float))
        }

    def snapshot(self, subject_id: str | None = None) -> dict:
        with self._lock:
            source = self._subjects if subject_id is None else {subject_id: self._subjects.get(subject_id, {})}
            return {
                sid: {name: asdict(stat) for name, stat in stats.items()}
                for sid, stats in source.items()
            }

    def save(self) -> None:
        if self.path is None:
            raise ValueError("No persistence path configured")
        payload = {"version": 1, "subjects": self.snapshot()}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_suffix(self.path.suffix + ".tmp")
        temp.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        temp.replace(self.path)

    def load(self) -> None:
        if self.path is None:
            raise ValueError("No persistence path configured")
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        if payload.get("version") != 1:
            raise ValueError("Unsupported baseline file version")
        subjects: dict[str, dict[str, RunningStat]] = {}
        for sid, features in payload.get("subjects", {}).items():
            subjects[sid] = {name: RunningStat(**raw) for name, raw in features.items()}
        with self._lock:
            self._subjects = subjects

    def clear_subject(self, subject_id: str) -> bool:
        subject_id, _ = _keys(subject_id, "_")
        with self._lock:
            return self._subjects.pop(subject_id, None) is not None


def numeric_observations(events: Iterable[dict]) -> dict[str, float]:
    """Extract numeric observable values using channel.kind as the feature key."""
    out: dict[str, float] = {}
    for event in events:
        if event.get("layer") != "observation":
            continue
        value = event.get("value")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            continue
        channel = str(event.get("channel", "")).strip()
        kind = str(event.get("kind", "")).strip()
        if channel and kind:
            out[f"{channel}.{kind}"] = float(value)
    return out


def baseline_observations(store: BaselineStore, subject_id: str, events: Iterable[dict]) -> list[dict]:
    """Compare event values to existing baselines without mutating them."""
    features = numeric_observations(events)
    results = store.deviations(subject_id, features)
    output = []
    for feature, result in results.items():
        output.append({
            "layer": "observation",
            "channel": "context",
            "kind": "baseline_deviation",
            "value": {"feature": feature, **result},
            "confidence": 1.0 if result["ready"] else 0.0,
            "quality": 1.0,
        })
    return output


def _finite(value: float) -> float:
    value = float(value)
    if not math.isfinite(value):
        raise ValueError("baseline values must be finite")
    return value


def _keys(subject_id: str, feature: str) -> tuple[str, str]:
    subject_id, feature = str(subject_id).strip(), str(feature).strip()
    if not subject_id:
        raise ValueError("subject_id must not be empty")
    if not feature:
        raise ValueError("feature must not be empty")
    return subject_id, feature
