#!/usr/bin/env python3
"""Run repeatable TTS capacity scenarios and print one JSON result to stdout."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Sample:
    scenario: str
    status: int
    ttfa_ms: float | None
    elapsed_ms: float
    audio_seconds: float
    rtf: float | None
    cached: bool
    retry_after: str | None = None


def request_json(url: str, token: str, *, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method="POST" if data is not None else "GET",
        headers={
            "Content-Type": "application/json",
            "X-TTS-Internal-Token": token,
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def synthesize(
    base_url: str,
    token: str,
    *,
    scenario: str,
    text: str,
    source_revision: str,
) -> Sample:
    payload = {
        "text": text,
        "text_hash": hashlib.sha256(text.encode()).hexdigest(),
        "normalizer_version": "benchmark-v1",
        "source_revision": source_revision,
        "voice_id": "north-male-natural",
        "style": "tu_nhien",
        "artifact_policy": "cache_only",
    }
    session = request_json(f"{base_url}/internal/v1/sessions", token, payload=payload)
    request = urllib.request.Request(f"{base_url}{session['stream_path']}")
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            first = response.read(45)
            first_audio_at = time.perf_counter() if len(first) > 44 else None
            body = first + response.read()
            status = response.status
            retry_after = response.headers.get("Retry-After")
    except urllib.error.HTTPError as error:
        elapsed_ms = (time.perf_counter() - started) * 1000
        return Sample(
            scenario=scenario,
            status=error.code,
            ttfa_ms=None,
            elapsed_ms=round(elapsed_ms, 3),
            audio_seconds=0,
            rtf=None,
            cached=bool(session["cached"]),
            retry_after=error.headers.get("Retry-After"),
        )
    elapsed = time.perf_counter() - started
    audio_seconds = max(0, len(body) - 44) / (48_000 * 2)
    return Sample(
        scenario=scenario,
        status=status,
        ttfa_ms=(
            round((first_audio_at - started) * 1000, 3)
            if first_audio_at is not None
            else None
        ),
        elapsed_ms=round(elapsed * 1000, 3),
        audio_seconds=round(audio_seconds, 3),
        rtf=round(elapsed / audio_seconds, 3) if audio_seconds else None,
        cached=bool(session["cached"]),
        retry_after=retry_after,
    )


def p95(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return round(ordered[round((len(ordered) - 1) * 0.95)], 3)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    parser.add_argument(
        "--token", default=os.getenv("TTS_INTERNAL_TOKEN", "")
    )
    parser.add_argument("--runs", type=int, default=5)
    args = parser.parse_args()
    if not args.token:
        parser.error("--token or TTS_INTERNAL_TOKEN is required")
    base_url = args.base_url.rstrip("/")
    run_id = str(time.time_ns())
    text = (
        "ProCV đo độ trễ tổng hợp giọng nói trên phần cứng production dự kiến. "
        "Nội dung đủ dài để phản ánh thời gian phát âm thực tế."
    )
    before = request_json(f"{base_url}/internal/v1/status", args.token)
    samples: list[Sample] = []

    for index in range(args.runs):
        revision = f"benchmark:miss:{run_id}:{index}"
        samples.append(
            synthesize(
                base_url,
                args.token,
                scenario="cache_miss",
                text=f"{text} Lượt {index}.",
                source_revision=revision,
            )
        )
        samples.append(
            synthesize(
                base_url,
                args.token,
                scenario="cache_hit",
                text=f"{text} Lượt {index}.",
                source_revision=revision,
            )
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(
                synthesize,
                base_url,
                args.token,
                scenario="three_unique",
                text=f"{text} Đồng thời {index}.",
                source_revision=f"benchmark:unique:{run_id}:{index}",
            )
            for index in range(3)
        ]
        samples.extend(future.result() for future in futures)

    shared_revision = f"benchmark:shared:{run_id}"
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(
                synthesize,
                base_url,
                args.token,
                scenario="shared_singleflight",
                text=text,
                source_revision=shared_revision,
            )
            for _ in range(10)
        ]
        samples.extend(future.result() for future in futures)

    after = request_json(f"{base_url}/internal/v1/status", args.token)
    ttfa = [sample.ttfa_ms for sample in samples if sample.ttfa_ms is not None]
    rtf = [sample.rtf for sample in samples if sample.rtf is not None]
    rejected = [sample for sample in samples if sample.status in {429, 503}]
    output = {
        "samples": [asdict(sample) for sample in samples],
        "summary": {
            "sample_count": len(samples),
            "ttfa_ms_p95": p95(ttfa),
            "rtf_p95": p95(rtf),
            "rejection_rate": round(len(rejected) / len(samples), 4),
            "process_cpu_seconds_delta": round(
                after["metrics"]["process_cpu_seconds"]
                - before["metrics"]["process_cpu_seconds"],
                3,
            ),
            "process_rss_bytes_peak": max(
                before["metrics"]["process_rss_bytes"],
                after["metrics"]["process_rss_bytes"],
            ),
            "queue_wait_ms_p95": after["metrics"]["queue_wait_ms_p95"],
            "cache": after["cache"],
        },
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
