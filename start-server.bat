@echo off
echo ====================================
echo      SYSPAGO - Servidor Local
echo ====================================
echo.
echo Iniciando servidor en puerto 8000...
echo.

:: Intentar Python 3 primero
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Usando Python 3...
    echo Accede desde: http://localhost:8000
    echo Accede desde otras PCs: http://%COMPUTERNAME%:8000
    echo.
    echo Presiona Ctrl+C para detener el servidor
    echo.
    python -m http.server 8000
    goto :end
)

:: Intentar Python 2
python2 --version >nul 2>&1
if %errorlevel% == 0 (
    echo Usando Python 2...
    echo Accede desde: http://localhost:8000
    echo Accede desde otras PCs: http://%COMPUTERNAME%:8000
    echo.
    echo Presiona Ctrl+C para detener el servidor
    echo.
    python2 -m SimpleHTTPServer 8000
    goto :end
)

:: Si no hay Python, mostrar instrucciones
echo ERROR: Python no esta instalado
echo.
echo Opciones:
echo 1. Instala Python desde: https://python.org/downloads
echo 2. O usa Node.js: npx http-server -p 8000
echo.
pause

:end