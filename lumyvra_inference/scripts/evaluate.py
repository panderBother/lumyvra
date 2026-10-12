"""Generate an explicitly labelled local evaluation sample through the real private service."""
import argparse
import json
import secrets
import sys
import time
from pathlib import Path

import httpx

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from music_service.settings import Settings  # noqa: E402

LYRICS = """[Verse]
晚风轻轻经过窗边
把今天折成一张信笺
我听见街角最后的告别
也看见明天微亮的天

[Pre-Chorus]
那些走得太急的瞬间
终于可以慢一点

[Chorus]
让晚风把心事唱一遍
让星光落在你的指尖
路再远也总会有人等
等我们把故事写到明天

[Verse]
雨后路灯照着屋檐
你把笑容留在我身边
那些来不及说出的心愿
慢慢变成一首歌的起点

[Chorus]
让晚风把心事唱一遍
让星光落在你的指尖
路再远也总会有人等
等我们把故事写到明天

[Bridge]
不必追赶所有的时间
此刻的温柔就是答案

[Chorus]
让晚风把心事唱一遍
让星光落在你的指尖
路再远也总会有人等
等我们把故事写到明天

[Outro]
晚风轻轻经过窗边
我们把故事写到明天"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=int, choices=(30, 60, 120, 180, 240), default=30)
    parser.add_argument("--theme", help="Test actual text-to-song lyric planning instead of the fixed handwritten sample.")
    parser.add_argument("--genre", default="流行")
    parser.add_argument("--mood", default="治愈")
    parser.add_argument("--style", default="warm Mandarin acoustic pop, natural clear female lead vocal, acoustic guitar and gentle drums, memorable chorus, growing verse-chorus dynamics, complete musical ending")
    args = parser.parse_args()
    settings = Settings()
    job_id = "job-" + secrets.token_hex(12)
    headers = {"Authorization": "Bearer " + settings.inference_api_key.get_secret_value()}
    lyrics = LYRICS if args.seconds >= 120 else "[Verse]\n晚风轻轻经过窗边\n把今天折成一张信笺\n[Chorus]\n让晚风把心事唱一遍\n让星光落在你的指尖"
    started = time.monotonic()
    with httpx.Client(base_url="http://127.0.0.1:8090", headers=headers, timeout=60) as client:
        response = client.post("/v1/jobs", json={"id": job_id, "mode": "text" if args.theme else "lyrics", "prompt": args.theme or lyrics,
                             "style_prompt": args.style, "genre": args.genre, "mood": args.mood, "seconds": args.seconds, "seed": 42})
        response.raise_for_status()
        print(json.dumps({"job": job_id, "seconds": args.seconds, "kind": "smoke" if args.seconds == 30 else "full-song"}), flush=True)
        previous = None
        while time.monotonic() - started < settings.inference_timeout_seconds + 120:
            response = client.get("/v1/jobs/" + job_id)
            response.raise_for_status()
            job = response.json()
            if job["stage"] != previous:
                print(json.dumps({"stage": job["stage"], "elapsed": round(time.monotonic()-started)}), flush=True)
                previous = job["stage"]
            if job["status"] in ("succeeded", "failed", "cancelled"):
                report_dir = settings.inference_data_dir / "evaluation"
                report_dir.mkdir(parents=True, exist_ok=True)
                job["evaluation"] = {"elapsedSeconds": time.monotonic()-started, "requestedSeconds": args.seconds,
                                     "humanReview": "pending", "sunoComparison": "not-performed"}
                path = report_dir / (job_id + ".json")
                path.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")
                print(json.dumps({"status": job["status"], "errorCode": job.get("errorCode"), "report": str(path)}, ensure_ascii=False), flush=True)
                if job["status"] != "succeeded":
                    raise SystemExit(1)
                print("Audio: " + str(settings.inference_data_dir.resolve() / "outputs" / job_id / "song.wav"), flush=True)
                return
            time.sleep(5)
        client.post("/v1/jobs/" + job_id + "/cancel")
        raise SystemExit("Evaluation timed out; cancellation requested, no automatic retry.")


if __name__ == "__main__":
    main()
