import json

from pipeline.baseline import BaselineStore, RunningStat, baseline_observations, numeric_observations


def test_running_stat_and_deviation():
    stat = RunningStat()
    for value in [8, 9, 10, 11, 12]:
        stat.update(value)
    result = stat.deviation(13, min_samples=5)
    assert result["ready"] is True
    assert result["mean"] == 10
    assert result["z_score"] > 0
    assert result["absolute_z"] == abs(result["z_score"])


def test_not_ready_before_minimum_samples():
    store = BaselineStore(min_samples=5)
    for value in [1, 2, 3, 4]:
        store.update("session-a", "motion.frame_motion_energy", value)
    assert store.deviation("session-a", "motion.frame_motion_energy", 5)["ready"] is False


def test_subjects_are_isolated():
    store = BaselineStore(min_samples=2)
    store.update_many("a", {"vocal.response_latency_ms": 100, "language.word_count": 10})
    store.update_many("b", {"vocal.response_latency_ms": 900})
    assert store.snapshot("a")["a"]["vocal.response_latency_ms"]["mean"] == 100
    assert store.snapshot("b")["b"]["vocal.response_latency_ms"]["mean"] == 900


def test_persistence_round_trip(tmp_path):
    path = tmp_path / "baseline.json"
    store = BaselineStore(path=path, min_samples=2)
    store.update("opaque-1", "language.words_per_minute", 120)
    store.update("opaque-1", "language.words_per_minute", 140)
    store.save()
    loaded = BaselineStore(path=path, min_samples=2)
    assert loaded.snapshot() == store.snapshot()
    assert json.loads(path.read_text())["version"] == 1


def test_numeric_observations_ignore_boolean_and_non_numeric():
    events = [
        {"layer": "observation", "channel": "visual", "kind": "face_present", "value": True},
        {"layer": "observation", "channel": "motion", "kind": "frame_motion_energy", "value": 0.2},
        {"layer": "observation", "channel": "language", "kind": "transcript", "value": "hello"},
    ]
    assert numeric_observations(events) == {"motion.frame_motion_energy": 0.2}


def test_baseline_observation_is_statistical_not_psychological():
    store = BaselineStore(min_samples=2)
    store.update("s", "vocal.response_latency_ms", 100)
    store.update("s", "vocal.response_latency_ms", 120)
    events = [{"layer": "observation", "channel": "vocal", "kind": "response_latency_ms", "value": 300}]
    result = baseline_observations(store, "s", events)
    assert result[0]["kind"] == "baseline_deviation"
    assert result[0]["value"]["feature"] == "vocal.response_latency_ms"
    assert "emotion" not in result[0]["value"]
    assert "deception" not in result[0]["value"]
