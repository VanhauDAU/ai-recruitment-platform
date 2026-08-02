import hashlib
import importlib
import io
import struct
import time
import wave
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from procv_tts.identity import artifact_identity


def app_module(monkeypatch, tmp_path):
    monkeypatch.setenv("TTS_FAKE_ENGINE", "1")
    monkeypatch.setenv("TTS_CACHE_DIR", str(tmp_path))
    monkeypatch.setenv("TTS_INTERNAL_TOKEN", "test-internal-token")
    monkeypatch.setenv("TTS_BACKEND", "onnx")
    monkeypatch.setenv("TTS_PRECISION", "int8")
    monkeypatch.setenv("TTS_MAX_CONCURRENT_STREAMS", "1")
    import procv_tts.main

    return importlib.reload(procv_tts.main)


def session_payload(text="Xin chào, đây là bài viết thử nghiệm.", **overrides):
    return {
        "text": text,
        "text_hash": hashlib.sha256(text.encode()).hexdigest(),
        "normalizer_version": "blog-speech-v1",
        "source_revision": "blog.post:ps_test:r1",
        "voice_id": "north-male-natural",
        "style": "tu_nhien",
        **overrides,
    }


def internal_headers():
    return {"X-TTS-Internal-Token": "test-internal-token"}


def wait_until_ready(client, artifact_key, timeout=2):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        response = client.get(
            f"/internal/v1/artifacts/{artifact_key}",
            headers=internal_headers(),
        )
        if response.json()["status"] == "READY":
            return response.json()
        time.sleep(0.01)
    raise AssertionError("artifact did not become ready")


def test_capabilities_and_stream_are_private_and_cacheable(monkeypatch, tmp_path):
    module = app_module(monkeypatch, tmp_path)
    with TestClient(module.app) as client:
        assert client.get("/internal/v1/capabilities").status_code == 404
        capabilities = client.get(
            "/internal/v1/capabilities",
            headers=internal_headers(),
        )
        assert capabilities.status_code == 200
        assert len(capabilities.json()["voices"]) == 14
        readiness = client.get("/readyz").json()
        assert readiness["model_workers"] == 1

        created = client.post(
            "/internal/v1/sessions",
            headers=internal_headers(),
            json=session_payload(),
        )
        assert created.status_code == 201
        assert len(created.json()["artifact_key"]) == 64
        assert len(created.json()["config_hash"]) == 64
        first = client.get(created.json()["stream_path"])
        assert first.status_code == 200
        assert first.headers["content-type"].startswith("audio/wav")
        assert first.content.startswith(b"RIFF")
        assert struct.unpack("<I", first.content[40:44])[0] == 0xFFFFFFFF

        replay = client.get(created.json()["stream_path"])
        assert replay.status_code == 200
        with wave.open(io.BytesIO(replay.content), "rb") as cached_wav:
            assert cached_wav.getframerate() == 48_000
            assert cached_wav.getnframes() > 0

        cached_session = client.post(
            "/internal/v1/sessions",
            headers=internal_headers(),
            json=session_payload(),
        )
        assert cached_session.json()["cached"] is True
        assert cached_session.json()["artifact_key"] == created.json()["artifact_key"]


def test_rejects_unknown_voice_and_mismatched_text_hash(monkeypatch, tmp_path):
    module = app_module(monkeypatch, tmp_path)
    with TestClient(module.app) as client:
        unknown = client.post(
            "/internal/v1/sessions",
            headers=internal_headers(),
            json=session_payload(voice_id="unknown"),
        )
        mismatch = client.post(
            "/internal/v1/sessions",
            headers=internal_headers(),
            json=session_payload(text_hash="b" * 64),
        )
        assert unknown.status_code == 422
        assert mismatch.status_code == 422


def test_long_stream_is_segmented_and_reuses_pcm_cache(monkeypatch, tmp_path):
    module = app_module(monkeypatch, tmp_path)
    text = " ".join(
        f"Đây là câu thử nghiệm số {index}, có nội dung rõ ràng." for index in range(35)
    )
    with TestClient(module.app) as client:
        first = client.post(
            "/internal/v1/sessions",
            headers=internal_headers(),
            json=session_payload(text),
        )
        assert client.get(first.json()["stream_path"]).status_code == 200
        calls = [
            call for call in module.runtime._engine.infer_calls if call != "Xin chào."
        ]
        assert len(calls) > 1
        assert all(len(call) <= 240 for call in calls)
        call_count = len(calls)

        second = client.post(
            "/internal/v1/sessions",
            headers=internal_headers(),
            json=session_payload(text, source_revision="blog.post:ps_test:r2"),
        )
        assert second.json()["artifact_key"] != first.json()["artifact_key"]
        assert client.get(second.json()["stream_path"]).status_code == 200
        calls = [
            call for call in module.runtime._engine.infer_calls if call != "Xin chào."
        ]
        assert len(calls) == call_count


