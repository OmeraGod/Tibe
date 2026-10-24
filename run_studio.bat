@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title tibe - Local Video Studio
if exist ".runtime\python\flask\__init__.py" if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
    "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -X utf8 start_studio.py
    goto :end
)
py -3 --version >nul 2>&1
if not errorlevel 1 (set "PYCMD=py -3") else (set "PYCMD=python")
if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Tao moi truong ao Python...
    %PYCMD% -m venv .venv
    if errorlevel 1 goto :fail
)
echo [2/3] Kiem tra / cai dat thu vien...
".venv\Scripts\python.exe" -c "import flask, edge_tts, PIL, concat_audio" >nul 2>&1
if errorlevel 1 ".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :fail
echo [3/3] Khoi dong website: http://127.0.0.1:5050
".venv\Scripts\python.exe" -X utf8 start_studio.py
if errorlevel 1 goto :fail
exit /b 0
:fail
echo Co loi khi chay. Vui long kiem tra Python va ket noi Internet lan dau.
pause
exit /b 1
:end
if errorlevel 1 goto :fail
exit /b 0
