import { tomongSvg, type TomongKind, type TomongPose } from '../../shared/ui/tomong';

/** 토몽이 캐릭터. SVG는 shared/ui/tomong.ts의 고정 도형이라 사용자 입력이 들어가지 않는다. */
export function Tomong({ kind, size = 64, pose = 'idle', bounce = false }: { kind: TomongKind; size?: number; pose?: TomongPose; bounce?: boolean }) {
  return <span className={`tomong${bounce ? ' bounce' : ''}`} dangerouslySetInnerHTML={{ __html: tomongSvg(kind, size, pose) }} />;
}

/** 손글씨 서명 로고(A안): 토몽이 + mini + 앱 글자 */
export function Signature({ kind, word, size = 16, tomong = 32 }: { kind: TomongKind; word: string; size?: number; tomong?: number }) {
  return (
    <span className="signature" style={{ fontSize: size }} aria-label={`mini${word}`}>
      {tomong > 0 && <Tomong kind={kind} size={tomong} />}
      <span className="mini" aria-hidden="true">mini</span>
      <span className="app" aria-hidden="true">{word}</span>
    </span>
  );
}
