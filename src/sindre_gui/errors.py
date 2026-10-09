"""Thread-safe error reporting for the GUI host."""

from __future__ import annotations

import traceback
from dataclasses import dataclass

from PyQt5.QtCore import QObject, pyqtSignal


@dataclass(frozen=True, slots=True)
class PluginError:
    """A user-visible plugin or application failure."""

    plugin: str
    phase: str
    message: str
    traceback_text: str


class ErrorReporter(QObject):
    """Emit failures safely across worker and GUI threads."""

    error_raised = pyqtSignal(object)

    def report(self, plugin: str, phase: str, error: BaseException) -> PluginError:
        """Build and emit an error notification."""
        item = PluginError(plugin, phase, f"{type(error).__name__}: {error}", traceback.format_exc())
        self.error_raised.emit(item)
        return item
