# Behavioral AR — Human Communication Interpretation Prototype

A research/development prototype for an AR-assisted human communication system.

## Core rule
The system never claims to read minds or prove deception. It separates:
1. **Observation** — measurable sensor event.
2. **Inference** — hypothesis supported by one or more observations.
3. **Confidence** — calibrated strength/quality of evidence.
4. **Verification** — factual or conversational evidence when available.

## MVP
Phone/PC camera + microphone -> timestamped observations -> personal baseline -> multimodal fusion -> simulated AR HUD.

Initial HUD states:
- NORMAL
- BASELINE SHIFT
- STATEMENT CONFLICT
- QUESTION AVOIDANCE
- PRESSURE / PERSUASION PATTERN
- UNVERIFIABLE
- INSUFFICIENT EVIDENCE

## Repository layout
- `docs/ARCHITECTURE.md` — system architecture and hardware migration plan
- `docs/RESEARCH_PROTOCOL.md` — measurement and validation rules
- `schemas/event.schema.json` — common observation/inference event format
- `backend/app.py` — local prototype API and fusion engine
- `pipeline/audio.py` — microphone capture, faster-whisper STT, response timing, language features
- `pipeline/video.py` — OpenCV camera capture, face presence/boxes, frame motion energy
- `pipeline/baseline.py` — per-subject numeric feature baselines, persistence, deviation scores
- `requirements-audio.txt` — optional local audio dependencies
- `requirements-video.txt` — optional OpenCV camera dependencies
- `web/index.html` — simulated glasses HUD
- `requirements.txt` — Python dependencies

## Run locally
Requires Python 3.10+.

```bash
cd projects/behavioral-ar
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000`.

### Enable local audio
```bash
pip install -r requirements-audio.txt
```
`faster-whisper` downloads the selected model on first use. The default is `small.en`. Audio capture and model imports are lazy, so the core API can run without these optional packages.

### Enable local video
```bash
pip install -r requirements-video.txt
```
The video pipeline emits observable camera measurements only. It does not perform emotion recognition, face identity, deception inference, or mental-state classification.

### Baselines
`BaselineStore` learns numeric observable-feature distributions per opaque subject/session ID. By default a feature needs 5 prior samples before a deviation z-score is emitted. Baseline deviation is statistical distance only; it is not an emotion, deception, intent, identity, or diagnosis label.

### Tests
```bash
pytest -q
```

## Next milestones
1. Android sensor client (camera/mic with explicit consent)
2. local speech-to-text
3. vocal timing/prosody feature extractor
4. language/claim/contradiction analyzer
5. face/posture observation adapters
6. individualized baseline model
7. multimodal temporal fusion
8. evaluation dataset + calibration
9. Meta Wearables mock-device adapter
10. hardware validation

## Privacy
Default architecture is local-first. Do not identify, diagnose, or secretly profile people. Recording/analysis must follow applicable consent and privacy laws.
