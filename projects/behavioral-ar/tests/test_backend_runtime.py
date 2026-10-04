from fastapi.testclient import TestClient

import backend.app as backend

client = TestClient(backend.app)


def event(channel, kind, value, ts=1000):
    return {
        "timestamp_ms": ts,
        "layer": "observation",
        "channel": channel,
        "kind": kind,
        "value": value,
        "confidence": 1.0,
        "quality": 1.0,
    }


def reset(subject):
    backend.baselines.clear_subject(subject)


def test_video_ingest_learns_after_scoring():
    subject = "test-video"
    reset(subject)
    response = client.post("/api/video", json={
        "subject_id": subject,
        "events": [event("motion", "frame_motion_energy", 0.2)],
        "learn": True,
    })
    assert response.status_code == 200
    body = response.json()
    assert body["accepted_events"] == 1
    assert body["baseline_events"][0]["value"]["samples"] == 0
    lookup = client.get(f"/api/baseline/{subject}").json()
    assert lookup["features"]["motion.frame_motion_energy"]["count"] == 1


def test_audio_rejects_video_channels_from_audio_route():
    subject = "test-audio-filter"
    reset(subject)
    response = client.post("/api/audio", json={
        "subject_id": subject,
        "events": [
            event("language", "word_count", 10),
            event("motion", "frame_motion_energy", 1.0),
        ],
        "learn": False,
    })
    assert response.status_code == 200
    assert response.json()["accepted_events"] == 1


def test_face_alias_is_accepted_by_video_route():
    subject = "test-face-alias"
    reset(subject)
    response = client.post("/api/video", json={
        "subject_id": subject,
        "events": [event("face", "face_count", 1)],
        "learn": False,
    })
    assert response.status_code == 200
    assert response.json()["accepted_events"] == 1


def test_baseline_lookup_and_delete():
    subject = "test-delete"
    reset(subject)
    backend.baselines.update(subject, "language.word_count", 12)
    backend.baselines.save()
    assert client.get(f"/api/baseline/{subject}").json()["features"]
    assert client.delete(f"/api/baseline/{subject}").json()["deleted"] is True
    assert client.get(f"/api/baseline/{subject}").json()["features"] == {}


def test_legacy_fuse_still_works():
    response = client.post("/api/fuse", json={"signals": [{
        "channel": "face",
        "kind": "face_landmark_delta",
        "deviation": 2.0,
        "confidence": 0.8,
        "quality": 0.9,
    }]})
    assert response.status_code == 200
    assert response.json()["layer"] == "presentation"
