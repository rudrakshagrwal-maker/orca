$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $PSScriptRoot 'ra-install.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw "Installer parse errors: $errors" }
# Load only the actual shortcut function, never the download/install entry point.
$definition = $ast.Find({ param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
    $node.Name -eq 'Set-OrcaInstallShortcut'
}, $true)
. ([scriptblock]::Create($definition.Extent.Text))

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('orca-shortcut-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$shell = New-Object -ComObject WScript.Shell
$forkPath = Join-Path $testRoot 'fork\Orca.exe'
$officialPath = Join-Path $testRoot 'official\Orca.exe'
function Assert-Target($Path, $Expected) {
    if (-not (Test-Path -LiteralPath $Path) -or $shell.CreateShortcut($Path).TargetPath -ne $Expected) {
        throw "Wrong shortcut target: $Path"
    }
}
try {
    $plain = Join-Path $testRoot 'plain'
    Set-OrcaInstallShortcut -Shell $shell -Folder $plain -AppPath $forkPath
    Assert-Target (Join-Path $plain 'Orca.lnk') $forkPath
    Set-OrcaInstallShortcut -Shell $shell -Folder $plain -AppPath $forkPath
    if (Test-Path -LiteralPath (Join-Path $plain 'Orca-RA')) { throw 'Fork-only installs must keep plain shortcuts' }

    foreach ($name in @('Orca.lnk', 'Orca\Orca.lnk')) {
        $folder = Join-Path $testRoot ([guid]::NewGuid().ToString('N'))
        $officialShortcut = Join-Path $folder $name
        New-Item -ItemType Directory -Path (Split-Path -Parent $officialShortcut) -Force | Out-Null
        $shortcut = $shell.CreateShortcut($officialShortcut)
        $shortcut.TargetPath = $officialPath
        $shortcut.Save()
        $before = [Convert]::ToBase64String([IO.File]::ReadAllBytes($officialShortcut))
        Set-OrcaInstallShortcut -Shell $shell -Folder $folder -AppPath $forkPath
        Assert-Target $officialShortcut $officialPath
        Assert-Target (Join-Path $folder 'Orca-RA\Orca.lnk') $forkPath
        if ([Convert]::ToBase64String([IO.File]::ReadAllBytes($officialShortcut)) -ne $before) {
            throw 'Official shortcut bytes changed'
        }

        $otherDesktop = Join-Path $testRoot ([guid]::NewGuid().ToString('N'))
        Set-OrcaInstallShortcut -Shell $shell -Folder $otherDesktop -AppPath $forkPath -ShortcutFolders @($folder)
        Assert-Target (Join-Path $otherDesktop 'Orca-RA\Orca.lnk') $forkPath
    }
} finally {
    # Delete only this test's verified temporary directory.
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $tempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($tempParent, [StringComparison]::OrdinalIgnoreCase) -or
        -not ([IO.Path]::GetFileName($resolved)).StartsWith('orca-shortcut-test-')) {
        throw 'Unexpected shortcut test directory'
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
