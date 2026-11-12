@echo off
title Commerce Pro - Creer Raccourci Bureau
set "DIR=%~dp0"
set "EXE=%DIR%CommercePro.exe"
if not exist "%EXE%" if exist "%DIR%CommercePost.exe" set "EXE=%DIR%CommercePost.exe"
set "LNK=%USERPROFILE%\Desktop\Commerce Pro.lnk"

echo Creation du raccourci sur le Bureau...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%LNK%'); $s.TargetPath = '%EXE%'; $s.WorkingDirectory = '%DIR%'; $s.IconLocation = '%EXE%,0'; $s.Description = 'Commerce Pro - Gestion Commerciale, Stock & SAV'; $s.Save()"

if exist "%LNK%" (
    echo.
    echo [OK] Raccourci cree avec succes sur votre Bureau avec l'icone Commerce Pro !
) else (
    echo.
    echo [ERREUR] Impossible de creer le raccourci sur le Bureau.
)
ping -n 3 127.0.0.1 >nul
