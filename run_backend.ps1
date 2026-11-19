# Run DepthWizard Backend
Set-Location -Path $PSScriptRoot

$pythonExe = "C:\Users\Dell\AppData\Local\Programs\Python\Python314\python.exe"

if (Test-Path $pythonExe) {
    Write-Host "Starting DepthWizard backend on http://127.0.0.1:8000 using Python 3.14..." -ForegroundColor Green
    & $pythonExe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
} else {
    Write-Host "Starting DepthWizard backend using system python..." -ForegroundColor Yellow
    python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
}

