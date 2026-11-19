@echo off
cd /d "%~dp0"
echo ====================================================
echo Starting DepthWizard FastAPI Backend on port 8000...
echo ====================================================

set "OPENTOPOGRAPHY_API_KEY=ff7885b82b1c3c2f4d6dcff65494b7b4"

REM Check if Python 3.14 installed in AppData exists
set "PY_EXE=C:\Users\Dell\AppData\Local\Programs\Python\Python314\python.exe"
if exist "%PY_EXE%" (
    echo Using Python: %PY_EXE%
    "%PY_EXE%" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
    goto end
)

REM Fallback to python in PATH
echo Using system python...
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

:end
if %ERRORLEVEL% neq 0 (
    echo.
    echo Backend exited with an error.
    pause
)

