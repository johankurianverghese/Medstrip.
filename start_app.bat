@echo off
title H10 - Medicine Strip Reader
echo ==========================================================
echo  H10 - Medicine Strip Reader for Low-Literacy Patients
echo ==========================================================

cd /d "%~dp0"
set PYTHON_EXE=C:\Users\johan\AppData\Local\Programs\Python\Python311\python.exe
if not exist "%PYTHON_EXE%" (
    set PYTHON_EXE=python
)

set PYTHONPATH=%~dp0backend;%~dp0;%PYTHONPATH%

if not exist backend\medicines.db (
    echo Building medicines database...
    "%PYTHON_EXE%" backend\prepare_data.py
)

echo Starting Fullstack Server on http://localhost:8000 ...
start http://localhost:8000
"%PYTHON_EXE%" -m uvicorn main:app --app-dir "%~dp0backend" --host 0.0.0.0 --port 8000 --reload
pause
