$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path $compiler)) { throw 'Windows 기본 .NET 컴파일러를 찾을 수 없습니다.' }
& $compiler /nologo /codepage:65001 /target:winexe /optimize+ /out:desktop/build/MiniallyUpdate.exe /win32icon:desktop/build/icon.ico /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /resource:desktop/renderer/desktop-icon.png,MiniallyIcon desktop/update/ProgressWindow.cs
if ($LASTEXITCODE -ne 0) { throw '업데이트 진행 창 빌드 실패' }
