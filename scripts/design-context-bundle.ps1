# Bundles current design context for upload to claude.ai Project.
#
# Output: test-artifacts/design-bundle/<timestamp>/
#   - styles.css         (always)
#   - design-tokens.md   (always)
#   - index.html         (always)
#   - main.js            (only with -IncludeJs)
#   - BUNDLE-README.md   (instructions + git ref, rendered from template)
#   - bundle-summary.json (file sizes + git commit metadata)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/design-context-bundle.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/design-context-bundle.ps1 -IncludeJs
#   powershell -ExecutionPolicy Bypass -File scripts/design-context-bundle.ps1 -IncludeJs -OpenFolder
#
# NOTE: This .ps1 is ASCII-only on purpose. Windows PowerShell 5.1 parses scripts
#       using the system codepage (CP949 on Korean Windows), so non-ASCII text in
#       the script body breaks the parser. Korean copy lives in
#       scripts/design-context-bundle.readme.tmpl.md (read as UTF-8).

[CmdletBinding()]
param(
    [switch]$IncludeJs,
    [switch]$OpenFolder
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
$bundleDir = Join-Path $repoRoot "test-artifacts\design-bundle\$timestamp"
New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null

$alwaysFiles = @("styles.css", "design-tokens.md", "index.html")
$optionalFiles = @()
if ($IncludeJs) { $optionalFiles += "main.js" }

$copied = @()
foreach ($f in ($alwaysFiles + $optionalFiles)) {
    $src = Join-Path $repoRoot $f
    if (-not (Test-Path $src)) {
        Write-Warning "Missing: $f (skipped)"
        continue
    }
    $dst = Join-Path $bundleDir $f
    Copy-Item $src $dst -Force
    $size = (Get-Item $dst).Length
    $copied += [pscustomobject]@{ file = $f; bytes = $size }
}

$gitCommit = ""
$gitBranch = ""
$gitDirty = $false
try {
    $gitCommit = (& git rev-parse --short HEAD).Trim()
    $gitBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
    $status = (& git status --porcelain) | Where-Object { $_ -match "(styles\.css|design-tokens\.md|index\.html|main\.js)" }
    if ($status) { $gitDirty = $true }
} catch {
    Write-Warning "git metadata unavailable: $_"
}

$summary = [pscustomobject]@{
    timestamp = $timestamp
    git = [pscustomobject]@{
        commit = $gitCommit
        branch = $gitBranch
        dirty_design_files = $gitDirty
    }
    include_js = [bool]$IncludeJs
    files = $copied
}
$summaryPath = Join-Path $bundleDir "bundle-summary.json"
$summary | ConvertTo-Json -Depth 4 | Out-File -FilePath $summaryPath -Encoding utf8

# Render README from UTF-8 template.
$tmplPath = Join-Path $PSScriptRoot "design-context-bundle.readme.tmpl.md"
if (-not (Test-Path $tmplPath)) {
    throw "Template not found: $tmplPath"
}
$tmpl = Get-Content -Raw -Path $tmplPath -Encoding UTF8

if ($IncludeJs) {
    $jsLine = "4. ``main.js`` -- JS selector impact check (data attribute selectors: ``[data-view]``, ``[data-result]``, ``[data-score-category]``, etc.)"
} else {
    $jsLine = "> ``main.js`` is not included. Re-run with ``-IncludeJs`` if you need JS selector context."
}

$rendered = $tmpl `
    -replace '\{\{TIMESTAMP\}\}', $timestamp `
    -replace '\{\{GIT_COMMIT\}\}', $gitCommit `
    -replace '\{\{GIT_BRANCH\}\}', $gitBranch `
    -replace '\{\{GIT_DIRTY\}\}', "$gitDirty" `
    -replace '\{\{INCLUDE_JS\}\}', "$([bool]$IncludeJs)" `
    -replace '\{\{JS_LINE\}\}', [System.Text.RegularExpressions.Regex]::Escape($jsLine).Replace('\', '$0')

# The above escape trick is awkward; do simple literal replacement instead.
$rendered = $tmpl.
    Replace('{{TIMESTAMP}}', $timestamp).
    Replace('{{GIT_COMMIT}}', $gitCommit).
    Replace('{{GIT_BRANCH}}', $gitBranch).
    Replace('{{GIT_DIRTY}}', "$gitDirty").
    Replace('{{INCLUDE_JS}}', "$([bool]$IncludeJs)").
    Replace('{{JS_LINE}}', $jsLine)

$readmePath = Join-Path $bundleDir "BUNDLE-README.md"
[System.IO.File]::WriteAllText($readmePath, $rendered, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "Design context bundle created" -ForegroundColor Green
Write-Host "  $bundleDir"
Write-Host ""
Write-Host "Files:"
foreach ($c in $copied) {
    $kb = "{0,7:N1} KB" -f ($c.bytes / 1KB)
    Write-Host ("  {0}  {1}" -f $kb, $c.file)
}
Write-Host ""
if ($gitDirty) {
    Write-Host "WARNING: design files have uncommitted changes -- bundle reflects working tree, not commit $gitCommit." -ForegroundColor Yellow
}
Write-Host "Next: claude.ai Project -> 'Add files' -> drag the files from above directory"

if ($OpenFolder) {
    Start-Process explorer.exe $bundleDir
}
