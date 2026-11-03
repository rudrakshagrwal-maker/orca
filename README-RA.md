# Orca — local RA fork

<!-- RA: Fork-specific build and maintenance notes. -->

Plain Orca branding, a local desktop workflow with no Orca account required, dark
chrome on pure black, and the built-in **Tango Black** terminal palette by default.
Plugins and their marketplace/safety-list fetches are off by default. Provider
accounts (Claude, Codex, etc.) keep their own sign-in flows; online integrations
still need a connection. Local folders, editing and terminals work offline.

The combined fork also disables telemetry, cloud services, automatic updates and
agent-config hook installation (maintained in the STRIP lane). Agent status uses
OSC 7501 terminal reports.

Windows uses `com.rudraksh.orca`, installs for the current user at
`%LOCALAPPDATA%\Programs\Orca-RA`, and stores its profile at `%APPDATA%\Orca-RA`.
Shortcuts are named Orca inside an **Orca RA** folder. The installer leaves official
Orca's URL handler and document associations alone. No existing profile is copied.

## Build and install

Push the combined changes to `ra`. The **Orca RA Windows** GitHub Action installs
dependencies, typechecks, builds, and publishes the unsigned
`Orca-RA-Setup-<version>.exe` to the `ra-latest` release.

On Windows, with GitHub CLI installed and authenticated, run from the checkout:

```powershell
.\scripts\ra-install.ps1
```

The script downloads the versioned installer, closes only this fork's app process,
installs it for the current user, and creates Start menu and desktop shortcuts.

## Upstream maintenance — every two weeks

On branch `ra`, with a clean working tree and `upstream` pointing at
`https://github.com/stablyai/orca.git`:

```sh
git fetch upstream && git merge upstream/main
```

Resolve conflicts while preserving the short `// RA:` markers (or `RA:` comments
in CSS, YAML and NSIS). Review the local defaults and Windows identity before
pushing `ra`; verify the GitHub Action succeeds before installing `ra-latest`.
