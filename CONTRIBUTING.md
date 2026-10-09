# 贡献约定

每个模板使用独立分支开发：

```text
template/pytorch-hydra
template/cmake
template/flask
template/project
```

修改模板前先创建对应工作树，避免在 `main` 分支直接编辑模板源码。提交前
必须从全新克隆目录执行该模板 README 中的验证命令，并确保不包含本机路径、
模型权重、虚拟环境、构建目录或运行日志。
