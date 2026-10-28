import { RefObject, useEffect, useRef } from 'react';

// Finish retiring the previous modal's history entry before opening its replacement.
let pendingBack: Promise<void> | null = null;
export function useScheduleDialog(open: boolean, panel: boolean, ref: RefObject<HTMLDivElement | null>, close: () => boolean | void, back: () => boolean | void, options: { lockScroll?: boolean; trapFocus?: boolean } = {}) {
  const { lockScroll = true, trapFocus = true } = options;
  const state = useRef({ panel, close, back });
  state.current = { panel, close, back };
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
      if (state.current.panel) { state.current.back(); push(); }
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
        const calendarClose = ref.current?.querySelector<HTMLButtonElement>('[data-date-picker-open] [data-date-close]');
        if (calendarClose) { e.preventDefault(); e.stopPropagation(); calendarClose.click(); return; }
        e.preventDefault(); e.stopPropagation(); if (state.current.panel) state.current.back(); else state.current.close(); }
      if (e.key !== 'Tab' || !trapFocus) return;
      const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    };
    const viewport = window.visualViewport;
    const resize = () => {
      ref.current?.style.setProperty('--modal-height', (viewport?.height ?? innerHeight) + 'px');
      if (ref.current) ref.current.style.top = (viewport?.offsetTop ?? 0) + 'px';
    };
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize);
    window.addEventListener('popstate', pop); document.addEventListener('keydown', key, true);
    return () => {
      disposed = true;
      window.removeEventListener('popstate', pop); document.removeEventListener('keydown', key, true);
      viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize);
      if (lockScroll) document.body.style.overflow = overflow;
      if (active && history.state?.miniallyModal === token) {
        pendingBack = new Promise(resolve => {
          window.addEventListener('popstate', () => { pendingBack = null; resolve(); }, { once: true });
          history.back();
        });
      }
      if (focus?.isConnected) focus.focus({ preventScroll: true });
    };
  }, [open, ref, lockScroll, trapFocus]);
  useEffect(() => { if (panel) ref.current?.querySelector<HTMLElement>('[data-schedule-panel] button')?.focus(); }, [panel, ref]);
}
