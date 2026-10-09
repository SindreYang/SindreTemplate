"""Production-oriented entry-point plugin lifecycle management."""

from __future__ import annotations

import logging
import traceback
from dataclasses import dataclass, field
from enum import Enum
from importlib.metadata import EntryPoint, entry_points

from .plugin_interface import GuiPlugin, PluginContext

LOGGER = logging.getLogger(__name__)


class PluginStatus(str, Enum):
    """States exposed by the plugin manager UI."""

    DISCOVERED = "discovered"
    LOADING = "loading"
    LOADED = "loaded"
    FAILED = "failed"
    UNLOADING = "unloading"
    UNLOADED = "unloaded"


@dataclass(slots=True)
class PluginRecord:
    """State and diagnostics for one plugin entry point."""

    entry_point: EntryPoint
    plugin: GuiPlugin | None = None
    status: PluginStatus = PluginStatus.DISCOVERED
    error: str | None = None
    traceback_text: str | None = None
    docks: list[object] = field(default_factory=list)

    @property
    def name(self) -> str:
        """Return the stable entry-point name."""
        return self.entry_point.name

    @property
    def loaded(self) -> bool:
        """Whether the plugin completed its load lifecycle."""
        return self.status is PluginStatus.LOADED


class PluginManager:
    """Discover, validate, load, and unload GUI plugins safely."""

    GROUP = "sindre_gui.plugins"
    REQUIRED_ATTRIBUTES = ("name", "version", "description")
    REQUIRED_METHODS = ("on_load", "on_unload")

    def __init__(self, context: PluginContext) -> None:
        self.context = context
        self.records: dict[str, PluginRecord] = {}

    def discover(self) -> list[PluginRecord]:
        """Refresh entry points while preserving active plugin instances."""
        discovered = list(entry_points(group=self.GROUP))
        grouped: dict[str, list[EntryPoint]] = {}
        for item in discovered:
            grouped.setdefault(item.name, []).append(item)

        refreshed: dict[str, PluginRecord] = {}
        for name, candidates in grouped.items():
            old = self.records.get(name)
            if len(candidates) > 1:
                if old is not None and old.loaded:
                    self.unload(name)
                record = PluginRecord(candidates[0], status=PluginStatus.FAILED)
                record.error = f"duplicate plugin entry point: {name}"
                refreshed[name] = record
                continue
            if old is not None and old.loaded and old.entry_point.value == candidates[0].value:
                refreshed[name] = old
            else:
                if old is not None and old.loaded:
                    self.unload(name)
                refreshed[name] = PluginRecord(candidates[0])

        for name, old in self.records.items():
            if name not in refreshed and old.loaded:
                self.unload(name)
        self.records = refreshed
        return list(self.records.values())

    def load(self, name: str) -> PluginRecord:
        """Load one plugin with validation and rollback on every failure."""
        record = self._get_record(name)
        if record.loaded:
            return record
        record.status = PluginStatus.LOADING
        record.error = None
        record.traceback_text = None
        instance: GuiPlugin | None = None
        created_docks: list[object] = []

        def add_dock(title: str, widget):
            dock = self.context.add_dock(title, widget)
            created_docks.append(dock)
            return dock

        plugin_context = PluginContext(
            self.context.main_window,
            add_dock,
            self.context.remove_dock,
            self.context.logger,
        )
        try:
            candidate = record.entry_point.load()
            instance = candidate() if isinstance(candidate, type) else candidate
            self._validate(instance)
            instance.on_load(plugin_context)
            record.plugin = instance
            record.docks = created_docks
            record.status = PluginStatus.LOADED
        except Exception as exc:
            record.status = PluginStatus.FAILED
            record.error = f"{type(exc).__name__}: {exc}"
            record.traceback_text = traceback.format_exc()
            LOGGER.exception("Failed to load plugin %s", name)
            if instance is not None:
                self._safe_unload(instance, name)
            for dock in reversed(created_docks):
                self._safe_remove_dock(dock, name)
            record.plugin = None
            record.docks.clear()
        return record

    def unload(self, name: str) -> PluginRecord:
        """Unload a plugin and always release host-owned UI resources."""
        record = self._get_record(name)
        if not record.loaded:
            return record
        record.status = PluginStatus.UNLOADING
        try:
            if record.plugin is not None:
                record.plugin.on_unload()
        except Exception as exc:
            record.error = f"{type(exc).__name__}: {exc}"
            record.traceback_text = traceback.format_exc()
            LOGGER.exception("Failed to unload plugin %s", name)
        finally:
            for dock in reversed(record.docks):
                self._safe_remove_dock(dock, name)
            record.docks.clear()
            record.plugin = None
            record.status = PluginStatus.UNLOADED if record.error is None else PluginStatus.FAILED
        return record

    def loaded_plugins(self) -> list[GuiPlugin]:
        """Return active plugin instances."""
        return [record.plugin for record in self.records.values() if record.loaded and record.plugin]

    def _get_record(self, name: str) -> PluginRecord:
        if name not in self.records:
            raise KeyError(f"unknown plugin: {name}")
        return self.records[name]

    def _validate(self, plugin: object) -> None:
        missing = [item for item in self.REQUIRED_ATTRIBUTES if not getattr(plugin, item, None)]
        missing.extend(item for item in self.REQUIRED_METHODS if not callable(getattr(plugin, item, None)))
        if not callable(getattr(plugin, "create_widget", None)):
            missing.append("create_widget")
        if missing:
            raise TypeError(f"invalid plugin; missing {', '.join(missing)}")

    def _safe_unload(self, plugin: GuiPlugin, name: str) -> None:
        try:
            plugin.on_unload()
        except Exception:
            LOGGER.exception("Plugin cleanup failed after load error: %s", name)

    def _safe_remove_dock(self, dock: object, name: str) -> None:
        try:
            self.context.remove_dock(dock)
        except Exception:
            LOGGER.exception("Failed to remove dock for plugin %s", name)
