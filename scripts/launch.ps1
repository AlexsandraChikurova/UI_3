$ErrorActionPreference = 'Stop'
$taskDirectory = Split-Path -Parent $PSScriptRoot
$taskAddress = 'http://127.0.0.1:4175/'
try {
  $taskResponse = Invoke-WebRequest -UseBasicParsing -Uri $taskAddress -TimeoutSec 2
  if ($taskResponse.Content -notmatch 'pug-after-midnight') { throw 'Port 4175 is used by another application.' }
  Start-Process $taskAddress
  exit 0
} catch {
  if ($_.Exception.Message -match 'another application') { Write-Error $_.Exception.Message; exit 1 }
}
$taskNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$taskNode = if ($taskNodeCommand) { $taskNodeCommand.Source } else { $null }
if (-not $taskNode -or -not (Test-Path -LiteralPath $taskNode)) { Write-Host 'Node.js is required. Install Node.js from nodejs.org, then run this file again.'; exit 1 }
$taskLogs = Join-Path $taskDirectory 'logs'
New-Item -ItemType Directory -Force -Path $taskLogs | Out-Null
$taskServerPath = Join-Path $PSScriptRoot 'server.mjs'
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList ('"' + $taskServerPath + '"') -WorkingDirectory $taskDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskLogs 'server.log') -RedirectStandardError (Join-Path $taskLogs 'server-error.log') -PassThru
$taskProcess.Id | Set-Content -LiteralPath (Join-Path $taskLogs 'server.pid')
for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
  Start-Sleep -Milliseconds 250
  try {
    $taskResponse = Invoke-WebRequest -UseBasicParsing -Uri $taskAddress -TimeoutSec 1
    if ($taskResponse.StatusCode -eq 200) { Start-Process $taskAddress; exit 0 }
  } catch {}
  $taskProcess.Refresh()
  if ($taskProcess.HasExited) { Write-Host 'Server could not start. See logs/server-error.log.'; exit 1 }
}
Write-Host 'Server did not respond. See logs/server-error.log.'
exit 1
