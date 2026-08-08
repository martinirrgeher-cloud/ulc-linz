param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$Installer = Join-Path $ProjectRoot "scripts\release\install-overlay.mjs"

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git") -PathType Container)) {
  throw "Git project not found: $ProjectRoot"
}
if (-not (Test-Path -LiteralPath $Installer -PathType Leaf)) {
  throw "ULC overlay installer not found: $Installer"
}
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found in PATH."
}

$Downloads = $null
try {
  $ShellFolders = Get-ItemProperty -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
  $RawDownloads = $ShellFolders.'{374DE290-123F-4565-9164-39C4925E467B}'
  if ($RawDownloads) {
    $Downloads = [Environment]::ExpandEnvironmentVariables($RawDownloads)
  }
} catch {}
if (-not $Downloads) {
  $Downloads = Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads"
}
if (-not (Test-Path -LiteralPath $Downloads -PathType Container)) {
  throw "Downloads folder not found: $Downloads"
}

Write-Host "Downloads: $Downloads"
Write-Host "Searching for applicable ULC update packages..."

$Candidates = @(Get-ChildItem -LiteralPath $Downloads -File -Filter "ULC-Linz-App-UPDATE-*.zip" | Sort-Object LastWriteTime -Descending)
if ($Candidates.Count -eq 0) {
  throw "No ULC-Linz-App-UPDATE-*.zip found in Downloads."
}

$Applicable = @()
foreach ($Candidate in $Candidates) {
  $Probe = Join-Path $env:TEMP "ULC-UPDATE-PROBE-$([Guid]::NewGuid().ToString('N'))"
  try {
    New-Item -ItemType Directory -Path $Probe | Out-Null
    Expand-Archive -LiteralPath $Candidate.FullName -DestinationPath $Probe -Force
    $Manifest = Join-Path $Probe "manifest.json"
    if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf)) { continue }

    & node.exe $Installer --project $ProjectRoot --package-dir $Probe --check-only *> $null
    if ($LASTEXITCODE -eq 0) {
      $Hash = (Get-FileHash -LiteralPath $Candidate.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      $Applicable += [pscustomobject]@{
        File = $Candidate
        Hash = $Hash
      }
    }
  } catch {
    # A broken or unrelated ZIP is intentionally ignored during applicability probing.
  } finally {
    Remove-Item -LiteralPath $Probe -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if ($Applicable.Count -eq 0) {
  $Branch = (& git -C $ProjectRoot branch --show-current).Trim()
  $Head = (& git -C $ProjectRoot rev-parse HEAD).Trim()
  Write-Host ""
  Write-Host "Current branch: $Branch"
  Write-Host "Current HEAD:   $Head"
  throw "No update package in Downloads matches this exact Git state."
}

$UniqueHashes = @($Applicable | Select-Object -ExpandProperty Hash -Unique)
if ($UniqueHashes.Count -ne 1) {
  Write-Host ""
  Write-Host "Multiple different applicable update packages were found:"
  foreach ($Item in $Applicable) {
    Write-Host "- $($Item.File.Name) [$($Item.Hash.Substring(0,12))]"
  }
  throw "Remove obsolete applicable packages from Downloads so the selection is unambiguous."
}

$Selected = @($Applicable | Where-Object { $_.Hash -eq $UniqueHashes[0] } | Sort-Object { $_.File.LastWriteTime } -Descending)[0]
Write-Host ""
Write-Host "Applicable package:"
Write-Host $Selected.File.FullName
Write-Host "SHA-256: $($Selected.Hash)"
if ($Applicable.Count -gt 1) {
  Write-Host "Identical browser-download duplicates were detected; the newest identical copy is used."
}

$Confirmation = Read-Host "Install exactly this package? Type JA"
if ($Confirmation.ToUpperInvariant() -ne "JA") {
  Write-Host "Installation cancelled without changes."
  exit 0
}

$Temp = Join-Path $env:TEMP "ULC-UPDATE-INSTALL-$([Guid]::NewGuid().ToString('N'))"
try {
  New-Item -ItemType Directory -Path $Temp | Out-Null
  Expand-Archive -LiteralPath $Selected.File.FullName -DestinationPath $Temp -Force
  & node.exe $Installer --project $ProjectRoot --package-dir $Temp
  $Code = $LASTEXITCODE
  if ($Code -ne 0) { exit $Code }
}
finally {
  Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
}
