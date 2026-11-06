import { useLayoutEffect, useRef, type RefObject } from 'react';

export function useDaySheetMotion(open: boolean, date: string, expanded: boolean, panel: string | null, overlay: RefObject<HTMLDivElement | null>, surface: RefObject<HTMLElement | null>, composer: RefObject<HTMLElement | null>) {
  const previousHeight = useRef(0);
  useLayoutEffect(() => {
    if (!open || !surface.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cell = document.querySelector<HTMLElement>(`[data-calendar-date="${date}"]`);
    const sheet = surface.current;
    const origin = cell?.getBoundingClientRect(), target = sheet.getBoundingClientRect();
    const x = origin ? origin.x + origin.width / 2 - target.x - target.width / 2 : 0;
    const y = origin ? origin.y + origin.height / 2 - target.y - target.height / 2 : 24;
    const scaleX = origin ? Math.max(0.16, Math.min(0.65, origin.width / target.width)) : 0.96;
    const scaleY = origin ? Math.max(0.16, Math.min(0.65, origin.height / target.height)) : 0.96;
    const animation = sheet.animate([{ transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`, opacity: 0.15 }, { transform: 'translate(0, 0) scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.75,.2,1)' });
    animation.id = 'day-from-date';
    const backdrop = overlay.current?.animate([{ backgroundColor: 'rgba(52,40,35,0)' }, { backgroundColor: 'rgba(52,40,35,.30)' }], { duration: 240, easing: 'ease-out' });
    return () => { animation.cancel(); backdrop?.cancel(); };
  }, [open, date, overlay, surface]);

  useLayoutEffect(() => {
    const element = composer.current;
    if (!open || (!expanded && !panel) || !element) { previousHeight.current = 0; return; }
    const height = element.getBoundingClientRect().height, before = previousHeight.current;
    previousHeight.current = height;
    if (!before || Math.abs(before - height) < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = element.animate([{ height: `${before}px` }, { height: `${height}px` }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' });
    animation.id = 'composer-height';
    return () => animation.cancel();
  }, [open, expanded, panel, composer]);
}
