@echo off
setlocal
if not exist "%~dp0Start-SHL-Operations.ps1" (
  echo ERROR: Start-SHL-Operations.ps1 must be next to this file.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-SHL-Operations.ps1" -Action Start
if errorlevel 1 (
  echo.
  echo Launch failed. Open Docker Desktop, or run the PowerShell script with -Action Logs.
  pause
  exit /b 1
)
endlocal
