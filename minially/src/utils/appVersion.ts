/** 배포용 커밋 식별자와 화면의 앱 버전을 구분한다. */
export function formatAppVersion(version:string):string {
 return /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)?`V.${version}`:'버전 확인 중';
}
