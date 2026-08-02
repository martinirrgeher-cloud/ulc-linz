$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectRoot

$PlaywrightVersion = "1.62.1"
$InstalledPackage = Join-Path $ProjectRoot "node_modules\@playwright\test\package.json"
$NeedsInstall = $true

if (Test-Path -LiteralPath $InstalledPackage) {
    try {
        $InstalledVersion = (Get-Content -LiteralPath $InstalledPackage -Raw | ConvertFrom-Json).version
        $NeedsInstall = $InstalledVersion -ne $PlaywrightVersion
    }
    catch {
        $NeedsInstall = $true
    }
}

if ($NeedsInstall) {
    Write-Host "Installing Playwright Test $PlaywrightVersion without changing package-lock.json..."
    & npm.cmd install --no-save --package-lock=false "@playwright/test@$PlaywrightVersion"
    if ($LASTEXITCODE -ne 0) { throw "Playwright Test installation failed." }
}

Write-Host "Installing Chromium for Playwright..."
& npx.cmd playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "Chromium installation failed." }

$env:VITE_SUPABASE_URL = "https://e2e.supabase.co"
$env:VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e2e_readonly_tests"
$env:VITE_ALLOW_SELF_SIGNUP = "false"
$env:E2E_BASE_URL = "http://127.0.0.1:4173"

Write-Host "Building the application for read-only E2E tests..."
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Application build failed." }

Write-Host "Running read-only mobile E2E tests..."
& npx.cmd playwright test --config=playwright.config.mjs
if ($LASTEXITCODE -ne 0) { throw "Read-only E2E tests failed." }

Write-Host "E1b.1 read-only E2E tests completed successfully."
