import os

import pytest
from PyQt5.QtWidgets import QApplication


@pytest.fixture
def qtbot():
    """Minimal Qt fixture without requiring pytest-qt."""
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    app = QApplication.instance() or QApplication([])

    class Bot:
        def addWidget(self, widget):
            widget.close()
            widget.deleteLater()

    yield Bot()
    app.processEvents()
