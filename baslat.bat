@echo off
chcp 65001 >nul
title Evrensel TV ve Uydu Kanal Editoru
cd /d "%~dp0"

echo ============================================================
echo   🛰️ Evrensel TV ve Uydu Kanal Editoru
echo ============================================================
echo.

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Python bulundu, sunucu baslatiliyor...
    python server.py
    goto end
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    echo Python bulundu, sunucu baslatiliyor...
    py server.py
    goto end
)

echo [BILGI] Bilgisayarinizda Python yuklu gorunmuyor.
echo Tarayicida cevrimdisi calisan web surumu aciliyor...
start index.html

:end
pause
