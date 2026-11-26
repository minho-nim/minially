/** 배포용 커밋 식별자와 화면의 앱 버전을 구분한다. */
export function formatAppVersion(version:string):string {
 return /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)?`V.${version}`:'버전 확인 중';
}

/** 'x.y.z' 버전 비교: a가 b보다 새로우면 true(형식이 틀리면 false) */
export function isNewerVersion(a:string,b:string):boolean {
 const p=(v:string)=>/^\d+\.\d+\.\d+$/.test(v)?v.split('.').map(Number):null,x=p(a),y=p(b);
 if(!x||!y)return false;
 for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}
 return false;
}

/** 릴리스 노트(desktop/RELEASE-NOTES.md)에서 '- ' 줄만 바뀐 점으로 뽑는다 */
export function releaseNoteItems(notes:string):string[] {
 return notes.split(/\r?\n/).filter(line=>line.startsWith('- ')).map(line=>line.slice(2).trim()).filter(Boolean).slice(0,8);
}
