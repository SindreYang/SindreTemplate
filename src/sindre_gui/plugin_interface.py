"""Plugin contracts and runtime context."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from PyQt5.QtWidgets import QWidget


@dataclass(slots=True)
class PluginContext:
    """Services exposed to a loaded plugin."""

    main_window: QWidget
    add_dock: object


class GuiPlugin(Protocol):
    """Minimal contract implemented by an external GUI plugin."""

    name: str
    version: str
    description: str

    def create_widget(self, context: PluginContext) -> QWidget:
        """Create the plugin's main widget."""

    def on_load(self, context: PluginContext) -> None:
        """Run after the plugin has been registered."""

    def on_unload(self) -> None:
        """Release plugin resources."""
