from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT_DIR / "frontend"
DATA_DIR = Path(os.environ.get("WEB_GAME_DATA_DIR", ROOT_DIR / "backend" / "data"))
SCORES_FILE = DATA_DIR / "leaderboard.json"


def read_scores() -> list[dict]:
    if not SCORES_FILE.exists():
        return []
    try:
        data = json.loads(SCORES_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    if not isinstance(data, list):
        return []
    return [entry for entry in data if isinstance(entry, dict)]


def write_scores(scores: list[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SCORES_FILE.write_text(
        json.dumps(scores, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def top_scores(scores: list[dict], limit: int = 25) -> list[dict]:
    return sorted(
        scores,
        key=lambda row: (
            int(row.get("score", 0)),
            int(row.get("kills", 0)),
            int(row.get("rooms", 0)),
        ),
        reverse=True,
    )[:limit]


class GameRequestHandler(SimpleHTTPRequestHandler):
    server_version = "NeuralRun2027/0.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self._json({"ok": True, "service": "neural-run-2027"})
            return
        if path == "/api/scores":
            self._json({"scores": top_scores(read_scores())})
            return
        if path.startswith("/api/"):
            self._json({"error": "not_found"}, HTTPStatus.NOT_FOUND)
            return
        if path == "/" or (FRONTEND_DIR / path.lstrip("/")).exists():
            super().do_GET()
            return
        self.path = "/index.html"
        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/scores":
            self._json({"error": "not_found"}, HTTPStatus.NOT_FOUND)
            return

        try:
            length = min(int(self.headers.get("content-length", "0")), 16_384)
        except ValueError:
            length = 0

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json({"error": "invalid_json"}, HTTPStatus.BAD_REQUEST)
            return

        player = str(payload.get("player", "runner")).strip()[:24] or "runner"
        entry = {
            "player": player,
            "score": clamp_int(payload.get("score"), 0, 999_999),
            "kills": clamp_int(payload.get("kills"), 0, 99_999),
            "rooms": clamp_int(payload.get("rooms"), 0, 99),
            "result": str(payload.get("result", "defeat"))[:16],
            "build": str(payload.get("build", "unknown"))[:120],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        scores = read_scores()
        scores.append(entry)
        write_scores(top_scores(scores, limit=100))
        self._json({"ok": True, "entry": entry, "scores": top_scores(read_scores())})

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def clamp_int(value, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = minimum
    return max(minimum, min(maximum, parsed))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8787, type=int)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), GameRequestHandler)
    url = f"http://{args.host}:{args.port}/"
    print(f"Serving Neural Run 2027 at {url}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
