"""统一的 JSON 响应格式。"""

from __future__ import annotations

from typing import Any

from flask import jsonify


def success(data: Any = None, message: str = "ok", status: int = 200, **extra: Any):
    """构造统一成功响应。

    Args:
        data: 返回给客户端的业务数据。
        message: 面向用户的简短说明。
        status: HTTP 状态码。
        **extra: 需要兼容放入响应顶层的扩展字段。

    Returns:
        Flask JSON 响应和 HTTP 状态码。
    """
    body: dict[str, Any] = {"success": True, "message": message, "data": data}
    body.update(extra)
    return jsonify(body), status


def error(
    message: str,
    status: int = 400,
    code: str = "bad_request",
    details: Any = None,
):
    """构造统一错误响应，不向客户端暴露内部异常细节。

    Args:
        message: 面向用户的错误说明。
        status: HTTP 错误状态码。
        code: 稳定的机器可读错误码。
        details: 可选的安全错误细节，不应包含 traceback 或敏感路径。

    Returns:
        Flask JSON 响应和 HTTP 状态码。
    """
    body: dict[str, Any] = {"success": False, "message": message, "code": code}
    if details is not None:
        body["details"] = details
    return jsonify(body), status
