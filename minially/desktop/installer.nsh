; 기본 설치 화면 대신 미니어리 테마의 독립 진행 창을 띄운다.
!macro customInit
  ${if} ${isUpdated}
    SetSilent silent
    InitPluginsDir
    File /oname=$PLUGINSDIR\MiniallyUpdate.exe "${BUILD_RESOURCES_DIR}\MiniallyUpdate.exe"
    System::Call 'kernel32::GetCurrentProcessId() i .r0'
    Exec '"$PLUGINSDIR\MiniallyUpdate.exe" "$0" "${VERSION}"'
  ${endIf}
!macroend

!macro customInstall
  ${if} ${isUpdated}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "--updated"
    SetErrorLevel 0
    Quit
  ${endIf}
!macroend
