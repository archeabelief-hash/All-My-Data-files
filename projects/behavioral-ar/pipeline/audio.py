"""Local audio pipeline: microphone capture, faster-whisper STT, timing and language observations.

Heavy dependencies are imported lazily so the core API remains runnable without
audio hardware or a downloaded Whisper model.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from time import monotonic, time
import re
import tempfile
import wave

WORD_RE = re.compile(r"[A-Za-z0-9']+")
FILLERS = {"um", "uh", "erm", "hmm", "like"}
HEDGES = {"maybe", "perhaps", "probably", "possibly", "guess", "think", "believe", "seems", "apparently"}
NEGATIONS = {"no", "not", "never", "nothing", "nobody", "neither", "nor", "cannot", "can't", "didn't", "don't", "doesn't"}
DISTANCING = {"someone", "somebody", "they", "them", "that", "those"}

@dataclass(slots=True)
class Transcript:
    text: str
    language: str | None
    language_probability: float | None
    duration_s: float
    segments: list[dict]

@dataclass(slots=True)
class TurnTiming:
    prompt_end_s: float | None = None
    response_start_s: float | None = None
    response_end_s: float | None = None

    def mark_prompt_end(self, at: float | None = None) -> None:
        self.prompt_end_s = monotonic() if at is None else at

    def mark_response_start(self, at: float | None = None) -> None:
        self.response_start_s = monotonic() if at is None else at

    def mark_response_end(self, at: float | None = None) -> None:
        self.response_end_s = monotonic() if at is None else at

    @property
    def response_latency_ms(self) -> float | None:
        if self.prompt_end_s is None or self.response_start_s is None:
            return None
        return max(0.0, (self.response_start_s - self.prompt_end_s) * 1000)

    @property
    def response_duration_s(self) -> float | None:
        if self.response_start_s is None or self.response_end_s is None:
            return None
        return max(0.0, self.response_end_s - self.response_start_s)

def capture_microphone(duration_s: float = 5.0, sample_rate: int = 16000, channels: int = 1, device=None) -> Path:
    """Capture PCM16 microphone audio to a temporary WAV file."""
    if duration_s <= 0:
        raise ValueError("duration_s must be > 0")
    try:
        import numpy as np
        import sounddevice as sd
    except ImportError as exc:
        raise RuntimeError("Audio capture requires: pip install -r requirements-audio.txt") from exc

    frames = int(duration_s * sample_rate)
    recording = sd.rec(frames, samplerate=sample_rate, channels=channels, dtype="float32", device=device)
    sd.wait()
    pcm = (np.clip(recording, -1.0, 1.0) * 32767).astype(np.int16)

    tmp = tempfile.NamedTemporaryFile(prefix="behavioral-ar-", suffix=".wav", delete=False)
    path = Path(tmp.name)
    tmp.close()
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm.tobytes())
    return path

class WhisperTranscriber:
    """Lazy faster-whisper wrapper. Model downloads only when instantiated/used."""

    def __init__(self, model_size: str = "small.en", device: str = "auto", compute_type: str = "int8"):
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise RuntimeError("Transcription requires: pip install -r requirements-audio.txt") from exc
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def transcribe(self, audio_path: str | Path, language: str | None = None) -> Transcript:
        segments_iter, info = self.model.transcribe(
            str(audio_path),
            language=language,
            vad_filter=True,
            beam_size=1,
            condition_on_previous_text=False,
        )
        segments = []
        text_parts = []
        duration = 0.0
        for seg in segments_iter:
            clean = seg.text.strip()
            if clean:
                text_parts.append(clean)
            duration = max(duration, float(seg.end))
            segments.append({"start": float(seg.start), "end": float(seg.end), "text": clean})
        return Transcript(
            text=" ".join(text_parts).strip(),
            language=getattr(info, "language", None),
            language_probability=getattr(info, "language_probability", None),
            duration_s=duration,
            segments=segments,
        )

def language_features(text: str, duration_s: float | None = None) -> dict:
    """Extract descriptive lexical features; none are treated as deception evidence."""
    tokens = [t.lower() for t in WORD_RE.findall(text)]
    n = len(tokens)
    questions = text.count("?")
    features = {
        "word_count": n,
        "question_count": questions,
        "filler_count": sum(t in FILLERS for t in tokens),
        "hedge_count": sum(t in HEDGES for t in tokens),
        "negation_count": sum(t in NEGATIONS for t in tokens),
        "first_person_count": sum(t in {"i", "me", "my", "mine", "we", "us", "our", "ours"} for t in tokens),
        "distancing_term_count": sum(t in DISTANCING for t in tokens),
        "avg_word_length": round(sum(map(len, tokens)) / n, 3) if n else 0.0,
    }
    if duration_s and duration_s > 0:
        features["words_per_minute"] = round(n / duration_s * 60.0, 2)
    else:
        features["words_per_minute"] = None
    return features

def build_audio_observations(transcript: Transcript, timing: TurnTiming) -> list[dict]:
    """Convert audio results to neutral observation events for the fusion layer."""
    now_ms = int(time() * 1000)
    features = language_features(transcript.text, transcript.duration_s or timing.response_duration_s)
    events = [{
        "timestamp_ms": now_ms,
        "layer": "observation",
        "channel": "language",
        "kind": "transcript",
        "value": transcript.text,
        "confidence": float(transcript.language_probability or 0.75),
        "quality": 1.0,
    }]
    if timing.response_latency_ms is not None:
        events.append({
            "timestamp_ms": now_ms,
            "layer": "observation",
            "channel": "vocal",
            "kind": "response_latency_ms",
            "value": round(timing.response_latency_ms, 1),
            "confidence": 1.0,
            "quality": 1.0,
        })
    for name, value in features.items():
        events.append({
            "timestamp_ms": now_ms,
            "layer": "observation",
            "channel": "language",
            "kind": name,
            "value": value,
            "confidence": 1.0,
            "quality": 1.0,
        })
    return events

def capture_and_transcribe(
    duration_s: float = 5.0,
    model_size: str = "small.en",
    language: str | None = "en",
    timing: TurnTiming | None = None,
) -> dict:
    """Convenience path for a single local microphone turn."""
    timing = timing or TurnTiming()
    timing.mark_response_start()
    path = capture_microphone(duration_s=duration_s)
    timing.mark_response_end()
    try:
        transcript = WhisperTranscriber(model_size=model_size).transcribe(path, language=language)
        return {
            "transcript": asdict(transcript),
            "timing": asdict(timing),
            "features": language_features(transcript.text, transcript.duration_s),
            "observations": build_audio_observations(transcript, timing),
        }
    finally:
        path.unlink(missing_ok=True)
