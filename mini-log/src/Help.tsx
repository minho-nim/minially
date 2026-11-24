import type { ReactNode } from 'react';

/** 한 줄 안내 + ⓘ를 누르면 자세한 설명(화면을 짧게 두려고) */
export function Help({ short, children }: { short: ReactNode; children: ReactNode }) {
  return (
    <details className="help-more">
      <summary className="muted small">{short} <span className="help-i" aria-label="자세히">ⓘ</span></summary>
      <p className="muted small">{children}</p>
    </details>
  );
}
