@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 serve.py
  goto end
)
where python >nul 2>nul
if %errorlevel% equ 0 (
  python serve.py
  goto end
)
echo Python 3 is required only for this optional local server.
echo Install from https://www.python.org/downloads/windows/
echo Or deploy the project to GitHub Pages without Python.
:end
pause
