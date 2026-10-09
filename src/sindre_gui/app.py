"""Application bootstrap and command-line entry point."""

from __future__ import annotations

import sys

from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import QApplication

from .main_window import MainWindow


def create_app(argv: list[str] | None = None) -> QApplication:
    """Create and configure the Qt application object."""
    app = QApplication(argv if argv is not None else sys.argv)
    app.setApplicationName("SindreGui")
    app.setOrganizationName("SindreYang")
    app.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    return app


def run() -> int:
    """Start the desktop application and return its exit code."""
    app = create_app()
    window = MainWindow()
    window.show()
    return app.exec_()


if __name__ == "__main__":
    raise SystemExit(run())
