$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = "C:\Users\manas\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if (-not (Test-Path $python)) {
  throw "Bundled Python 3.12 was not found at $python. Install Python 3.12 and update this script."
}

if (-not (Test-Path "$root\.venv\Scripts\python.exe")) {
  & $python -m venv "$root\.venv"
}

& "$root\.venv\Scripts\python.exe" -m pip install --upgrade pip
& "$root\.venv\Scripts\python.exe" -m pip install -r "$root\services\api\requirements.txt"
& "C:\Program Files\nodejs\npm.cmd" install --prefix $root

Write-Host ""
Write-Host "Bootstrap complete. Copy .env.example to .env, add API keys, then run:"
Write-Host "  & 'C:\Program Files\nodejs\npm.cmd' run dev"

