; RA: Default to a separate per-user folder even when the installer is launched directly.
!macro preInit
  SetRegView 64
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\Orca-RA"
  SetRegView 32
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\Orca-RA"
!macroend

; RA: Keep electron-builder's path-scoped process check, but fail rather than kill by image name.
!include "getProcessInfo.nsh"
Var pid
Var /GLOBAL IsPowerShellAvailable

!macro customCheckAppRunning
  nsExec::Exec `"$PowerShellPath" -NoProfile -NonInteractive -Command "try { Get-CimInstance -ClassName Win32_Process -ErrorAction Stop | Out-Null; exit 37 } catch { exit 1 }"`
  Pop $0
  ${if} $0 != 37
    MessageBox MB_OK|MB_ICONSTOP "Cannot check this installation's running processes. Installation stopped." /SD IDOK
    Abort
  ${endIf}
  StrCpy $IsPowerShellAvailable 0
  !insertmacro _CHECK_APP_RUNNING
!macroend
