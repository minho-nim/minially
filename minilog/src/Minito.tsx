import { minitoSvg, type MinitoKind, type MinitoPose } from '../../shared/ui/minito';

/** 미니토 캐릭터. SVG는 shared/ui/minito.ts의 고정 도형이라 사용자 입력이 들어가지 않는다. */
export function Minito({ kind, size = 64, pose = 'idle', bounce = false }: { kind: MinitoKind; size?: number; pose?: MinitoPose; bounce?: boolean }) {
  return <span className={`minito${bounce ? ' bounce' : ''}`} dangerouslySetInnerHTML={{ __html: minitoSvg(kind, size, pose) }} />;
}

/** 손글씨 서명 로고: 미니토 + mini + 앱 글자 */
export function Signature({ kind, word, size = 16, minito = 32 }: { kind: MinitoKind; word: string; size?: number; minito?: number }) {
  return (
    <span className="signature" style={{ fontSize: size }} aria-label={`mini${word}`}>
      {minito > 0 && <Minito kind={kind} size={minito} />}
      <span className="mini" aria-hidden="true">mini</span>
      <span className="app" aria-hidden="true">{word}</span>
    </span>
  );
}
