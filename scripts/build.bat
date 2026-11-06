@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
if not exist build mkdir build
where gcc >nul 2>nul
if errorlevel 1 (
  echo 请安装支持 C++17 的 MinGW-w64，并将 bin 目录加入 PATH。
  exit /b 1
)
gcc -O2 -DSQLITE_THREADSAFE=1 -DSQLITE_DQS=0 -c third_party\sqlite3.c -o build\sqlite3.o
if errorlevel 1 exit /b 1
g++ -std=c++17 -O2 -Wall -pthread -finput-charset=UTF-8 -fexec-charset=UTF-8 -Iinclude -Ithird_party src\main.cpp src\app.cpp build\sqlite3.o -lws2_32 -lbcrypt -o build\thesis_manager.exe
if errorlevel 1 exit /b 1
echo 编译成功：build\thesis_manager.exe
