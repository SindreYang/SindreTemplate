"""简单、可直接复制的 HTTP 请求和文件流示例。"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from flask import Blueprint, current_app, request, send_file
from werkzeug.utils import secure_filename

from services.response import error, success

blueprint = Blueprint("examples", __name__, url_prefix="/api/examples")


@blueprint.get("/hello")
def hello():
    """GET 查询参数示例。"""
    name = request.args.get("name", "world").strip() or "world"
    return success({"greeting": f"Hello, {name}!"})


@blueprint.post("/echo")
def echo():
    """POST JSON 参数示例。"""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return error("Request body must be a JSON object", 400, "invalid_json")
    message = payload.get("message")
    if not isinstance(message, str) or not message.strip():
        return error("Field 'message' must be a non-empty string", 400, "invalid_field")
    return success({"message": message.strip()})


def _stream_config(name: str, content_type: str):
    """按配置读取文件并以流响应；文件不存在时返回统一 JSON 错误。"""
    path = Path(current_app.config[name])
    if not path.is_file():
        return error(f"Example file is not configured: {name}", 404, "file_not_found")
    return send_file(path, mimetype=content_type, conditional=True, max_age=0)


@blueprint.get("/image")
def image_stream():
    """GET 图片流示例。通过 ``EXAMPLE_IMAGE_PATH`` 指定图片。"""
    return _stream_config("EXAMPLE_IMAGE_PATH", "image/png")


@blueprint.get("/video")
def video_stream():
    """GET 视频流示例。通过 ``EXAMPLE_VIDEO_PATH`` 指定视频。"""
    return _stream_config("EXAMPLE_VIDEO_PATH", "video/mp4")


@blueprint.post("/file")
def file_stream():
    """POST 文本内容并以附件文件流返回。

    请求体格式为 ``{"filename": "result.txt", "content": "文本"}``，
    内容限制为 10 MiB，文件名会经过安全清理。
    """
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return error("Request body must be a JSON object", 400, "invalid_json")
    content = payload.get("content")
    if not isinstance(content, str):
        return error("Field 'content' must be a string", 400, "invalid_field")
    if len(content.encode("utf-8")) > 10 * 1024 * 1024:
        return error("Field 'content' is too large", 413, "content_too_large")
    filename = secure_filename(str(payload.get("filename", "result.txt"))) or "result.txt"
    return send_file(
        BytesIO(content.encode("utf-8")),
        mimetype="text/plain; charset=utf-8",
        as_attachment=True,
        download_name=filename,
        max_age=0,
    )
