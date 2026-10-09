$ErrorActionPreference = "Stop"

$manifest = Join-Path $PSScriptRoot "..\templates.yaml"
if (-not (Test-Path -LiteralPath $manifest)) {
    throw "模板清单不存在：$manifest"
}

Get-Content -LiteralPath $manifest -Encoding UTF8 |
    Where-Object { $_ -match '^  [A-Za-z0-9-]+:' -or $_ -match '^    (branch|language|purpose):' } |
    ForEach-Object { $_ }
