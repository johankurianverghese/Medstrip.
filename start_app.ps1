# H10 — Medicine Strip Reader Startup Script
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "💊 H10 — Medicine Strip Reader for Low-Literacy Patients" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

Set-Location $PSScriptRoot

$pythonExe = "C:\Users\johan\AppData\Local\Programs\Python\Python311\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
}

$env:PYTHONPATH = "$PSScriptRoot\backend;$PSScriptRoot;$env:PYTHONPATH"

if (-not (Test-Path "backend\medicines.db")) {
    Write-Host "Building SQLite database from dataset..." -ForegroundColor Cyan
    & $pythonExe backend\prepare_data.py
}

Write-Host "Starting Unified FastAPI Fullstack Server on http://localhost:8000..." -ForegroundColor Cyan
Write-Host "Open your browser at: http://localhost:8000" -ForegroundColor Yellow
Start-Process "http://localhost:8000"

& $pythonExe -m uvicorn main:app --app-dir "$PSScriptRoot\backend" --host 0.0.0.0 --port 8000 --reload
