"""Entry-point based plugin discovery and lifecycle management."""

from __future__ import annotations

from dataclasses import dataclass
from importlib.metadata import EntryPoint, entry_points

from .plugin_interface import GuiPlugin, PluginContext


@dataclass(slots=True)
class PluginRecord:
    """Runtime state for one discovered plugin."""

    entry_point: EntryPoint
    plugin: GuiPlugin | None = None
    error: str | None = None
    loaded: bool = False


class PluginManager:
    """Discover, load, and unload ``sindre_gui.plugins`` entry points."""

    GROUP = "sindre_gui.plugins"

    def __init__(self, context: PluginContext) -> None:
        self.context = context
        self.records: dict[str, PluginRecord] = {}

    def discover(self) -> list[PluginRecord]:
        """Discover plugins without importing their implementation modules."""
        discovered = entry_points(group=self.GROUP)
        self.records = {item.name: PluginRecord(item) for item in discovered}
        return list(self.records.values())

    def load(self, name: str) -> PluginRecord:
        """Load one plugin and isolate failures to that plugin."""
        record = self.records[name]
        if record.loaded:
            return record
        try:
            candidate = record.entry_point.load()
            plugin = candidate() if callable(candidate) and not hasattr(candidate, "create_widget") else candidate
            plugin.on_load(self.context)
            record.plugin = plugin
            record.loaded = True
            record.error = None
        except Exception as exc:  # noqa: BLE001 - isolate plugin failures from the host
            record.error = f"{type(exc).__name__}: {exc}"
        return record

    def unload(self, name: str) -> None:
        """Unload a plugin if it is currently active."""
        record = self.records[name]
        if record.plugin is not None:
            record.plugin.on_unload()
        record.plugin = None
        record.loaded = False

    def loaded_plugins(self) -> list[GuiPlugin]:
        """Return currently active plugins."""
        return [record.plugin for record in self.records.values() if record.loaded and record.plugin]
