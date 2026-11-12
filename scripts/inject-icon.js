const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const rceditModule = require('rcedit');
const rcedit = rceditModule.rcedit || rceditModule;

async function injectIcon() {
  const iconPath = path.resolve(__dirname, '../assets/icon.ico');
  const iconPngPath = path.resolve(__dirname, '../assets/icon.png');
  const rceditBin = path.resolve(__dirname, '../node_modules/rcedit/bin/rcedit-x64.exe');
  const baseElectronDist = path.resolve(__dirname, '../node_modules/electron/dist/electron.exe');

  // 1. Fermer les processus Commerce Pro / CommercePost / electron en cours pour libérer les fichiers
  try {
    execSync('cmd /c "taskkill /F /IM CommercePro.exe /T 2>nul & taskkill /F /IM CommercePost.exe /T 2>nul & taskkill /F /IM electron.exe /T 2>nul & ping -n 2 127.0.0.1 >nul"', { stdio: 'ignore' });
  } catch (e) {}

  // 2. Patch préventif du binaire base electron.exe dans node_modules
  try {
    if (fs.existsSync(baseElectronDist) && fs.existsSync(rceditBin) && fs.existsSync(iconPath)) {
      execSync(`"${rceditBin}" "${baseElectronDist}" --set-icon "${iconPath}" --set-version-string "FileDescription" "Commerce Pro" --set-version-string "ProductName" "Commerce Pro" --set-version-string "CompanyName" "HA Softwares Academie" --set-version-string "LegalCopyright" "Copyright (C) 2026 HA Softwares Academie"`);
      console.log('✓ Base electron.exe in node_modules patched with custom icon');
    }
  } catch (err) {
    console.warn('Warning patching base electron.exe:', err.message);
  }

  const releaseDirs = [
    path.resolve(__dirname, '../release/win-unpacked'),
    path.resolve('D:/release/win-unpacked')
  ];

  // 3. Renommer electron.exe ou CommercePost.exe en CommercePro.exe
  for (const dir of releaseDirs) {
    if (fs.existsSync(dir)) {
      const electronExe = path.join(dir, 'electron.exe');
      const oldCommerceExe = path.join(dir, 'CommercePost.exe');
      const newCommerceExe = path.join(dir, 'CommercePro.exe');

      const srcExe = fs.existsSync(electronExe) ? electronExe : (fs.existsSync(oldCommerceExe) ? oldCommerceExe : null);

      if (srcExe && srcExe !== newCommerceExe) {
        try {
          if (fs.existsSync(newCommerceExe)) {
            try { fs.unlinkSync(newCommerceExe); } catch (e) {}
          }
          fs.renameSync(srcExe, newCommerceExe);
          console.log(`✓ Successfully renamed ${path.basename(srcExe)} to CommercePro.exe in:`, dir);
        } catch (e) {
          try {
            fs.copyFileSync(srcExe, newCommerceExe);
            try { fs.unlinkSync(srcExe); } catch (e) {}
            console.log(`✓ Successfully copied ${path.basename(srcExe)} to CommercePro.exe in:`, dir);
          } catch (err2) {
            console.warn('Warning renaming exe:', err2.message);
          }
        }
      }
    }
  }

  const exeTargets = [
    path.resolve(__dirname, '../release/win-unpacked/CommercePro.exe'),
    path.resolve('D:/release/win-unpacked/CommercePro.exe')
  ];

  for (const exePath of exeTargets) {
    if (fs.existsSync(exePath)) {
      // 4. Injecter l'icône et les métadonnées directement dans les ressources de CommercePro.exe
      try {
        if (fs.existsSync(iconPath)) {
          if (fs.existsSync(rceditBin)) {
            execSync(`"${rceditBin}" "${exePath}" --set-icon "${iconPath}" --set-version-string "FileDescription" "Commerce Pro" --set-version-string "ProductName" "Commerce Pro" --set-version-string "OriginalFilename" "CommercePro.exe" --set-version-string "InternalName" "CommercePro" --set-version-string "CompanyName" "HA Softwares Academie" --set-version-string "LegalCopyright" "Copyright (C) 2026 HA Softwares Academie"`);
            console.log('✓ Icon and metadata embedded directly into executable:', exePath);
          } else {
            await rcedit(exePath, {
              icon: iconPath,
              'version-string': {
                FileDescription: 'Commerce Pro',
                ProductName: 'Commerce Pro',
                OriginalFilename: 'CommercePro.exe',
                InternalName: 'CommercePro',
                CompanyName: 'HA Softwares Académie',
                LegalCopyright: 'Copyright © 2026 HA Softwares Académie'
              }
            });
            console.log('✓ Icon and metadata embedded directly into executable (via rcedit):', exePath);
          }
        }
      } catch (err) {
        console.warn('Warning: Could not embed icon into', exePath, err.message);
      }

      // 5. Copier les utilitaires et icônes à côté de l'exécutable
      try {
        const targetDir = path.dirname(exePath);
        if (fs.existsSync(iconPath)) {
          fs.copyFileSync(iconPath, path.join(targetDir, 'icon.ico'));
        }
        if (fs.existsSync(iconPngPath)) {
          fs.copyFileSync(iconPngPath, path.join(targetDir, 'icon.png'));
        }
        const cleanBat = path.join(__dirname, '..', 'clean-all-db.bat');
        if (fs.existsSync(cleanBat)) {
          fs.copyFileSync(cleanBat, path.join(targetDir, 'clean-all-db.bat'));
        }
        const shortcutBat = path.join(__dirname, '..', 'create-desktop-shortcut.bat');
        if (fs.existsSync(shortcutBat)) {
          fs.copyFileSync(shortcutBat, path.join(targetDir, 'create-desktop-shortcut.bat'));
        }
        const licenseBat = path.join(__dirname, '..', 'reinitialiser-licence.bat');
        if (fs.existsSync(licenseBat)) {
          fs.copyFileSync(licenseBat, path.join(targetDir, 'reinitialiser-licence.bat'));
        }
        console.log('✓ Icon assets and utility scripts placed next to:', exePath);
      } catch (err) {
        console.warn('Warning: Could not copy icon assets to', exePath, err.message);
      }
    }
  }

  // 6. Mettre à jour le raccourci Bureau vers Commerce Pro.lnk
  try {
    const desktopPath = path.join(process.env.USERPROFILE || 'C:\\Users\\PC', 'Desktop');
    const oldShortcutPath = path.join(desktopPath, 'CommercePost.lnk');
    const newShortcutPath = path.join(desktopPath, 'Commerce Pro.lnk');
    const targetExe = fs.existsSync(exeTargets[0]) ? exeTargets[0] : exeTargets[1];

    if (fs.existsSync(oldShortcutPath)) {
      try { fs.unlinkSync(oldShortcutPath); } catch (e) {}
    }

    if (targetExe && fs.existsSync(targetExe)) {
      const targetDir = path.dirname(targetExe);
      const exeIconIco = path.join(targetDir, 'icon.ico');
      const iconToUse = fs.existsSync(exeIconIco) ? exeIconIco : iconPath;

      const ps1File = path.join(__dirname, '_update_shortcut.ps1');
      const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$sh = New-Object -ComObject WScript.Shell
$s = $sh.CreateShortcut(@'
${newShortcutPath}
'@)
$s.TargetPath = @'
${targetExe}
'@
$s.WorkingDirectory = @'
${targetDir}
'@
$s.IconLocation = @'
${iconToUse},0
'@
$s.Description = 'Commerce Pro - Gestion Commerciale, Stock & SAV'
$s.Save()
`;
      fs.writeFileSync(ps1File, '\uFEFF' + psScript, 'utf8');
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1File}"`);
      try { fs.unlinkSync(ps1File); } catch (e) {}
      console.log('✓ Desktop shortcut updated with custom icon at:', newShortcutPath);
    }
  } catch (err) {
    console.warn('Warning updating shortcut:', err.message);
  }

  // 7. Invalider le cache des icônes de l'Explorateur Windows
  try {
    for (const exePath of exeTargets) {
      if (fs.existsSync(exePath)) {
        try {
          const now = new Date();
          fs.utimesSync(exePath, now, now);
        } catch (e) {}
      }
    }
    execSync('powershell -NoProfile -Command "ie4uinit.exe -show; ie4uinit.exe -ClearIconCache"', { stdio: 'ignore' });
  } catch (e) {}
}

injectIcon().catch(console.error);
