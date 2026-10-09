from sindre_gui.plugin_manager import PluginManager


def test_empty_plugin_manager_discovers_without_crashing(qtbot):
    from sindre_gui.plugin_interface import PluginContext

    manager = PluginManager(PluginContext(None, None))
    assert manager.discover() is not None
