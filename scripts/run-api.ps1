$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = "$root\.venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  throw "Python environment missing. Run scripts/bootstrap.ps1 first."
}

Set-Location "$root\services\api"
& $python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

