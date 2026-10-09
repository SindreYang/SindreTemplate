def test_main_window_can_be_created(qtbot):
    from sindre_gui.main_window import MainWindow

    window = MainWindow()
    qtbot.addWidget(window)
    assert window.windowTitle() == "SindreGui"
