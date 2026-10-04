import numpy as np

from pipeline.video import FaceBox, MotionEnergy, analyze_frame, build_video_observations


class StubFaces:
    def __init__(self, faces):
        self.faces = faces
    def detect(self, _frame):
        return self.faces


def test_motion_energy_static_then_changed():
    motion = MotionEnergy(blur_size=1)
    black = np.zeros((20, 20, 3), dtype=np.uint8)
    white = np.full((20, 20, 3), 255, dtype=np.uint8)
    assert motion.update(black) == 0.0
    assert motion.update(black) == 0.0
    assert motion.update(white) == 1.0


def test_face_presence_and_normalized_box_are_observable():
    frame = np.zeros((100, 200, 3), dtype=np.uint8)
    analysis = analyze_frame(frame, StubFaces([FaceBox(20, 10, 40, 30)]), MotionEnergy(1), timestamp_ms=123)
    assert analysis["face_present"] is True
    assert analysis["face_count"] == 1
    assert analysis["face_boxes"][0] == {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.3}
    assert analysis["motion_energy"] == 0.0


def test_observations_do_not_emit_emotion_or_identity():
    analysis = {
        "timestamp_ms": 1,
        "frame": {"width": 100, "height": 100},
        "face_present": False,
        "face_count": 0,
        "face_boxes": [],
        "motion_energy": 0.25,
    }
    events = build_video_observations(analysis)
    kinds = {event["kind"] for event in events}
    assert kinds == {"face_present", "face_count", "frame_motion_energy"}
