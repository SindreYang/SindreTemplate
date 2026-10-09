"""Application settings backed by QSettings."""

from PyQt5.QtCore import QSettings


def application_settings() -> QSettings:
    """Return the persistent settings store for the application."""
    return QSettings("SindreYang", "SindreGui")
