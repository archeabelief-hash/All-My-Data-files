from pipeline.fusion import FusionConfig, fuse_events


def obs(ts, channel, kind, value, confidence=1.0, quality=1.0):
    return {
        "timestamp_ms": ts,
        "layer": "observation",
        "channel": channel,
        "kind": kind,
        "value": value,
        "confidence": confidence,
        "quality": quality,
    }


def baseline(ts, feature, z):
    return obs(ts, "context", "baseline_deviation", {
        "feature": feature,
        "ready": True,
        "samples": 10,
        "value": 1.0,
        "mean": 0.0,
        "stddev": 0.25,
        "z_score": z,
        "absolute_z": abs(z),
    })


def test_empty_input_is_insufficient():
    result = fuse_events([])
    assert result[0]["label"] == "INSUFFICIENT EVIDENCE"
    assert result[0]["confidence"] == 0.0


def test_multichannel_baseline_shift():
    events = [
        obs(1000, "vocal", "response_latency_ms", 800),
        obs(1050, "motion", "frame_motion_energy", 0.8),
        obs(1100, "language", "words_per_minute", 210),
        baseline(1150, "vocal.response_latency_ms", 4.0),
        baseline(1160, "motion.frame_motion_energy", 4.0),
        baseline(1170, "language.words_per_minute", 4.0),
    ]
    result = fuse_events(events)[0]
    assert result["label"] == "BASELINE SHIFT"
    assert result["confidence"] >= 0.72
    assert {s["channel"] for s in result["supports"]} >= {"vocal", "motion", "language"}


def test_single_channel_cannot_be_high_confidence_baseline_shift():
    events = [obs(1000, "motion", "frame_motion_energy", 1.0), baseline(1050, "motion.frame_motion_energy", 4.0)]
    result = fuse_events(events)[0]
    assert result["label"] != "BASELINE SHIFT"


def test_direct_motion_can_report_changed_without_psychological_label():
    config = FusionConfig(changed_threshold=0.4)
    result = fuse_events([obs(1000, "motion", "frame_motion_energy", 1.0)], config)[0]
    assert result["label"] == "SIGNALS CHANGED"
    assert "emotion" not in result
    assert "deception" not in result


def test_low_quality_events_are_ignored():
    result = fuse_events([obs(1000, "motion", "frame_motion_energy", 1.0, quality=0.1)])
    assert result[0]["label"] == "INSUFFICIENT EVIDENCE"


def test_events_are_split_into_temporal_windows():
    result = fuse_events([
        obs(100, "motion", "frame_motion_energy", 0.0),
        obs(2000, "motion", "frame_motion_energy", 1.0),
    ], FusionConfig(window_ms=1000, changed_threshold=0.4))
    assert len(result) == 2
    assert result[0]["label"] == "NORMAL"
    assert result[1]["label"] == "SIGNALS CHANGED"
