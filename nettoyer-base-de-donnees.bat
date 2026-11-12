@echo off
title Commerce Pro - Nettoyage Complet de Toutes les Bases de Donnees
color 0B

echo.
echo ========================================================================
echo   COMMERCE PRO - NETTOYAGE COMPLET DE TOUTES LES BASES DE DONNEES (DB)
echo ========================================================================
echo.
echo Ce script va reinitialiser et nettoyer TOUTES les donnees :
echo   - Base de donnees de production : %APPDATA%\commercepro\data\commercepost.db
echo   - Base de donnees locale projet : %~dp0data\commercepost.db
echo   - Historique des ventes, reparations, mouvements, stocks et dettes.
echo.
echo Les 3 comptes par defaut (admin, reparateur, vendeur) et les caisses
echo seront recrees automatiquement et prets pour la production.
echo.
echo ========================================================================
echo.

if /i "%1"=="/y" goto proceed
if /i "%1"=="-y" goto proceed

set /p CONFIRM="Etes-vous sur de vouloir nettoyer toutes les bases ? (O/N) : "
if /i not "%CONFIRM%"=="O" if /i not "%CONFIRM%"=="OUI" if /i not "%CONFIRM%"=="Y" if /i not "%CONFIRM%"=="YES" (
    echo.
    echo [ANNULATION] Nettoyage annule. Aucune donnee modifiee.
    echo.
    pause
    exit /b 0
)

:proceed
echo.
echo [1/4] Fermeture des processus Commerce Pro en cours...
taskkill /F /IM CommercePro.exe /T >nul 2>&1
taskkill /F /IM CommercePost.exe /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
ping -n 2 127.0.0.1 >nul

echo [2/4] Suppression des journaux temporaires SQLite (WAL, SHM, TMP)...
if exist "%APPDATA%\commercepro\data\commercepost.db-wal" del /f /q "%APPDATA%\commercepro\data\commercepost.db-wal" >nul 2>&1
if exist "%APPDATA%\commercepro\data\commercepost.db-shm" del /f /q "%APPDATA%\commercepro\data\commercepost.db-shm" >nul 2>&1
if exist "%APPDATA%\commercepost\data\commercepost.db-wal" del /f /q "%APPDATA%\commercepost\data\commercepost.db-wal" >nul 2>&1
if exist "%APPDATA%\commercepost\data\commercepost.db-shm" del /f /q "%APPDATA%\commercepost\data\commercepost.db-shm" >nul 2>&1
if exist "%~dp0data\commercepost.db-wal" del /f /q "%~dp0data\commercepost.db-wal" >nul 2>&1
if exist "%~dp0data\commercepost.db-shm" del /f /q "%~dp0data\commercepost.db-shm" >nul 2>&1
if exist "%~dp0data\license.lic" del /f /q "%~dp0data\license.lic" >nul 2>&1
if exist "%~dp0data\machine_id.txt" del /f /q "%~dp0data\machine_id.txt" >nul 2>&1

echo [3/4] Nettoyage et reinitialisation des tables SQLite...
cd /d "%~dp0"

where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if exist "scripts\clean-db.js" (
        node scripts\clean-db.js
        goto finish
    )
)

echo Nettoyage direct des fichiers de base de donnees...
if exist "%APPDATA%\commercepost\data\commercepost.db" del /f /q "%APPDATA%\commercepost\data\commercepost.db"
if exist "%~dp0data\commercepost.db" del /f /q "%~dp0data\commercepost.db"
echo Fichiers supprimes avec succes. Les bases seront recreees a blanc au lancement.

:finish
echo.
echo [4/4] Operation terminee avec succes !
echo.
echo ========================================================================
echo   [OK] TOUTES LES BASES DE DONNEES ONT ETE NETTOYEES ET REINITIALISEES !
echo   L'application est prete a etre lancee a blanc.
echo ========================================================================
echo.
if /i "%1"=="/y" goto end
if /i "%1"=="-y" goto end
pause
:end
