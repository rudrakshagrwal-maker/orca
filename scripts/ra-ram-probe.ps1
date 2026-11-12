# RA: measure the complete Orca process group without starting Electron.
[CmdletBinding()]
param([ValidateSet(1, 10)][int]$Tabs = 1)

$ErrorActionPreference = 'Stop'
$orcaProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match '^(Orca|orca-ide|orca-terminal-host|orca-daemon|orcad)(\.exe)?$' -or
    ($_.Name -match '^(node|electron)(\.exe)?$' -and
        $_.CommandLine -match '(?i)([\\/](daemon-entry|daemon-fork-entry)\.(js|cjs)(?:"|\s|$)|[\\/]orcad(?:[\\/][^"\r\n]*?\.(?:js|cjs)|\.exe|\.js)?(?:"|\s|$))')
})
if ($orcaProcesses.Count -eq 0) {
    Write-Output 'No Orca processes found. Open the build before measuring.'
    return
}
$totalBytes = ($orcaProcesses | Measure-Object -Property WorkingSetSize -Sum).Sum
if ($null -eq $totalBytes) { $totalBytes = 0 }
$orcaProcesses | Select-Object ProcessId, Name, @{Name = 'WorkingSetMB'; Expression = {
    [math]::Round([double]$_.WorkingSetSize / 1MB, 2)
}} | Format-Table -AutoSize
Write-Output ('Orca total: {0:N2} MB | processes: {1} | tabs: {2}' -f ($totalBytes / 1MB), $orcaProcesses.Count, $Tabs)
