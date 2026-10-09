"""命令行入口。"""

from .math import multiply


def main() -> None:
    """运行最小示例。"""
    print(multiply(4, 2))