def test_ten_listeners_share_one_live_inference_and_one_mp3(monkeypatch, tmp_path):
    module = app_module(monkeypatch, tmp_path)
    encode_calls = []

    def fake_encode(_source, target, **_kwargs):
        encode_calls.append(1)
        target.write_bytes(b"ID3-live-pcm")

    monkeypatch.setattr("procv_tts.artifacts._encode_mp3", fake_encode)
    with TestClient(module.app) as client:
        sessions = [
            client.post(
                "/internal/v1/sessions",
                headers=internal_headers(),
                json=session_payload(),
            ).json()
            for _ in range(10)
        ]
        assert len({item["artifact_key"] for item in sessions}) == 1

        with ThreadPoolExecutor(max_workers=10) as executor:
            responses = list(
                executor.map(lambda item: client.get(item["stream_path"]), sessions)
            )

        assert all(response.status_code == 200 for response in responses)
        calls = [
            call for call in module.runtime._engine.infer_calls if call != "Xin chào."
        ]
        assert calls == ["Xin chào, đây là bài viết thử nghiệm."]
        artifact = wait_until_ready(client, sessions[0]["artifact_key"])
        assert artifact["asset_url"].endswith(f"{sessions[0]['artifact_key']}.mp3")
        assert encode_calls == [1]


def test_mp3_is_derived_from_live_wav_without_asset_generation_endpoint(
    monkeypatch, tmp_path
):
    module = app_module(monkeypatch, tmp_path)
    encoded_sources = []

    def fake_encode(source, target, **_kwargs):
        encoded_sources.append(source.read_bytes())
        target.write_bytes(b"ID3-live-pcm")

    monkeypatch.setattr("procv_tts.artifacts._encode_mp3", fake_encode)
    with TestClient(module.app) as client:
        assert (
            client.post("/internal/v1/assets", headers=internal_headers()).status_code
            == 404
        )
        created = client.post(
            "/internal/v1/sessions",
            headers=internal_headers(),
            json=session_payload(),
        ).json()
        streamed = client.get(created["stream_path"])
        inference_calls = list(module.runtime._engine.infer_calls)
        artifact = wait_until_ready(client, created["artifact_key"])

        assert encoded_sources == [
            module.audio_cache.path(created["artifact_key"]).read_bytes()
        ]
        assert module.runtime._engine.infer_calls == inference_calls
        full = client.get(artifact["asset_url"])
        assert full.status_code == 200
        assert full.headers["cache-control"] == "public, max-age=31536000, immutable"
        partial = client.get(artifact["asset_url"], headers={"Range": "bytes=0-2"})
        assert partial.status_code == 206
        assert partial.content == b"ID3"
        assert streamed.content[44:] == encoded_sources[0][44:]


def test_artifact_identity_covers_voice_style_revision_model_and_config():
    base = {
        "text_digest": "a" * 64,
        "source_revision": "blog.post:ps_test:r1",
        "voice_id": "north-male-natural",
        "style": "tu_nhien",
        "model_source": "vieneu",
        "model_revision": "model-1",
        "backend": "onnx",
        "precision": "int8",
        "sample_rate": 48_000,
        "text_normalizer": "blog-speech-v1",
    }
    key, config_hash = artifact_identity(**base)
    mutations = [
        {"voice_id": "south-female-story"},
        {"style": "doc_truyen"},
        {"source_revision": "blog.post:ps_test:r2"},
        {"model_revision": "model-2"},
        {"backend": "pytorch"},
        {"precision": "fp32"},
        {"sample_rate": 24_000},
        {"text_normalizer": "blog-speech-v2"},
    ]

    assert len(key) == len(config_hash) == 64
    assert all(
        artifact_identity(**{**base, **change})[0] != key for change in mutations
    )
