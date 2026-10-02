@echo off
rem Local launcher for Travel Earth tests: static server on port 8643 + app window.
rem The server runs in a separate minimized window "Travel Earth server" - close it to stop.
cd /d "%~dp0"
set PORT=8643
set URL=http://localhost:%PORT%/

netstat -ano | findstr ":%PORT% " | findstr LISTENING >nul
if errorlevel 1 (
    rem own server: like http.server, plus opening an excursion file in its default editor
    start "Travel Earth server" /min python tools\server.py %PORT%
    timeout /t 1 /nobreak >nul
)

rem desktop shortcuts (local Chrome and Edge): created silently if missing
start "" wscript //nologo "%~dp0install_desktop_shortcut.vbs" /ifmissing

set CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe
set EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
rem "start.bat edge" (or start-edge.bat) opens the app in Edge: its natural online voices
rem read excursions much better than Chrome on Windows 10
if /i "%~1"=="edge" if exist "%EDGE%" (
    start "" "%EDGE%" --app=%URL%
    goto :eof
)
if exist "%CHROME%" (
    start "" "%CHROME%" --profile-directory="Profile 1" --app=%URL%
) else if exist "%EDGE%" (
    start "" "%EDGE%" --app=%URL%
) else (
    start "" %URL%
)
