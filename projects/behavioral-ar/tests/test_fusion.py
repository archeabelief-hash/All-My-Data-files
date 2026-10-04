from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)

def test_face_only_event_is_normalized_and_does_not_error():
    response = client.post("/api/fuse", json={"signals": [{
        "channel": "face",
        "kind": "face_landmark_delta",
        "deviation": 2.5,
        "confidence": 0.8,
        "quality": 0.9
    }]})
    assert response.status_code == 200
    body = response.json()
    assert body["supports"] == [{"channel": "visual", "kind": "face_landmark_delta"}]
    assert body["label"] in {"NORMAL", "SIGNALS CHANGED"}
