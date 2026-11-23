# 이전 버전의 updater처럼 /S 없이 --updated로 실행해도 설치창이 뜨지 않아야 한다.
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
$installDir = Join-Path $testRoot 'app'
New-Item -ItemType Directory -Force $testRoot | Out-Null
$oldAppData = $env:APPDATA
$oldLocalAppData = $env:LOCALAPPDATA
try {
  $env:APPDATA = Join-Path $testRoot 'profile'
  $env:LOCALAPPDATA = Join-Path $testRoot 'local'
  New-Item -ItemType Directory -Force $env:APPDATA,$env:LOCALAPPDATA | Out-Null
  $installer = Start-Process -FilePath (Resolve-Path 'desktop-dist/Minially-Setup.exe') -ArgumentList @('--updated','--force-run',"/D=$installDir") -PassThru
  $deadline = (Get-Date).AddMinutes(2)
  $script:visibleInstaller = $false
  do {
    [InstallerWindows]::EnumWindows({param($window,$value)
      if ([InstallerWindows]::IsWindowVisible($window)) {
        [uint32]$ownerId = 0
        [void][InstallerWindows]::GetWindowThreadProcessId($window,[ref]$ownerId)
        $owner = Get-Process -Id $ownerId -ErrorAction SilentlyContinue
        if ($owner -and $owner.ProcessName -like '*Minially-Setup*') { $script:visibleInstaller = $true }
      }
      return $true
    },[IntPtr]::Zero) | Out-Null
    if ((Get-Date) -gt $deadline) { throw '업데이트 설치 시간 초과' }
    Start-Sleep -Milliseconds 50
    $installer.Refresh()
  } while (-not $installer.HasExited)
  if ($script:visibleInstaller) { throw '업데이트 설치 진행창이 표시됐습니다.' }
  if ($installer.ExitCode -ne 0) { throw "설치 실패: $($installer.ExitCode)" }
  if (-not (Test-Path (Join-Path $installDir 'Minially.exe'))) { throw '설치된 앱을 찾을 수 없습니다.' }
  Write-Output '이전 updater 인수(/S 없음)로 설치창 없이 업데이트 설치 성공'
} finally {
  Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($testRoot,[StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue
  $env:APPDATA = $oldAppData
  $env:LOCALAPPDATA = $oldLocalAppData
  Remove-Item $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}
