import { useEffect } from 'react';

// 휴대폰 키보드 공통 동작(앱 전체):
// - 글자 입력칸에 포커스가 있을 때(키보드가 열린 상태) 입력 영역 바깥을 터치하면 키보드만 내리고, 그 터치는 아무 동작도 하지 않는다.
// - 키보드가 열린 동안 바깥을 끌어도 화면이 스크롤되지 않는다(창 안에서 실제로 스크롤되는 목록은 그대로).
// 마우스(PC)는 건드리지 않는다.

const TEXT_INPUT = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=button]):not([type=submit]), textarea, [contenteditable="true"]';

function typingElement(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  return active && active.matches(TEXT_INPUT) ? active : null;
}

/** 입력칸이 속한 영역: 간편 입력 시트 → 양식 → 대화상자의 카드 → 없으면 입력칸 자신 */
function scopeOf(active: HTMLElement): Element {
  return active.closest('[data-quick-composer]') ?? active.closest('form') ?? active.closest('[role="dialog"] > *') ?? active;
}

function insideScroller(target: Element | null, stop: Element | null) {
  for (let node = target; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(node).overflowY)) return true;
    if (node === stop) break;
  }
  return false;
}

export function useKeyboardOutsideGuard() {
  useEffect(() => {
    let swallowUntil = 0;
    let blockGesture = false; // 키보드를 내린 그 터치는 끝날 때까지 끌기도 막는다
    const onPointerDown = (event: PointerEvent) => {
      swallowUntil = 0; // 새 터치가 시작되면 이전 표시는 버린다(끌기로 끝나 click이 안 온 경우)
      if (event.pointerType === 'mouse') return;
      const active = typingElement(); const target = event.target as Element | null;
      if (!active || !target) return;
      if (target.closest(TEXT_INPUT)) return; // 다른 입력칸으로 옮기는 것은 그대로
      if (scopeOf(active).contains(target)) return; // 입력 영역 안(등록 단추 등)은 그대로
      event.preventDefault(); event.stopPropagation(); active.blur(); blockGesture = true;
      swallowUntil = Date.now() + 700;
    };
    const swallow = (event: Event) => { if (Date.now() < swallowUntil) { event.preventDefault(); event.stopPropagation(); swallowUntil = 0; } };
    const onTouchMove = (event: TouchEvent) => {
      const active = typingElement(); const target = event.target as Element | null;
      if (!event.cancelable) return;
      if (blockGesture) { event.preventDefault(); return; }
      // 대화상자 바깥의 어두운 부분을 끌면 뒤 화면이 움직이지 않게
      if (target?.matches('[role="dialog"][aria-modal="true"]')) { event.preventDefault(); return; }
      if (!active) return;
      const dialog = active.closest('[role="dialog"]');
      if (insideScroller(target, dialog)) return;
      event.preventDefault();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', swallow, true);
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    const endGesture = () => { blockGesture = false; };
    document.addEventListener('touchend', endGesture, true); document.addEventListener('touchcancel', endGesture, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', swallow, true);
      document.removeEventListener('touchmove', onTouchMove, { capture: true } as EventListenerOptions);
      document.removeEventListener('touchend', endGesture, true); document.removeEventListener('touchcancel', endGesture, true);
    };
  }, []);
}
