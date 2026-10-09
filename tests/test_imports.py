def test_public_imports():
    from sindre_gui.app import create_app, run
    from sindre_gui.main_window import MainWindow
    from sindre_gui.plugin_manager import PluginManager

    assert callable(create_app)
    assert callable(run)
    assert MainWindow
    assert PluginManager
