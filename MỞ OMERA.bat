@echo off
chcp 65001 >nul
cd /d "%~dp0"
title tibe - Omera Studio
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" if exist ".runtime\python\flask\__init__.py" (
  start "" "http://127.0.0.1:5051/omera"
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -X utf8 scripts\serve_omera.py --port 5051
  exit /b
)
if exist ".venv\Scripts\python.exe" (
  start "" "http://127.0.0.1:5051/omera"
  ".venv\Scripts\python.exe" -X utf8 scripts\serve_omera.py --port 5051
  exit /b
)
echo Hay chay MO TIBE.bat de chuan bi Python truoc.
pause
