param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$OutputDirectory = [Environment]::GetFolderPath("Desktop")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
  throw "Project directory not found: $ProjectRoot"
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

$Status = (& git -C $ProjectRoot status --porcelain=v1 --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw "Git status failed." }
if ($Status) { throw "Project archive may only be created from a clean Git worktree." }

$Branch = (& git -C $ProjectRoot branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or -not $Branch) { throw "Current Git branch could not be determined." }
$Commit = (& git -C $ProjectRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $Commit.Length -ne 40) { throw "Full Git commit could not be determined." }
$ShortCommit = (& git -C $ProjectRoot rev-parse --short=7 HEAD).Trim()
$Tree = (& git -C $ProjectRoot rev-parse "HEAD^{tree}").Trim()
if ($LASTEXITCODE -ne 0 -or $Tree.Length -ne 40) { throw "Git tree could not be determined." }

$Tracked = @(& git -C $ProjectRoot ls-files)
if ($LASTEXITCODE -ne 0) { throw "Tracked files could not be determined." }

$ForbiddenTracked = @()
foreach ($Path in $Tracked) {
  $Normalized = $Path -replace '\\','/'
  if (
    $Normalized -match '^(playwright-report|test-results|dist|node_modules|\.git|\.ulc-runtime-dist|supabase/\.temp)(/|$)' -or
    $Normalized -eq 'supabase-local.env' -or
    ($Normalized -match '(^|/)\.env($|\.)' -and $Normalized -notmatch '(^|/)\.env\.example$')
  ) {
    $ForbiddenTracked += $Normalized
  }
}
if ($ForbiddenTracked.Count -gt 0) {
  throw "Unsafe generated/environment files are tracked by Git and would enter the source archive:`n$($ForbiddenTracked -join "`n")"
}

$Stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$Stage = Join-Path $env:TEMP "ULC-Linz-App-Source-$Stamp-$([Guid]::NewGuid().ToString('N'))"
$TempTar = Join-Path $env:TEMP "ULC-Linz-App-Source-$([Guid]::NewGuid().ToString('N')).tar"
$Zip = Join-Path $OutputDirectory "ULC-Linz-App-Aktuell_${Stamp}_${ShortCommit}.zip"

Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $TempTar -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $Zip -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $Stage | Out-Null

try {
  & git -C $ProjectRoot archive --format=tar --output=$TempTar HEAD
  if ($LASTEXITCODE -ne 0) { throw "git archive failed." }

  & tar.exe -xf $TempTar -C $Stage
  if ($LASTEXITCODE -ne 0) { throw "Extraction of git archive failed." }

  $NodeVersion = "unknown"
  $NpmVersion = "unknown"
  try { $NodeVersion = (& node.exe --version).Trim() } catch {}
  try { $NpmVersion = (& npm.cmd --version).Trim() } catch {}

  $Metadata = [ordered]@{
    formatVersion = 1
    project = "ULC Linz App"
    source = "git-archive"
    commit = $Commit
    shortCommit = $ShortCommit
    tree = $Tree
    branch = $Branch
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    node = $NodeVersion
    npm = $NpmVersion
  }
  $MetadataPath = Join-Path $Stage "ULC-SOURCE-METADATA.json"
  $Metadata | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $MetadataPath -Encoding UTF8

  & tar.exe -a -c -f $Zip -C $Stage .
  if ($LASTEXITCODE -ne 0) { throw "ZIP creation failed." }

  Write-Host ""
  Write-Host "Git-based source ZIP successfully created:"
  Write-Host $Zip
  Write-Host "Full commit: $Commit"
  Write-Host "Git tree:    $Tree"
  Write-Host "Metadata:    ULC-SOURCE-METADATA.json"
}
finally {
  Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $TempTar -Force -ErrorAction SilentlyContinue
}
