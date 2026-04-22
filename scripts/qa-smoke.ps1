param(
  [string]$BaseUrl = "http://127.0.0.1:8123",
  [string]$OutputRoot = "test-artifacts/qa-automation",
  [switch]$KeepServerRunning
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Resolve-ExecutablePath {
  param(
    [string]$CommandName,
    [string[]]$Candidates
  )

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command -and $command.Path) {
    return $command.Path
  }

  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  throw "Could not find executable for $CommandName."
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $response
      }
    } catch {}

    Start-Sleep -Milliseconds 750
  }

  throw "Timed out waiting for $Url"
}

function Assert-Condition {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Invoke-BrowserCapture {
  param(
    [string]$BrowserPath,
    [string]$TargetUrl,
    [string]$ArtifactDir,
    [string]$Name,
    [int]$Width,
    [int]$Height
  )

  $screenshotPath = Join-Path $ArtifactDir "$Name.png"
  $stdoutPath = Join-Path $ArtifactDir "$Name.stdout.log"
  $stderrPath = Join-Path $ArtifactDir "$Name.stderr.log"
  $userDataDir = Join-Path $env:TEMP "qa-smoke-$Name-$([guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force -Path $userDataDir | Out-Null

  $arguments = @(
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=4000",
    "--window-size=$Width,$Height",
    "--user-data-dir=$userDataDir",
    "--screenshot=$screenshotPath",
    $TargetUrl
  )

  try {
    $process = Start-Process -FilePath $BrowserPath -ArgumentList $arguments -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru -Wait
    Assert-Condition (Test-Path $screenshotPath) "Screenshot capture failed for $Name."

    Add-Type -AssemblyName System.Drawing
    $image = [System.Drawing.Image]::FromFile((Resolve-Path $screenshotPath))
    $dimensions = @{
      width = $image.Width
      height = $image.Height
    }
    $image.Dispose()

    return @{
      name = $Name
      exitCode = $process.ExitCode
      screenshotPath = $screenshotPath
      width = $dimensions.width
      height = $dimensions.height
      stderrPath = $stderrPath
    }
  } finally {
    if (Test-Path $userDataDir) {
      Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue
    }
  }
}

function Invoke-BrowserDomDump {
  param(
    [string]$BrowserPath,
    [string]$TargetUrl,
    [string]$ArtifactDir
  )

  $domPath = Join-Path $ArtifactDir "home.dom.html"
  $stdoutPath = Join-Path $ArtifactDir "dom.stdout.log"
  $stderrPath = Join-Path $ArtifactDir "dom.stderr.log"
  $arguments = @(
    "--headless=new",
    "--disable-gpu",
    "--virtual-time-budget=3000",
    "--dump-dom",
    $TargetUrl
  )

  $process = Start-Process -FilePath $BrowserPath -ArgumentList $arguments -RedirectStandardOutput $domPath -RedirectStandardError $stderrPath -PassThru -Wait
  Assert-Condition (Test-Path $domPath) "DOM dump was not created."

  $dom = Get-Content $domPath -Raw
  Assert-Condition ($dom -match "<title>LoL Replay Coach Report</title>") "DOM dump is missing the expected title."
  Assert-Condition ($dom -match "LoL Replay Coach") "DOM dump is missing the login title."
  Assert-Condition ($dom -match "Replay Coach Dashboard") "DOM dump is missing the dashboard heading."

  return @{
    exitCode = $process.ExitCode
    domPath = $domPath
    stderrPath = $stderrPath
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$artifactDir = Join-Path $repoRoot $OutputRoot
$artifactDir = Join-Path $artifactDir $runId
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$nodePath = Resolve-ExecutablePath -CommandName "node" -Candidates @(
  "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe",
  "C:\Program Files\nodejs\node.exe",
  "C:\Program Files\AMD\AI_Bundle\LMStudio\resources\app\.webpack\bin\node.exe"
)

$browserPath = Resolve-ExecutablePath -CommandName "chrome" -Candidates @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)

$serverStartedByScript = $false
$serverProcess = $null
$serverStdout = Join-Path $artifactDir "server.stdout.log"
$serverStderr = Join-Path $artifactDir "server.stderr.log"

$summary = [ordered]@{
  runId = $runId
  baseUrl = $BaseUrl
  repoRoot = $repoRoot
  nodePath = $nodePath
  browserPath = $browserPath
  serverStartedByScript = $false
  assertions = @()
  artifacts = [ordered]@{}
}

try {
  $existingServer = $null
  try {
    $existingServer = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 3
  } catch {}

  if ($existingServer) {
    $summary.assertions += "Reused existing server"
  } else {
    $serverProcess = Start-Process -FilePath $nodePath -ArgumentList "server.js" -WorkingDirectory $repoRoot -RedirectStandardOutput $serverStdout -RedirectStandardError $serverStderr -PassThru
    $serverStartedByScript = $true
    $summary.serverStartedByScript = $true
    $summary.assertions += "Started local server"
  }

  $homeResponse = Wait-ForUrl -Url "$BaseUrl/"
  Assert-Condition ($homeResponse.StatusCode -eq 200) "Home page did not return HTTP 200."
  Assert-Condition ($homeResponse.Content -match "<title>LoL Replay Coach Report</title>") "Home page title did not match."
  $summary.assertions += "Home page responded with expected title"

  $samplesResponse = Invoke-RestMethod -Uri "$BaseUrl/api/samples" -Method Get
  Assert-Condition ($null -ne $samplesResponse.samples) "/api/samples did not return a samples array."
  Assert-Condition ($samplesResponse.samples.Count -gt 0) "/api/samples returned no samples."
  $sampleId = $samplesResponse.samples[0].id
  Assert-Condition (-not [string]::IsNullOrWhiteSpace($sampleId)) "First sample is missing an id."
  $summary.assertions += "/api/samples returned at least one sample"
  $summary.artifacts.samplesApi = @{
    sampleCount = $samplesResponse.samples.Count
    firstSampleId = $sampleId
  }

  $sampleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/samples/$sampleId" -Method Get
  Assert-Condition ($sampleResponse.sampleId -eq $sampleId) "Sample detail endpoint returned an unexpected sample id."
  Assert-Condition ($null -ne $sampleResponse.normalized) "Sample detail is missing normalized payload."
  Assert-Condition ($null -ne $sampleResponse.analysis) "Sample detail is missing analysis payload."
  $summary.assertions += "/api/samples/:id returned normalized and analysis payloads"

  $domArtifact = Invoke-BrowserDomDump -BrowserPath $browserPath -TargetUrl "$BaseUrl/" -ArtifactDir $artifactDir
  $summary.artifacts.dom = $domArtifact
  $summary.assertions += "DOM dump contains expected login and dashboard text"

  $screenshots = @(
    Invoke-BrowserCapture -BrowserPath $browserPath -TargetUrl "$BaseUrl/" -ArtifactDir $artifactDir -Name "home-desktop" -Width 1440 -Height 1600
    Invoke-BrowserCapture -BrowserPath $browserPath -TargetUrl "$BaseUrl/" -ArtifactDir $artifactDir -Name "home-tablet" -Width 900 -Height 1400
    Invoke-BrowserCapture -BrowserPath $browserPath -TargetUrl "$BaseUrl/" -ArtifactDir $artifactDir -Name "home-mobile" -Width 430 -Height 1600
  )
  $summary.artifacts.screenshots = $screenshots
  $summary.assertions += "Responsive screenshots captured"

  $summaryPath = Join-Path $artifactDir "summary.json"
  $summary | ConvertTo-Json -Depth 6 | Set-Content -Path $summaryPath

  $reportLines = @(
    "# QA Smoke Report",
    "",
    "- Run: $runId",
    "- Base URL: $BaseUrl",
    "- Node: $nodePath",
    "- Browser: $browserPath",
    "- First sample: $sampleId",
    "",
    "## Assertions",
    ""
  )
  foreach ($assertion in $summary.assertions) {
    $reportLines += "- $assertion"
  }
  $reportLines += ""
  $reportLines += "## Artifacts"
  $reportLines += ""
  $reportLines += "- Summary JSON: $summaryPath"
  $reportLines += "- DOM dump: $($domArtifact.domPath)"
  foreach ($capture in $screenshots) {
    $reportLines += "- Screenshot [$($capture.name)]: $($capture.screenshotPath) ($($capture.width)x$($capture.height))"
  }

  $reportPath = Join-Path $artifactDir "report.md"
  $reportLines | Set-Content -Path $reportPath

  Write-Host "QA smoke passed."
  Write-Host "Artifacts: $artifactDir"
  Write-Host "Report: $reportPath"
} finally {
  if ($serverStartedByScript -and $serverProcess -and -not $KeepServerRunning) {
    try {
      if (-not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
      }
    } catch {}
  }
}
