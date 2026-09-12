"""Minimal HTTP worker implementing Tessera 07 §8.3 around TRELLIS.2.

This is a reference process, not a production model server. When TRELLIS2_WEIGHTS
is unset it returns a tiny placeholder GLB so maintainers can smoke the contract.
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from uuid import uuid4

JOBS: dict[str, dict[str, object]] = {}


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: object) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/v1/capabilities":
            self._json(
                200,
                {
                    "id": "local-worker",
                    "displayName": "TRELLIS.2 worker",
                    "auth": "none",
                    "capabilities": {
                        "textToMesh": True,
                        "imageToMesh": True,
                        "textToTexture": False,
                        "meshToTexture": False,
                        "textToImage": False,
                        "textToEnvironment": False,
                    },
                    "outputLicense": "CC-BY-4.0",
                    "typicalSeconds": {"mesh": 120, "texture": 30},
                    "docsUrl": "https://huggingface.co/microsoft/TRELLIS.2",
                },
            )
            return
        if self.path.startswith("/v1/jobs/") and self.path.endswith("/result"):
            job_id = self.path.split("/")[3]
            job = JOBS.get(job_id)
            if job is None:
                self._json(404, {"error": "not found"})
                return
            self._json(200, {"file": "glb", "kind": "mesh"})
            return
        if self.path.startswith("/v1/jobs/"):
            job_id = self.path.rsplit("/", 1)[-1]
            job = JOBS.get(job_id)
            if job is None:
                self._json(404, {"error": "not found"})
                return
            self._json(200, job)
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/v1/jobs":
            self._json(404, {"error": "not found"})
            return
        job_id = str(uuid4())
        JOBS[job_id] = {"state": "succeeded", "progress": 1, "message": "trellis2 placeholder"}
        self._json(202, {"id": job_id})

    def do_DELETE(self) -> None:  # noqa: N802
        if not self.path.startswith("/v1/jobs/"):
            self._json(404, {"error": "not found"})
            return
        job_id = self.path.rsplit("/", 1)[-1]
        JOBS.pop(job_id, None)
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8090), Handler).serve_forever()
