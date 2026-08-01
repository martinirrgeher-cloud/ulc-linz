param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$OutputDirectory = [Environment]::GetFolderPath("Desktop")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
  throw "Project directory not found: $ProjectRoot"
}

$Commit = "no-git"
try {
  $CommitValue = (& git -C $ProjectRoot rev-parse --short HEAD 2>$null)
  if ($LASTEXITCODE -eq 0 -and $CommitValue) {
    $Commit = $CommitValue.Trim()
  }
} catch {
  $Commit = "no-git"
}

$Stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$Stage = Join-Path $env:TEMP "ULC-Linz-App-$Stamp"
$Zip = Join-Path $OutputDirectory "ULC-Linz-App-Aktuell_${Stamp}_${Commit}.zip"

Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $Zip -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $Stage | Out-Null

$ExcludedDirectories = @(
  "node_modules",
  ".git",
  "dist",
  "_patch_backup",
  "_v1",
  ".vercel",
  ".vite",
  "coverage",
  ".supabase"
)

$ExcludedFiles = @(
  ".env",
  ".env.local",
  ".env.development.local",
  ".env.test.local",
  ".env.production.local",
  "apply-patch.ps1",
  "*.log",
  "*.zip",
  "*.tar.gz",
  "*.gpg"
)

$RobocopyArguments = @(
  $ProjectRoot,
  $Stage,
  "/E",
  "/R:1",
  "/W:1",
  "/XD"
) + $ExcludedDirectories + @("/XF") + $ExcludedFiles

& robocopy.exe @RobocopyArguments | Out-Host
if ($LASTEXITCODE -ge 8) {
  throw "Robocopy failed with code $LASTEXITCODE."
}

# Remove every environment file except the safe template.
Get-ChildItem -LiteralPath $Stage -Recurse -Force -File -Filter ".env*" |
  Where-Object { $_.Name -ne ".env.example" } |
  Remove-Item -Force

& tar.exe -a -c -f $Zip -C $Stage .
if ($LASTEXITCODE -ne 0) {
  throw "ZIP creation failed."
}

Remove-Item -LiteralPath $Stage -Recurse -Force

Write-Host ""
Write-Host "ZIP successfully created:"
Write-Host $Zip
