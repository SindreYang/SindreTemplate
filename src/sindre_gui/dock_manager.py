"""Small adapter around Qt Advanced Docking System."""

from __future__ import annotations

from PyQt5.QtWidgets import QWidget
from PyQtAds import ads


class DockManager:
    """Own dock widgets and expose a stable API to plugins."""

    def __init__(self, parent: QWidget) -> None:
        ads.CDockManager.setConfigFlag(ads.CDockManager.OpaqueSplitterResize, True)
        ads.CDockManager.setConfigFlag(ads.CDockManager.XmlCompressionEnabled, False)
        ads.CDockManager.setConfigFlag(ads.CDockManager.FocusHighlighting, True)
        self._manager = ads.CDockManager(parent)

    def set_central(self, name: str, widget: QWidget):
        """Set the central widget and return its dock area."""
        dock = ads.CDockWidget(name)
        dock.setWidget(widget)
        area = self._manager.setCentralWidget(dock)
        area.setAllowedAreas(ads.DockWidgetArea.OuterDockAreas)
        return area

    def add(self, name: str, widget: QWidget, direction: str = "Right", area=None):
        """Add a widget and return the owned dock widget."""
        directions = {
            "Left": ads.DockWidgetArea.LeftDockWidgetArea,
            "Right": ads.DockWidgetArea.RightDockWidgetArea,
            "Top": ads.DockWidgetArea.TopDockWidgetArea,
            "Bottom": ads.DockWidgetArea.BottomDockWidgetArea,
        }
        dock = ads.CDockWidget(name)
        dock.setWidget(widget)
        dock.setMinimumSizeHintMode(ads.CDockWidget.MinimumSizeHintFromDockWidget)
        if area is None:
            self._manager.addDockWidget(directions[direction], dock)
        else:
            self._manager.addDockWidget(directions[direction], dock, area)
        return dock

    def save_layout(self, name: str) -> None:
        """Save a named layout perspective."""
        self._manager.addPerspective(name)

    def perspectives(self) -> list[str]:
        """Return saved layout names."""
        return list(self._manager.perspectiveNames())

    def open_layout(self, name: str) -> None:
        """Open a saved layout perspective."""
        self._manager.openPerspective(name)

    def close(self) -> None:
        """Release native docking resources."""
        self._manager.deleteLater()
