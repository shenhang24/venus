$ErrorActionPreference = 'Stop'
$venusRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
try {
    $venusState = Invoke-RestMethod 'http://127.0.0.1:10001/api/state' -TimeoutSec 2
    if ($venusState.root -ne (Join-Path $venusRoot 'data')) { throw '端口上的服务不属于本项目，已取消。' }
    $venusListeners = Get-NetTCPConnection -State Listen -LocalPort 10001 -ErrorAction SilentlyContinue
    foreach ($venusOwner in ($venusListeners.OwningProcess | Select-Object -Unique)) {
        $venusProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$venusOwner"
        if ($venusProcess.Name -ne 'node.exe' -or $venusProcess.CommandLine -notmatch 'src[/\\]server\.mjs') { throw '后台进程身份未确认，已取消。' }
        Stop-Process -Id $venusOwner -ErrorAction Stop
    }
    Start-Sleep -Milliseconds 500
} catch [System.Net.WebException] {}
& (Join-Path $venusRoot 'Start-Venus.ps1')
$venusLoaded = Invoke-RestMethod 'http://127.0.0.1:10001/api/state' -TimeoutSec 3
if (-not $venusLoaded.features.classification) { throw '后台尚未载入新版分类接口。' }
Write-Host '新版 Venus 后台已载入。'
