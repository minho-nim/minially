# 이전 updater의 /S 모드로 실행해도 업데이트 상태 창을 보여 주고 자동 설치한다.
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class InstallerWindows {
  public delegate bool Callback(IntPtr window, IntPtr value);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Callback callback, IntPtr value);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
}
'@
$testRoot = Join-Path $env:RUNNER_TEMP ('minially-install-' + [guid]::NewGuid())
$installDir = Join-Path $testRoot 'Minially'
New-Item -ItemType Directory -Force $testRoot | Out-Null
$oldAppData = $env:APPDATA
$oldLocalAppData = $env:LOCALAPPDATA
try {
  $env:APPDATA = Join-Path $testRoot 'profile'
  $env:LOCALAPPDATA = Join-Path $testRoot 'local'
  New-Item -ItemType Directory -Force $env:APPDATA,$env:LOCALAPPDATA | Out-Null
  $installer = Start-Process -FilePath (Resolve-Path 'desktop-dist/Minially-Setup.exe') -ArgumentList @('--updated','--force-run','/S',"/D=$installDir") -PassThru
  $null = $installer.Handle
  $deadline = (Get-Date).AddMinutes(2)
  $script:visibleInstaller = $false
  $script:updatingTitle = $false
  $elapsed = [Diagnostics.Stopwatch]::StartNew()
  do {
    [InstallerWindows]::EnumWindows({param($window,$value)
      if ([InstallerWindows]::IsWindowVisible($window)) {
        [uint32]$ownerId = 0
        [void][InstallerWindows]::GetWindowThreadProcessId($window,[ref]$ownerId)
        $owner = Get-Process -Id $ownerId -ErrorAction SilentlyContinue
        if ($owner -and $owner.ProcessName -like '*Minially-Setup*') { $script:visibleInstaller = $true; if ($owner.MainWindowTitle -like '*미니어리 업데이트 중*') { $script:updatingTitle = $true } }
      }
      return $true
    },[IntPtr]::Zero) | Out-Null
    if ((Get-Date) -gt $deadline) { throw '업데이트 설치 시간 초과' }
    Start-Sleep -Milliseconds 50
    $installer.Refresh()
  } while (-not $installer.HasExited)
  $installer.WaitForExit()
  if (-not $script:visibleInstaller -or -not $script:updatingTitle) { throw '업데이트 진행 상태 창을 확인하지 못했습니다.' }
  if ($installer.ExitCode -ne 0) { throw "설치 실패: $($installer.ExitCode)" }
  if (-not (Test-Path (Join-Path $installDir 'Minially.exe'))) { throw '설치된 앱을 찾을 수 없습니다.' }
  $relaunchDeadline = (Get-Date).AddSeconds(15)
  do {
    $restarted = Get-Process -Name Minially -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($installDir,[StringComparison]::OrdinalIgnoreCase) }
    if ($restarted) { break }
    if ((Get-Date) -gt $relaunchDeadline) { throw '업데이트 후 앱이 자동으로 열리지 않았습니다.' }
    Start-Sleep -Milliseconds 100
  } while ($true)
  Write-Output ('업데이트 진행 창·자동 설치·앱 다시 열기 통과: ' + $elapsed.ElapsedMilliseconds + 'ms')
} finally {
  if ($installer -and -not $installer.HasExited) { Stop-Process -Id $installer.Id -Force -ErrorAction SilentlyContinue }
  Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($testRoot,[StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue
  $env:APPDATA = $oldAppData
  $env:LOCALAPPDATA = $oldLocalAppData
  Remove-Item $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}
