"""Plugin contracts and the host services exposed to plugins."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from logging import Logger
from typing import Protocol

from PyQt5.QtWidgets import QMainWindow, QWidget

Dock = QWidget
AddDock = Callable[[str, QWidget], Dock]
RemoveDock = Callable[[Dock], None]
Guard = Callable[[Callable], Callable]


@dataclass(frozen=True, slots=True)
class PluginContext:
    """Restricted host services available to one plugin instance."""

    main_window: QMainWindow
    add_dock: AddDock
    remove_dock: RemoveDock
    guard: Guard
    logger: Logger


class GuiPlugin(Protocol):
    """Runtime contract implemented by an external GUI plugin."""

    name: str
    version: str
    description: str

    def create_widget(self, context: PluginContext) -> QWidget:
        """Create the plugin's main widget."""

    def on_load(self, context: PluginContext) -> None:
        """Initialize the plugin and register its UI with the host."""

    def on_unload(self) -> None:
        """Release all plugin-owned resources."""
