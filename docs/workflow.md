# 工作树工作流

`SindreTemplate` 用分支区分模板，用 Git worktree 同时展开多个模板。

```powershell
git worktree add ..\SindreTemplate-pytorch template/pytorch-hydra
git worktree add ..\SindreTemplate-cmake template/cmake
git worktree list
```

删除工作树前先确认其中没有未提交修改：

```powershell
git -C ..\SindreTemplate-pytorch status --short
git worktree remove ..\SindreTemplate-pytorch
```
