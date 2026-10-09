"""Minimal external plugin example."""

from PyQt5.QtWidgets import QLabel


class HelloPlugin:
    name = "Hello"
    version = "0.1.0"
    description = "A minimal SindreGui plugin."

    def create_widget(self, context):
        return QLabel("Hello from a SindreGui plugin")

    def on_load(self, context) -> None:
        context.add_dock(self.name, self.create_widget(context))

    def on_unload(self) -> None:
        pass


plugin = HelloPlugin()
