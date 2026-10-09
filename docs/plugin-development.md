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
