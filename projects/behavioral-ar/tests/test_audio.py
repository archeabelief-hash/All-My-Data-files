from pipeline.audio import Transcript, TurnTiming, build_audio_observations, language_features

def test_response_timing():
    t = TurnTiming()
    t.mark_prompt_end(10.0)
    t.mark_response_start(10.42)
    t.mark_response_end(12.0)
    assert round(t.response_latency_ms) == 420
    assert t.response_duration_s == 1.58

def test_language_features_are_descriptive():
    f = language_features("Um, I think maybe I didn't do that.", duration_s=2.0)
    assert f["filler_count"] == 1
    assert f["hedge_count"] >= 2
    assert f["negation_count"] == 1
    assert f["words_per_minute"] > 0

def test_observation_builder():
    t = TurnTiming(prompt_end_s=1.0, response_start_s=1.5, response_end_s=2.5)
    tr = Transcript("No, I did not.", "en", 0.98, 1.0, [])
    events = build_audio_observations(tr, t)
    assert any(e["kind"] == "response_latency_ms" and e["value"] == 500.0 for e in events)
    assert any(e["kind"] == "transcript" for e in events)
