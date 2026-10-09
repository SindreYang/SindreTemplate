param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("add", "remove", "list")]
    [string]$Action,
    [Parameter(Position = 1)]
    [string]$Template,
    [Parameter(Position = 2)]
    [string]$Path
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

switch ($Action) {
    "list" {
        git -C $repo worktree list
        break
    }
    "add" {
        if (-not $Template -or -not $Path) {
            throw "add 需要模板名和目标路径，例如：worktree.ps1 add pytorch-hydra ..\SindreTemplate-pytorch"
        }
        git -C $repo worktree add $Path "template/$Template"
        break
    }
    "remove" {
        if (-not $Path) {
            throw "remove 需要目标工作树路径"
        }
        git -C $repo worktree remove $Path
        break
    }
}
