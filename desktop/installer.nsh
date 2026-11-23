; 기존 앱도 --updated로 실행하므로 첫 업데이트부터 설치 마법사를 숨긴다.
; 사용자가 직접 실행한 첫 설치에는 적용하지 않는다.
!macro customInit
  ${if} ${isUpdated}
    SetSilent silent
  ${endIf}
!macroend
