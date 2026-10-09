from importlib.metadata import EntryPoint
from logging import getLogger

from sindre_gui.plugin_interface import PluginContext
from sindre_gui.plugin_manager import PluginManager, PluginRecord, PluginStatus


def test_empty_plugin_manager_discovers_without_crashing(qtbot):
    manager = PluginManager(PluginContext(None, lambda *_: None, lambda *_: None, getLogger()))
    assert manager.discover() is not None


class BrokenPlugin:
    name = "Broken"
    version = "1.0"
    description = "test"

    def create_widget(self, context):
        return None

    def on_load(self, context):
        context.add_dock("broken", object())
        raise RuntimeError("boom")

    def on_unload(self):
        pass


class GoodPlugin(BrokenPlugin):
    name = "Good"

    def on_load(self, context):
        context.add_dock("good", object())


def test_load_failure_rolls_back_docks():
    removed = []
    context = PluginContext(None, lambda *_: object(), removed.append, getLogger())
    manager = PluginManager(context)
    manager.records = {
        "broken": PluginRecord(
            EntryPoint("broken", "test_plugin_manager:BrokenPlugin", "sindre_gui.plugins")
        )
    }

    record = manager.load("broken")
    assert record.status is PluginStatus.FAILED
    assert record.traceback_text and "RuntimeError" in record.traceback_text
    assert len(removed) == 1


def test_load_and_unload_releases_docks():
    removed = []
    context = PluginContext(None, lambda *_: object(), removed.append, getLogger())
    manager = PluginManager(context)
    manager.records = {
        "good": PluginRecord(
            EntryPoint("good", "test_plugin_manager:GoodPlugin", "sindre_gui.plugins")
        )
    }

    assert manager.load("good").status is PluginStatus.LOADED
    assert manager.unload("good").status is PluginStatus.UNLOADED
    assert len(removed) == 1
