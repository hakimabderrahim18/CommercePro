@echo off
title Commerce Pro - Reinitialisation du Systeme de Licence
color 0E

echo.
echo ========================================================================
echo     COMMERCE PRO - REINITIALISATION DU SYSTEME DE LICENCE
echo ========================================================================
echo.
echo Ce script va revoquer la licence active sur ce PC et reverrouiller
echo l'application Commerce Pro pour qu'elle redemande une cle d'activation.
echo.
echo ========================================================================
echo.

if /i "%1"=="/y" goto proceed
if /i "%1"=="-y" goto proceed

set /p CONFIRM="Voulez-vous reinitialiser et reverrouiller la licence ? (O/N) : "
if /i not "%CONFIRM%"=="O" if /i not "%CONFIRM%"=="OUI" if /i not "%CONFIRM%"=="Y" if /i not "%CONFIRM%"=="YES" (
    echo.
    echo [ANNULATION] Operation annulee.
    echo.
    pause
    exit /b 0
)

:proceed
echo.
echo [1/3] Fermeture des processus en cours...
taskkill /F /IM CommercePro.exe /T >nul 2>&1
taskkill /F /IM CommercePost.exe /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
ping -n 2 127.0.0.1 >nul

echo [2/3] Suppression des fichiers de licence et verrous...
if exist "%APPDATA%\commercepro\license.lic" del /f /q "%APPDATA%\commercepro\license.lic" >nul 2>&1
if exist "%LOCALAPPDATA%\commercepro\license.lic" del /f /q "%LOCALAPPDATA%\commercepro\license.lic" >nul 2>&1
if exist "%ProgramData%\CommercePro\license.lic" del /f /q "%ProgramData%\CommercePro\license.lic" >nul 2>&1
if exist "%APPDATA%\commercepost\license.lic" del /f /q "%APPDATA%\commercepost\license.lic" >nul 2>&1
if exist "%LOCALAPPDATA%\commercepost\license.lic" del /f /q "%LOCALAPPDATA%\commercepost\license.lic" >nul 2>&1
if exist "%ProgramData%\CommercePost\license.lic" del /f /q "%ProgramData%\CommercePost\license.lic" >nul 2>&1
if exist "%~dp0data\license.lic" del /f /q "%~dp0data\license.lic" >nul 2>&1
if exist "%~dp0license.lic" del /f /q "%~dp0license.lic" >nul 2>&1

echo [3/3] Calcul de la nouvelle empreinte materielle (Machine ID)...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    node -e "try { const { getLicenseStatus } = require('./electron/licensing/licenseManager'); console.log('\n  >> Machine ID de ce PC : ' + getLicenseStatus().machineId + '\n'); } catch (e) {}"
)

echo.
echo ========================================================================
echo   [OK] SYSTEME DE LICENCE REINITIALISE ET VERROUILLE AVEC SUCCES !
echo   Au prochain demarrage, CommercePost affichera la fenetre d'activation.
echo ========================================================================
echo.

if /i "%1"=="/y" goto end
if /i "%1"=="-y" goto end
pause
:end
