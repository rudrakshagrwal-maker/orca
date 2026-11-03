# RA: Install the manual Windows release without touching agent configurations.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    throw 'This installer requires Windows.'
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI (gh) must be installed and authenticated.'
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ('orca-ra-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDir | Out-Null
# RA: Download only this fork's versioned installer.
gh release download ra-latest -R rudrakshagrwal-maker/orca -p 'Orca-RA-Setup-*.exe' -D $tempDir --clobber
if ($LASTEXITCODE -ne 0) {
    throw "Installer download failed with exit code $LASTEXITCODE."
}
$installers = @(Get-ChildItem -LiteralPath $tempDir -Filter 'Orca-RA-Setup-*.exe' -File)
if ($installers.Count -ne 1 -or $installers[0].Length -eq 0) {
    throw 'Expected one non-empty Orca installer in the release.'
}

# RA: Stop only this fork and install beside official Orca.
$installDir = Join-Path $env:LOCALAPPDATA 'Programs\Orca-RA'
$appPath = Join-Path $installDir 'Orca.exe'
Get-Process -Name Orca -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $appPath } |
    Stop-Process -Force -ErrorAction Stop
$installer = Start-Process -FilePath $installers[0].FullName -ArgumentList "/S /currentuser /D=$installDir" -WindowStyle Hidden -Wait -PassThru
if ($installer.ExitCode -ne 0) {
    throw "Orca installer failed with exit code $($installer.ExitCode)."
}
$appPath = Join-Path $installDir 'Orca.exe'
if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) {
    throw "Orca executable was not installed at $appPath."
}

$shell = New-Object -ComObject WScript.Shell
foreach ($folder in @(
    [Environment]::GetFolderPath('Programs'),
    [Environment]::GetFolderPath('DesktopDirectory')
)) {
    if (-not $folder) {
        throw 'Windows did not provide a Start menu or desktop folder.'
    }
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    # RA: Keep the visible name Orca inside a separate shortcut folder.
    $shortcutFolder = Join-Path $folder 'Orca RA'
    New-Item -ItemType Directory -Path $shortcutFolder -Force | Out-Null
    $shortcutPath = Join-Path $shortcutFolder 'Orca.lnk'
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $appPath
    $shortcut.WorkingDirectory = $installDir
    $shortcut.IconLocation = "$appPath,0"
    $shortcut.Save()
    if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
        throw "Could not create shortcut $shortcutPath."
    }
}

Write-Host "Orca installed at $appPath"
