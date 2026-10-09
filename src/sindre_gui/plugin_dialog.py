"""Simple, dependable plugin administration dialog."""

from PyQt5.QtWidgets import (
    QDialog,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
)

from .plugin_manager import PluginManager, PluginStatus


class PluginManagerDialog(QDialog):
    """Display plugin state and expose load/unload actions."""

    def __init__(self, manager: PluginManager, parent=None) -> None:
        super().__init__(parent)
        self.manager = manager
        self.setWindowTitle("插件管理")
        self.resize(680, 420)
        self.plugins = QListWidget(self)
        self.info = QLabel(self)
        self.info.setWordWrap(True)
        self.load_button = QPushButton("加载", self)
        self.unload_button = QPushButton("卸载", self)
        self.refresh_button = QPushButton("刷新", self)
        buttons = QHBoxLayout()
        buttons.addWidget(self.load_button)
        buttons.addWidget(self.unload_button)
        buttons.addWidget(self.refresh_button)
        layout = QVBoxLayout(self)
        layout.addWidget(self.plugins)
        layout.addWidget(self.info)
        layout.addLayout(buttons)
        self.plugins.currentRowChanged.connect(self._show_info)
        self.load_button.clicked.connect(self._load_selected)
        self.unload_button.clicked.connect(self._unload_selected)
        self.refresh_button.clicked.connect(self.refresh)
        self.refresh()

    def refresh(self) -> None:
        """Refresh the list without unloading active plugins."""
        current = self.plugins.currentItem().data(32) if self.plugins.currentItem() else None
        self.manager.discover()
        self.plugins.clear()
        for record in self.manager.records.values():
            self.plugins.addItem(f"{record.name} [{record.status.value}]")
            self.plugins.item(self.plugins.count() - 1).setData(32, record.name)
        for row in range(self.plugins.count()):
            if self.plugins.item(row).data(32) == current:
                self.plugins.setCurrentRow(row)
                break
        self._show_info(self.plugins.currentRow())

    def _selected_name(self):
        item = self.plugins.currentItem()
        return item.data(32) if item else None

    def _show_info(self, row: int) -> None:
        name = self._selected_name()
        if not name:
            self.info.setText("未发现插件")
            return
        record = self.manager.records[name]
        detail = record.error or record.entry_point.value
        self.info.setText(f"{record.name}\n状态：{record.status.value}\n{detail}")

    def _load_selected(self) -> None:
        name = self._selected_name()
        if not name:
            return
        record = self.manager.load(name)
        self.refresh()
        if record.status is PluginStatus.FAILED:
            QMessageBox.warning(self, "插件加载失败", record.error or "未知错误")

    def _unload_selected(self) -> None:
        name = self._selected_name()
        if name:
            self.manager.unload(name)
            self.refresh()
