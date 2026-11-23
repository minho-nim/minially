; 업데이트는 별도 선택 단계 없이 진행 상태만 표시하고 앱을 다시 연다.
; 기존 updater의 /S 옵션도 이 창을 표시하도록 전환한다.
!macro customInit
  ${if} ${isUpdated}
    SetSilent normal
  ${endIf}
!macroend

!macro customInstallMode
  ${if} ${isUpdated}
    StrCpy $isForceCurrentInstall "1"
  ${endIf}
!macroend

!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW miniallyUpdateProgress
  Function miniallyUpdateProgress
    ${if} ${isUpdated}
      SendMessage $HWNDPARENT ${WM_SETTEXT} 0 "STR:미니어리 업데이트 중"
      !insertmacro MUI_HEADER_TEXT "미니어리 업데이트 중" "새 버전을 적용하고 있습니다. 완료되면 앱이 자동으로 열립니다."
      GetDlgItem $0 $HWNDPARENT 1
      ShowWindow $0 ${SW_HIDE}
      GetDlgItem $0 $HWNDPARENT 2
      ShowWindow $0 ${SW_HIDE}
      GetDlgItem $0 $HWNDPARENT 3
      ShowWindow $0 ${SW_HIDE}
    ${endIf}
  FunctionEnd
!macroend

!macro customInstall
  ${if} ${isUpdated}
    HideWindow
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "--updated"
    SetErrorLevel 0
    Quit
  ${endIf}
!macroend
