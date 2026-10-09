"""可选 MCP 适配层。

默认使用 stdio，适合 Claude Desktop、Cursor 等本地 MCP 宿主。
也可以通过 ``uv run mcp run mcp_server.py --transport streamable-http`` 启动 HTTP MCP。
"""

from __future__ import annotations

import logging

from mcp.server import MCPServer

from conf.config import app_config

# MCP 的 stdio 通道使用 stdout 传输协议，调试信息必须走 logging/stderr。
logger = logging.getLogger(__name__)
mcp = MCPServer("flask-inference-template", log_level="INFO")


@mcp.tool()
def health() -> dict[str, str]:
    """返回模板服务的健康状态。"""
    return {"status": "ok"}


@mcp.tool()
def echo(message: str) -> dict[str, str]:
    """返回输入消息，用于验证 MCP 连接。

    Args:
        message: 待回显的非空文本。

    Returns:
        包含清理后消息的字典。

    Raises:
        ValueError: 消息为空或只包含空白字符。
    """
    if not message.strip():
        raise ValueError("message must not be empty")
    return {"message": message.strip()}


@mcp.resource("config://service")
def service_config() -> str:
    """提供非敏感的服务配置摘要。"""
    return f"host={app_config.HOST}\nport={app_config.PORT}\n"


if __name__ == "__main__":
    mcp.run()
