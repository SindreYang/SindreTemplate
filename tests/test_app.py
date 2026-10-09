import io
import os
import tempfile
import time
import unittest
from pathlib import Path

from app import create_app


class FakeTeethSeg:
    def __init__(self, **kwargs):
        self.kwargs = kwargs

    def test_simple(self, save_path, sampled):
        self.save_path = save_path
        Path(save_path).write_bytes(b"ply result")


def fake_export_mtl(import_mesh, save_mesh):
    Path(save_mesh).write_bytes(b"obj result")
    Path(f"{save_mesh}.mtl").write_text("newmtl material\n", encoding="utf-8")


class AppTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.checkpoint = self.root / "model.pt"
        self.checkpoint.write_bytes(b"test checkpoint")
        self.app = create_app(
            {
                "TESTING": True,
                "SPLIT_CACHE_DIR": str(self.root / "cache"),
                "SPLIT_MODELS": {"上颌": (self.checkpoint, 17)},
                "SPLIT_BACKEND_LOADER": lambda: (FakeTeethSeg, fake_export_mtl),
            }
        )
        self.client = self.app.test_client()

    def test_health_check(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok"})

    def test_split_requires_upload(self):
        response = self.client.post("/split", data={"model": "上颌"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("file", response.get_json()["error"])

    def test_split_rejects_bad_model_and_extension(self):
        bad_model = self.client.post(
            "/split",
            data={"model": "missing", "file": (io.BytesIO(b"mesh"), "teeth.ply")},
        )
        bad_extension = self.client.post(
            "/split",
            data={"model": "上颌", "file": (io.BytesIO(b"mesh"), "teeth.txt")},
        )

        self.assertEqual(bad_model.status_code, 400)
        self.assertEqual(bad_extension.status_code, 400)

    def test_split_rejects_invalid_options(self):
        response = self.client.post(
            "/split",
            data={
                "model": "上颌",
                "constraints": "not-a-number",
                "file": (io.BytesIO(b"mesh"), "teeth.ply"),
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("integer", response.get_json()["error"])

    def test_split_requires_checkpoint(self):
        app = create_app(
            {
                "TESTING": True,
                "SPLIT_CACHE_DIR": str(self.root / "unavailable-cache"),
                "SPLIT_MODELS": {"上颌": (self.root / "missing.pt", 17)},
            }
        )
        response = app.test_client().post(
            "/split",
            data={
                "model": "上颌",
                "file": (io.BytesIO(b"mesh"), "teeth.ply"),
            },
        )

        self.assertEqual(response.status_code, 503)
        self.assertFalse((self.root / "unavailable-cache").exists())

    def test_split_saves_safe_unique_job_and_serves_artifacts(self):
        response = self.client.post(
            "/split",
            data={
                "model": "上颌",
                "constraints": "42",
                "refine_switch": "0",
                "file": (io.BytesIO(b"mesh"), "../../teeth.ply"),
            },
        )

        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertEqual(set(body["downloads"]), {"ply", "obj", "mtl"})
        job_dir = self.root / "cache" / body["job_id"]
        self.assertTrue((job_dir / "input.ply").is_file())
        self.assertFalse((self.root / "teeth.ply").exists())

        for artifact, expected in (("ply", b"ply result"), ("obj", b"obj result")):
            result = self.client.get(body["downloads"][artifact])
            try:
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.data, expected)
            finally:
                result.close()

    def test_download_rejects_invalid_paths(self):
        response = self.client.get("/split/download/../../etc/passwd/ply")

        self.assertEqual(response.status_code, 404)

    def test_unknown_routes_return_json(self):
        response = self.client.get("/does-not-exist")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"error": "Resource not found"})

    def test_explicit_delete_releases_job(self):
        response = self.client.post(
            "/split",
            data={
                "model": "上颌",
                "file": (io.BytesIO(b"mesh"), "teeth.ply"),
            },
        )
        job_id = response.get_json()["job_id"]
        job_dir = self.root / "cache" / job_id

        deleted = self.client.delete(f"/split/jobs/{job_id}")

        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(job_dir.exists())

    def test_expired_jobs_are_removed_on_startup(self):
        cache_dir = self.root / "existing-cache"
        expired = cache_dir / ("a" * 32)
        expired.mkdir(parents=True)
        (expired / "mesh.ply").write_bytes(b"old")
        old_time = time.time() - 3600
        os.utime(expired, (old_time, old_time))

        create_app(
            {
                "TESTING": True,
                "SPLIT_CACHE_DIR": str(cache_dir),
                "SPLIT_CACHE_TTL_SECONDS": 60,
            }
        )

        self.assertFalse(expired.exists())


if __name__ == "__main__":
    unittest.main()
