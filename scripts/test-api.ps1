$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = "$root\.venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  throw "Python environment missing. Run scripts/bootstrap.ps1 first."
}

Set-Location "$root\services\api"
$env:DATABASE_URL = "sqlite:///$((Join-Path $env:TEMP 'intervue-tests.db').Replace('\', '/'))"
$env:AUTH_MODE = "local_test"
& $python -m pytest -q
