# One-time setup on Windows (PowerShell): app dependencies, the export helper, and checks.
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Say($m) { Write-Host "`n> $m" -ForegroundColor Yellow }
function Ok($m) { Write-Host "  OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  !   $m" -ForegroundColor DarkYellow }

Say 'Checking Node.js'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20 or newer is required: https://nodejs.org' }
$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 20) { throw "Node.js $major found; version 20 or newer is required." }
Ok "Node.js $(node -v)"

Say 'Installing app dependencies'
npm install
Ok 'npm packages installed'

Say 'Setting up the export helper (Python)'
$py = $null
foreach ($c in @('py -3.13', 'py -3.12', 'py -3.11', 'python')) {
  $exe, $arg = $c.Split(' ')
  if (Get-Command $exe -ErrorAction SilentlyContinue) {
    & $exe $arg -c "import sys; sys.exit(sys.version_info < (3, 11))" 2>$null
    if ($LASTEXITCODE -eq 0) { $py = $c; break }
  }
}
if (-not $py) {
  Warn 'Python 3.11+ not found. The app works, but PDF and MP4 export need it.'
} else {
  $exe, $arg = $py.Split(' ')
  & $exe $arg -m venv server\.venv
  & server\.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
  & server\.venv\Scripts\python.exe -m pip install --quiet -r server\requirements-dev.txt
  Ok 'Export helper installed'
}

Say 'Checking ffmpeg'
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) { Ok 'ffmpeg found' }
else { Warn 'ffmpeg not on PATH; the export helper will use its bundled copy (imageio-ffmpeg).' }

Say 'Done'
Write-Host '  Start the app:  npm run dev'
