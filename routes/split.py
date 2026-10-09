"""Tooth-segmentation upload and result-download endpoints."""

import re
import shutil
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request, send_file, url_for
from werkzeug.utils import secure_filename

from conf.config import split_config


blueprint = Blueprint(
    split_config.name,
    __name__,
    url_prefix=f"/{split_config.name}",
)
ALLOWED_EXTENSIONS = {".ply", ".obj", ".stl"}
ALLOWED_ARTIFACTS = {"ply": "mesh.ply", "obj": "mesh.obj", "mtl": "mesh.obj.mtl"}
JOB_ID_PATTERN = re.compile(r"^[a-f0-9]{32}$")


def _load_inference_backend():
    """Import the heavy model stack only when an inference request arrives."""
    from models.Split_deploy import TeethSeg, export_mtl

    return TeethSeg, export_mtl


def _error(message, status):
    return jsonify(error=message), status


@blueprint.post("")
def segment():
    upload = request.files.get("file")
    if upload is None:
        return _error("Missing required multipart field: file", 400)
    if not upload.filename:
        return _error("Uploaded file has no filename", 400)

    safe_name = secure_filename(upload.filename)
    extension = Path(safe_name).suffix.lower()
    if not safe_name or extension not in ALLOWED_EXTENSIONS:
        return _error("File type must be PLY, OBJ, or STL", 400)

    model_name = request.form.get("model", "").strip()
    models = current_app.config["SPLIT_MODELS"]
    if model_name not in models:
        return _error("Unknown model", 400)

    try:
        constraints = int(request.form.get("constraints", "200000"))
    except (TypeError, ValueError):
        return _error("constraints must be an integer", 400)
    if not 1 <= constraints <= 1_000_000:
        return _error("constraints must be between 1 and 1000000", 400)

    refine_value = request.form.get("refine_switch", "1")
    if refine_value not in {"0", "1"}:
        return _error("refine_switch must be 0 or 1", 400)

    model_path, class_num = models[model_name]
    model_path = Path(model_path)
    if not model_path.is_file():
        return _error(f"Model checkpoint is not installed for '{model_name}'", 503)

    try:
        teeth_seg, export_mtl = current_app.config.get(
            "SPLIT_BACKEND_LOADER", _load_inference_backend
        )()
    except (ImportError, ModuleNotFoundError) as exc:
        current_app.logger.warning("Segmentation backend is unavailable: %s", exc)
        return _error("Segmentation backend dependencies are not installed", 503)

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
        return _error("Segmentation failed; check the server log for details", 500)

    return (
        jsonify(
            job_id=job_id,
            downloads={
                artifact: url_for(
                    "split.download", job_id=job_id, artifact=artifact
                )
                for artifact, filename in ALLOWED_ARTIFACTS.items()
                if (job_dir / filename).is_file()
            },
        ),
        200,
    )


@blueprint.get("/download/<job_id>/<artifact>")
def download(job_id, artifact):
    if not JOB_ID_PATTERN.fullmatch(job_id) or artifact not in ALLOWED_ARTIFACTS:
        return _error("Result not found", 404)

    result_path = (
        Path(current_app.config["SPLIT_CACHE_DIR"])
        / job_id
        / ALLOWED_ARTIFACTS[artifact]
    )
    if not result_path.is_file():
        return _error("Result not found", 404)
    return send_file(result_path, as_attachment=True)
