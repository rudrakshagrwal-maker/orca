# RA: Install the manual Windows release without touching agent configurations.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# RA: use the plain shortcut only while it cannot replace another Orca installation.
function Set-OrcaInstallShortcut {
    param($Shell, [string]$Folder, [string]$AppPath, [string[]]$ShortcutFolders = @($Folder))

    if (-not $Folder) {
        throw 'Windows did not provide a Start menu or desktop folder.'
    }
    $shortcutPath = Join-Path $Folder 'Orca.lnk'
    foreach ($existingFolder in $ShortcutFolders) {
        if (-not $existingFolder) { continue }
        foreach ($name in @('Orca.lnk', 'Orca\Orca.lnk')) {
            $candidate = Join-Path $existingFolder $name
            if ((Test-Path -LiteralPath $candidate -PathType Leaf) -and
                $Shell.CreateShortcut($candidate).TargetPath -ne $AppPath) {
                $shortcutPath = Join-Path $Folder 'Orca-RA\Orca.lnk'
            }
        }
    }
    if ((Test-Path -LiteralPath $shortcutPath -PathType Leaf) -and
        $Shell.CreateShortcut($shortcutPath).TargetPath -ne $AppPath) {
        throw "Refusing to overwrite another installation's shortcut: $shortcutPath"
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $shortcutPath) -Force | Out-Null
    $shortcut = $Shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $AppPath
    $shortcut.WorkingDirectory = Split-Path -Parent $AppPath
    $shortcut.IconLocation = "$AppPath,0"
    $shortcut.Save()
    if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
        throw "Could not create shortcut $shortcutPath."
    }
}

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
# RA: expose the native CLI and Git Bash shim for this user, with no admin or agent-config edits.
$binDir = Join-Path $installDir 'resources\bin'
if (-not (Test-Path -LiteralPath (Join-Path $binDir 'orca.exe') -PathType Leaf)) {
    throw "Orca CLI was not installed in $binDir."
}
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$pathEntries = @($userPath -split ';' | Where-Object { $_ })
if (-not ($pathEntries | Where-Object { [Environment]::ExpandEnvironmentVariables($_).Trim().Trim('"').TrimEnd('\') -ieq $binDir.TrimEnd('\') })) {
    [Environment]::SetEnvironmentVariable('Path', (($pathEntries + $binDir) -join ';'), 'User')
}
# RA: the app reopened below must also inherit the new CLI path immediately.
if (-not (($env:Path -split ';') | Where-Object { $_.Trim().Trim('"').TrimEnd('\') -ieq $binDir.TrimEnd('\') })) {
    $env:Path = $env:Path.TrimEnd(';') + ';' + $binDir
}

$shortcutFolders = @(
    [Environment]::GetFolderPath('Programs'),
    [Environment]::GetFolderPath('DesktopDirectory')
)
$existingShortcutFolders = $shortcutFolders + @(
    [Environment]::GetFolderPath('CommonPrograms'),
    [Environment]::GetFolderPath('CommonDesktopDirectory')
)
foreach ($folder in $shortcutFolders) {
    Set-OrcaInstallShortcut -Shell $shell -Folder $folder -AppPath $appPath -ShortcutFolders $existingShortcutFolders
}

Write-Host "Orca installed at $appPath"
# RA: reopen Orca after the silent install so agents reattach without a manual start.
Start-Process -FilePath $appPath
