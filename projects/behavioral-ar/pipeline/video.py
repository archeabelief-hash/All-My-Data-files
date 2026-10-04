"""Local video pipeline for observable camera features only.

Outputs camera/frame measurements, OpenCV face detections and pixel-motion
energy. It deliberately does not infer emotion, identity, deception, attention,
intent, diagnosis, or internal mental state.
"""
from __future__ import annotations

from dataclasses import dataclass
from time import time
from typing import Iterator

import cv2
import numpy as np


@dataclass(frozen=True, slots=True)
class FaceBox:
    x: int
    y: int
    width: int
    height: int

    def normalized(self, frame_width: int, frame_height: int) -> dict[str, float]:
        if frame_width <= 0 or frame_height <= 0:
            raise ValueError("frame dimensions must be positive")
        return {
            "x": round(self.x / frame_width, 6),
            "y": round(self.y / frame_height, 6),
            "width": round(self.width / frame_width, 6),
            "height": round(self.height / frame_height, 6),
        }


class FacePresenceDetector:
    """OpenCV Haar detector used only for face presence/box geometry."""

    def __init__(self, cascade_path: str | None = None):
        path = cascade_path or (cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        self.classifier = cv2.CascadeClassifier(path)
        if self.classifier.empty():
            raise RuntimeError(f"Could not load OpenCV face cascade: {path}")

    def detect(self, frame: np.ndarray) -> list[FaceBox]:
        gray = to_gray(frame)
        boxes = self.classifier.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
        )
        return [FaceBox(*(int(v) for v in box)) for box in boxes]


class MotionEnergy:
    """Frame-to-frame grayscale absolute difference, normalized to [0, 1]."""

    def __init__(self, blur_size: int = 5):
        if blur_size < 1 or blur_size % 2 == 0:
            raise ValueError("blur_size must be a positive odd integer")
        self.blur_size = blur_size
        self.previous: np.ndarray | None = None

    def update(self, frame: np.ndarray) -> float:
        gray = cv2.GaussianBlur(to_gray(frame), (self.blur_size, self.blur_size), 0)
        if self.previous is None or self.previous.shape != gray.shape:
            self.previous = gray
            return 0.0
        diff = cv2.absdiff(self.previous, gray)
        self.previous = gray
        return float(np.mean(diff) / 255.0)


class CameraCapture:
    def __init__(self, device: int = 0, width: int | None = None, height: int | None = None):
        self.capture = cv2.VideoCapture(device)
        if width:
            self.capture.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        if height:
            self.capture.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        if not self.capture.isOpened():
            self.capture.release()
            raise RuntimeError(f"Could not open camera device {device}")

    def read(self) -> np.ndarray:
        ok, frame = self.capture.read()
        if not ok or frame is None:
            raise RuntimeError("Camera frame read failed")
        return frame

    def frames(self) -> Iterator[np.ndarray]:
        while self.capture.isOpened():
            yield self.read()

    def close(self) -> None:
        self.capture.release()

    def __enter__(self) -> "CameraCapture":
        return self

    def __exit__(self, *_args) -> None:
        self.close()


def to_gray(frame: np.ndarray) -> np.ndarray:
    if frame is None or frame.size == 0:
        raise ValueError("frame must not be empty")
    if frame.ndim == 2:
        return frame
    if frame.ndim == 3 and frame.shape[2] == 3:
        return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if frame.ndim == 3 and frame.shape[2] == 4:
        return cv2.cvtColor(frame, cv2.COLOR_BGRA2GRAY)
    raise ValueError(f"unsupported frame shape: {frame.shape}")


def analyze_frame(
    frame: np.ndarray,
    face_detector: FacePresenceDetector,
    motion: MotionEnergy,
    timestamp_ms: int | None = None,
) -> dict:
    height, width = frame.shape[:2]
    faces = face_detector.detect(frame)
    energy = motion.update(frame)
    return {
        "timestamp_ms": int(time() * 1000) if timestamp_ms is None else timestamp_ms,
        "frame": {"width": width, "height": height},
        "face_present": bool(faces),
        "face_count": len(faces),
        "face_boxes": [face.normalized(width, height) for face in faces],
        "motion_energy": round(energy, 6),
    }


def build_video_observations(analysis: dict) -> list[dict]:
    """Convert measurements to neutral observation events."""
    timestamp_ms = analysis["timestamp_ms"]
    events = [
        {
            "timestamp_ms": timestamp_ms,
            "layer": "observation",
            "channel": "visual",
            "kind": "face_present",
            "value": analysis["face_present"],
            "confidence": 1.0,
            "quality": 1.0,
        },
        {
            "timestamp_ms": timestamp_ms,
            "layer": "observation",
            "channel": "visual",
            "kind": "face_count",
            "value": analysis["face_count"],
            "confidence": 1.0,
            "quality": 1.0,
        },
        {
            "timestamp_ms": timestamp_ms,
            "layer": "observation",
            "channel": "motion",
            "kind": "frame_motion_energy",
            "value": analysis["motion_energy"],
            "confidence": 1.0,
            "quality": 1.0,
        },
    ]
    for box in analysis["face_boxes"]:
        events.append({
            "timestamp_ms": timestamp_ms,
            "layer": "observation",
            "channel": "visual",
            "kind": "face_box",
            "value": box,
            "confidence": 1.0,
            "quality": 1.0,
        })
    return events
