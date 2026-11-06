@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

echo ThesisFlow - Visual Studio Launcher v3
if not exist "src\main.cpp" goto wrong_folder
if not exist "src\app.cpp" goto wrong_folder
if not exist "third_party\sqlite3.c" goto wrong_folder
if not exist "database\schema.sql" goto wrong_folder
if not exist "build-msvc" mkdir "build-msvc"
if not exist "build-msvc" goto build_failed

set "THESIS_DIAG=%CD%\build-msvc\toolchain-diagnostic.txt"
> "%THESIS_DIAG%" echo ThesisFlow - Visual Studio Launcher v3
where cl.exe >> "%THESIS_DIAG%" 2>&1
where cl.exe >nul 2>nul
if not errorlevel 1 goto compiler_ready

set "THESIS_VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%THESIS_VSWHERE%" set "THESIS_VSWHERE=%ProgramFiles%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%THESIS_VSWHERE%" goto missing_cpp

"%THESIS_VSWHERE%" -all -products * -format text >> "%THESIS_DIAG%" 2>&1
"%THESIS_VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath > "build-msvc\visual-studio-path.txt"
set "THESIS_VSINSTALL="
set /p "THESIS_VSINSTALL=" < "build-msvc\visual-studio-path.txt"
if not defined THESIS_VSINSTALL goto missing_cpp
if not exist "%THESIS_VSINSTALL%\VC\Auxiliary\Build\vcvars64.bat" goto missing_cpp
call "%THESIS_VSINSTALL%\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 goto missing_cpp
where cl.exe >nul 2>nul
if errorlevel 1 goto missing_cpp

:compiler_ready
cd /d "%~dp0"
echo.
echo [1/3] Compiling SQLite. Please wait...
cl.exe /nologo /TC /O2 /MT /D_CRT_SECURE_NO_WARNINGS /DSQLITE_THREADSAFE=1 /DSQLITE_DQS=0 /c third_party\sqlite3.c /Fobuild-msvc\sqlite3.obj
if errorlevel 1 goto build_failed

echo.
echo [2/3] Compiling the C++17 application. Please wait...
cl.exe /nologo /std:c++17 /EHsc /O2 /MT /utf-8 /Zc:__cplusplus /DNOMINMAX /DWIN32_LEAN_AND_MEAN /D_CRT_SECURE_NO_WARNINGS /Iinclude /Ithird_party src\main.cpp src\app.cpp build-msvc\sqlite3.obj /Fobuild-msvc\ /Febuild-msvc\thesis_manager.exe /link ws2_32.lib bcrypt.lib
if errorlevel 1 goto build_failed

echo.
echo [3/3] Build succeeded. Starting the server...
echo Open this address in your browser: http://127.0.0.1:8080
echo Keep this window open while using the system.
echo Accounts: student01 / teacher01 / admin
echo Demo password: Demo@2026
echo.
build-msvc\thesis_manager.exe --root "%CD%"
if errorlevel 1 goto run_failed
exit /b 0

:wrong_folder
echo.
echo Place Start_Thesis.bat in the original project folder.
echo It must be beside README.md, src, web and third_party.
echo Expected project: D:\szz16\Thesis_Management_CPP
pause
exit /b 1

:missing_cpp
echo.
echo [ERROR] A usable Visual C++ compiler environment was not found.
echo Open Visual Studio Installer, select your VS2022 installation, then choose Modify.
echo Enable the Desktop development with C++ workload.
echo Include the MSVC v143 build tools and a Windows SDK for VS2022.
echo After installation, run this script again.
echo.
echo If those components are already installed, open this Start-menu entry:
echo x64 Native Tools Command Prompt for VS 2022
echo Then run cl to check that the compiler is available.
echo Change to the project folder and run Start_Thesis.bat from that prompt.
echo.
echo Diagnostics: build-msvc\toolchain-diagnostic.txt
pause
exit /b 1

:build_failed
echo.
echo [ERROR] Build failed. Copy the first compiler error above.
echo Include the error code and the complete error text.
pause
exit /b 1

:run_failed
echo.
echo [ERROR] The server stopped. Read the error message above.
echo If port 8080 is in use, run this command from the project folder:
echo build-msvc\thesis_manager.exe --port 8081
echo Then open http://127.0.0.1:8081
pause
exit /b 1
