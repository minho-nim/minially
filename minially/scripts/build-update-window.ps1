$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path $compiler)) { throw 'Windows 기본 .NET 컴파일러를 찾을 수 없습니다.' }
$source = (Resolve-Path 'desktop/update/ProgressWindow.cs').Path
$icon = (Resolve-Path 'desktop/build/icon.ico').Path
$resource = (Resolve-Path 'desktop/renderer/desktop-icon.png').Path
$output = Join-Path (Get-Location) 'desktop/build/MiniallyUpdate.exe'
$buildArgs = @('/nologo','/codepage:65001','/target:winexe','/optimize+',"/out:$output","/win32icon:$icon",'/reference:System.Drawing.dll','/reference:System.Windows.Forms.dll',"/resource:$resource,MiniallyIcon",$source)
& $compiler @buildArgs
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $output)) { throw '업데이트 진행 창 빌드 실패' }
