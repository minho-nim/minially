import { totomSvg, type TotomKind, type TotomPose } from '../../shared/ui/totom';

/** 토톰이 캐릭터. SVG는 shared/ui/totom.ts의 고정 도형이라 사용자 입력이 들어가지 않는다. */
export function Totom({ kind, size = 64, pose = 'idle', bounce = false }: { kind: TotomKind; size?: number; pose?: TotomPose; bounce?: boolean }) {
  return <span className={`totom${bounce ? ' bounce' : ''}`} dangerouslySetInnerHTML={{ __html: totomSvg(kind, size, pose) }} />;
}

/** 손글씨 서명 로고(A안): 토톰이 + mini + 앱 글자 */
export function Signature({ kind, word, size = 16, totom = 32 }: { kind: TotomKind; word: string; size?: number; totom?: number }) {
  return (
    <span className="signature" style={{ fontSize: size }} aria-label={`mini${word}`}>
      {totom > 0 && <Totom kind={kind} size={totom} />}
      <span className="mini" aria-hidden="true">mini</span>
      <span className="app" aria-hidden="true">{word}</span>
    </span>
  );
}
