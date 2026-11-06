@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
if not exist build\thesis_manager.exe call scripts\build.bat
if errorlevel 1 exit /b 1
echo 启动后请在浏览器打开 http://127.0.0.1:8080
build\thesis_manager.exe %*
