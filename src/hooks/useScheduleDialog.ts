import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';

// Finish retiring the previous modal's history entry before opening its replacement.
let pendingBack: Promise<void> | null = null;
export function useScheduleDialog(open: boolean, panel: boolean, ref: RefObject<HTMLDivElement | null>, close: () => boolean | void, back: () => boolean | void, options: { lockScroll?: boolean; trapFocus?: boolean; smoothViewport?: boolean } = {}) {
  const { lockScroll = true, trapFocus = true, smoothViewport = false } = options;
  const state = useRef({ panel, close, back });
  // Event handlers follow committed UI, never an interrupted concurrent render.
  useLayoutEffect(() => { state.current = { panel, close, back }; }, [panel, close, back]);
  useEffect(() => {
    if (!open) return;
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';
    let active = false, disposed = false;
    const token = crypto.randomUUID();
    const push = () => history.pushState({ ...history.state, miniallyModal: token }, '');
    const pop = () => {
      if (!active) return;
      const calendarClose = trapFocus ? ref.current?.querySelector<HTMLButtonElement>('[data-date-picker-open] [data-date-close]') : null;
      if (calendarClose) { calendarClose.click(); push(); return; }
      if (state.current.panel || ref.current?.querySelector('[data-schedule-panel]')) { state.current.back(); push(); }
      else if (state.current.close() === false) push();
      else active = false;
    };
    const start = async () => {
      if (pendingBack) {
        await pendingBack;
        // Promise continuations can run between popstate listeners. Activate only
        // after the retiring event has finished, so it cannot close this dialog.
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
      if (disposed) return;
      push(); active = true;
    };
    void start();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (e.repeat || !ref.current) return;
        const calendarClose = ref.current?.querySelector<HTMLButtonElement>('[data-date-picker-open] [data-date-close]');
        if (calendarClose) { e.preventDefault(); e.stopPropagation(); calendarClose.click(); return; }
        if (state.current.panel || ref.current.querySelector('[data-schedule-panel]')) state.current.back(); else state.current.close(); }
      if (e.key !== 'Tab' || !trapFocus) return;
      const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []).filter(el => el.getClientRects().length && !el.closest('[inert], [aria-hidden="true"]'));
      const first = elements[0], last = elements.at(-1);
      if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    };
    const viewport = window.visualViewport;
    const initialHeight = Math.max(viewport?.height ?? innerHeight, innerHeight);
    let frame = 0;
    let dockAnimation: Animation | undefined;
    const resize = (animate = true) => {
      const element = ref.current;
      if (!element) return;
      const dock = smoothViewport ? element.querySelector<HTMLElement>('[data-keyboard-dock]') : null;
      const previous = dock?.getBoundingClientRect();
      dockAnimation?.cancel();
      const height = viewport?.height ?? innerHeight;
      const editing = element.contains(document.activeElement) && Boolean(document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]'));
      element.dataset.keyboardOpen = String(editing && initialHeight - height > 120);
      element.style.setProperty('--modal-height', height + 'px');
      element.style.top = (viewport?.offsetTop ?? 0) + 'px';
      if (animate && dock && previous && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const delta = previous.bottom - dock.getBoundingClientRect().bottom;
        if (Math.abs(delta) > 1) {
          dockAnimation = dock.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}], {duration:160,easing:'cubic-bezier(.2,.7,.2,1)'});
          dockAnimation.id = 'keyboard-dock';
        }
      }
    };
    const scheduleResize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => resize()); };
    resize(false); viewport?.addEventListener('resize', scheduleResize); viewport?.addEventListener('scroll', scheduleResize);
    ref.current?.addEventListener('focusin', scheduleResize); ref.current?.addEventListener('focusout', scheduleResize);
    window.addEventListener('popstate', pop); document.addEventListener('keydown', key, true);
    return () => {
      disposed = true;
      window.removeEventListener('popstate', pop); document.removeEventListener('keydown', key, true);
      viewport?.removeEventListener('resize', scheduleResize); viewport?.removeEventListener('scroll', scheduleResize);
      ref.current?.removeEventListener('focusin', scheduleResize); ref.current?.removeEventListener('focusout', scheduleResize);
      cancelAnimationFrame(frame); dockAnimation?.cancel();
      if (lockScroll) document.body.style.overflow = overflow;
      if (active && history.state?.miniallyModal === token) {
        pendingBack = new Promise(resolve => {
          window.addEventListener('popstate', () => { pendingBack = null; resolve(); }, { once: true });
          history.back();
        });
      }
      if (focus?.isConnected) focus.focus({ preventScroll: true });
    };
  }, [open, ref, lockScroll, trapFocus, smoothViewport]);
  useEffect(() => { if (panel) ref.current?.querySelector<HTMLElement>('[data-schedule-panel] button')?.focus(); }, [panel, ref]);
}
