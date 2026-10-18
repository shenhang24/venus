$ErrorActionPreference = 'Stop'
$venusRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$venusStartMutex = New-Object System.Threading.Mutex($false, 'Local\Venus-10001-Start')
$venusStartAcquired = $false
try {
try { $venusStartAcquired = $venusStartMutex.WaitOne(15000) } catch [System.Threading.AbandonedMutexException] { $venusStartAcquired = $true }
if (-not $venusStartAcquired) { throw 'Venus 正在启动，请稍候。' }
. (Join-Path $venusRoot 'Window-Venus.ps1')
$venusUrl = 'http://127.0.0.1:10001'
$venusReady = $false
try { $venusState = Invoke-RestMethod "$venusUrl/api/ready" -TimeoutSec 15; $venusReady = ($venusState.root -eq (Join-Path $venusRoot 'data')) } catch {}
if (-not $venusReady) {
    if (Get-NetTCPConnection -State Listen -LocalPort 10001 -ErrorAction SilentlyContinue) { throw '端口 10001 已被其他程序使用；未停止任何程序。' }
    $venusNode = (Get-Command node.exe).Source
    Start-Process -FilePath $venusNode -ArgumentList 'src/supervisor.mjs' -WorkingDirectory $venusRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $venusRoot 'evidence/server.log') -RedirectStandardError (Join-Path $venusRoot 'evidence/server-error.log')
    for ($venusAttempt=0; $venusAttempt -lt 30; $venusAttempt++) { Start-Sleep -Milliseconds 300; try { $venusState = Invoke-RestMethod "$venusUrl/api/ready" -TimeoutSec 3; if ($venusState.root -eq (Join-Path $venusRoot 'data')) { $venusReady=$true; break } } catch {} }
}
if (-not $venusReady) { throw 'Venus 启动未确认，请查看 evidence/server-error.log' }
if ([VenusDesktopWindow]::Reuse()) { Write-Output "已复用现有 Venus 窗口：$venusUrl"; return }
$venusWindowUrl = $venusUrl + '/?ui=' + (Get-Item -LiteralPath (Join-Path $venusRoot 'public/app.js')).LastWriteTimeUtc.Ticks
$venusEdgePaths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
$venusEdge = $venusEdgePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($venusEdge) { Start-Process -FilePath $venusEdge -ArgumentList "--app=$venusWindowUrl", '--new-window' -WindowStyle Normal } else { Start-Process $venusWindowUrl }
if ($venusEdge) {
    for ($venusWindowAttempt=0; $venusWindowAttempt -lt 40; $venusWindowAttempt++) {
        Start-Sleep -Milliseconds 150
        if ([VenusDesktopWindow]::Reuse()) { break }
    }
}
Write-Output "Venus 已启动：$venusUrl"
} finally {
    if ($venusStartAcquired) { $venusStartMutex.ReleaseMutex() }
    $venusStartMutex.Dispose()
}
