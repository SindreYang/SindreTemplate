# 插件开发

插件通过 `sindre_gui.plugins` 入口组发现。

## 最小插件

插件对象需要提供：

- `name`
- `version`
- `description`
- `create_widget(context)`
- `on_load(context)`
- `on_unload()`

在插件的 `pyproject.toml` 中声明：

```toml
[project.entry-points."sindre_gui.plugins"]
hello = "hello_plugin:plugin"
```

安装插件后，主程序启动时会自动发现它。单个插件加载失败不会阻止主程序启动。

插件管理器会记录 `discovered`、`loading`、`loaded`、`failed`、`unloading` 和 `unloaded` 状态。加载异常会保存错误和 traceback，并清理本次加载已经创建的 Dock；卸载异常也不会阻止其余资源清理。

插件不得在 Qt 主线程中执行长时间网络、磁盘或模型初始化。耗时工作应由插件自己放到后台线程，并只在 Qt 主线程更新界面。

插件连接按钮、定时器和其他 Qt 信号时，使用宿主提供的 `guard` 包装回调：

```python
button.clicked.connect(context.guard(self.on_clicked, "button click"))
```

运行期异常会被宿主捕获、记录并提示用户，同时自动卸载失效插件及其 Dock。未使用 `guard` 的第三方 Qt 回调仍会由应用级异常钩子提示，但宿主无法准确归属到具体插件。
