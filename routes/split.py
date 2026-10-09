"""Tooth-segmentation upload and result-download endpoints."""

import re
import shutil
import time
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, current_app, request, send_file, url_for
from werkzeug.utils import secure_filename

from conf.config import split_config
from services.response import error, success

blueprint = Blueprint(
    split_config.name,
    __name__,
    url_prefix=f"/{split_config.name}",
)
ALLOWED_EXTENSIONS = {".ply", ".obj", ".stl"}
ALLOWED_ARTIFACTS = {"ply": "mesh.ply", "obj": "mesh.obj", "mtl": "mesh.obj.mtl"}
JOB_ID_PATTERN = re.compile(r"^[a-f0-9]{32}$")


def cleanup_expired_jobs(cache_dir: str | Path, ttl_seconds: int) -> int:
    """Remove completed job directories older than the configured retention period."""
    root = Path(cache_dir)
    if ttl_seconds <= 0 or not root.exists():
        return 0
    cutoff = time.time() - ttl_seconds
    removed = 0
    for job_dir in root.iterdir():
        try:
            is_expired = job_dir.is_dir() and job_dir.stat().st_mtime < cutoff
        except FileNotFoundError:
            continue
        if not is_expired:
            continue
        shutil.rmtree(job_dir, ignore_errors=True)
        removed += 1
    return removed


def _load_inference_backend():
    """Import the heavy model stack only when an inference request arrives."""
    from models.Split_deploy import TeethSeg, export_mtl

    return TeethSeg, export_mtl


@blueprint.post("")
def segment():
    upload = request.files.get("file")
    if upload is None:
        return error("Missing required multipart field: file", 400, "missing_file")
    if not upload.filename:
        return error("Uploaded file has no filename", 400, "missing_filename")

    safe_name = secure_filename(upload.filename)
    extension = Path(safe_name).suffix.lower()
    if not safe_name or extension not in ALLOWED_EXTENSIONS:
        return error("File type must be PLY, OBJ, or STL", 400, "invalid_file_type")

    model_name = request.form.get("model", "").strip()
    models = current_app.config["SPLIT_MODELS"]
    if model_name not in models:
        return error("Unknown model", 400, "unknown_model")

    try:
        constraints = int(request.form.get("constraints", "200000"))
    except (TypeError, ValueError):
        return error("constraints must be an integer", 400, "invalid_constraints")
    if not 1 <= constraints <= 1_000_000:
        return error("constraints must be between 1 and 1000000", 400, "invalid_constraints")

    refine_value = request.form.get("refine_switch", "1")
    if refine_value not in {"0", "1"}:
        return error("refine_switch must be 0 or 1", 400, "invalid_refine_switch")

    model_path, class_num = models[model_name]
    model_path = Path(model_path)
    if not model_path.is_file():
        return error(f"Model checkpoint is not installed for '{model_name}'", 503, "model_unavailable")

    try:
        teeth_seg, export_mtl = current_app.config.get(
            "SPLIT_BACKEND_LOADER", _load_inference_backend
        )()
    except Exception as exc:
        current_app.logger.exception("Segmentation backend is unavailable: %s", exc)
        return error("Segmentation backend is unavailable", 503, "backend_unavailable")

    job_id = uuid4().hex
    job_dir = Path(current_app.config["SPLIT_CACHE_DIR"]) / job_id
    job_created = False
    try:
        job_dir.mkdir(parents=True, exist_ok=False)
        job_created = True
        input_path = job_dir / f"input{extension}"
        ply_path = job_dir / ALLOWED_ARTIFACTS["ply"]
        obj_path = job_dir / ALLOWED_ARTIFACTS["obj"]
        upload.save(input_path)

        inference = teeth_seg(
            mesh_path=str(input_path),
            model_path=str(model_path),
            class_num=class_num,
            constraints=constraints,
            refine_switch=refine_value == "1",
        )
        inference.test_simple(save_path=str(ply_path), sampled=False)
        export_mtl(import_mesh=str(ply_path), save_mesh=str(obj_path))
        if not ply_path.is_file() or not obj_path.is_file():
            raise RuntimeError("Inference did not create the expected result files")
    except Exception:
        if job_created:
            shutil.rmtree(job_dir, ignore_errors=True)
        current_app.logger.exception("Segmentation job %s failed", job_id)
        return error("Segmentation failed; check the server log for details", 500, "inference_failed")

    return success(
        {
            "job_id": job_id,
            "downloads": {
                artifact: url_for("split.download", job_id=job_id, artifact=artifact)
                for artifact, filename in ALLOWED_ARTIFACTS.items()
                if (job_dir / filename).is_file()
            },
        }
    )


@blueprint.delete("/jobs/<job_id>")
def delete_job(job_id):
    """Allow clients to explicitly release a completed result."""
    if not JOB_ID_PATTERN.fullmatch(job_id):
        return error("Result not found", 404, "result_not_found")
    job_dir = Path(current_app.config["SPLIT_CACHE_DIR"]) / job_id
    if not job_dir.is_dir():
        return error("Result not found", 404, "result_not_found")
    shutil.rmtree(job_dir, ignore_errors=True)
    return success({"job_id": job_id}, "Result deleted")


@blueprint.get("/download/<job_id>/<artifact>")
def download(job_id, artifact):
    if not JOB_ID_PATTERN.fullmatch(job_id) or artifact not in ALLOWED_ARTIFACTS:
        return error("Result not found", 404, "result_not_found")

    result_path = (
        Path(current_app.config["SPLIT_CACHE_DIR"])
        / job_id
        / ALLOWED_ARTIFACTS[artifact]
    )
    if not result_path.is_file():
        return error("Result not found", 404, "result_not_found")
    return send_file(result_path, as_attachment=True)
