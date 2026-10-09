"""Main application window."""

from __future__ import annotations

from PyQt5.QtCore import QSignalBlocker
from PyQt5.QtWidgets import (
    QComboBox,
    QInputDialog,
    QLabel,
    QMainWindow,
    QPlainTextEdit,
    QWidgetAction,
)

from .dock_manager import DockManager
from .plugin_interface import PluginContext
from .plugin_manager import PluginManager
from .ui.generated.mainwindow import Ui_MainWindow


class MainWindow(QMainWindow):
    """Generic dockable host window for PyQt applications."""

    def __init__(self) -> None:
        super().__init__()
        self.ui = Ui_MainWindow()
        self.ui.setupUi(self)
        self.setWindowTitle("SindreGui")
        self.docks = DockManager(self)
        self.docks.set_central("工作区", QPlainTextEdit())
        self._setup_layout_toolbar()
        self.plugin_manager = PluginManager(PluginContext(self, self.add_plugin_dock))
        self.plugin_manager.discover()

    def add_plugin_dock(self, name: str, widget) -> object:
        """Add a plugin widget and expose its visibility in the View menu."""
        area = self.docks.add(name, widget)
        dock = area.currentDockWidget() if hasattr(area, "currentDockWidget") else None
        if dock is not None:
            self.ui.menuView.addAction(dock.toggleViewAction())
        return area

    def _setup_layout_toolbar(self) -> None:
        self._perspectives = QComboBox(self)
        self._perspectives.activated[str].connect(self.docks.open_layout)
        action = QWidgetAction(self)
        action.setDefaultWidget(self._perspectives)
        save = self.ui.toolBar.addAction("保存布局")
        save.triggered.connect(self._save_layout)
        self.ui.toolBar.addWidget(QLabel("布局："))
        self.ui.toolBar.addAction(action)

    def _save_layout(self) -> None:
        name, accepted = QInputDialog.getText(self, "保存布局", "输入布局名称：")
        if not accepted or not name.strip():
            return
        self.docks.save_layout(name.strip())
        with QSignalBlocker(self._perspectives):
            self._perspectives.clear()
            self._perspectives.addItems(self.docks.perspectives())
            self._perspectives.setCurrentText(name.strip())

    def closeEvent(self, event) -> None:
        """Release dock resources before closing the window."""
        self.docks.close()
        super().closeEvent(event)
