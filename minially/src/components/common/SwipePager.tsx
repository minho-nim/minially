import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent, type CSSProperties } from 'react';

interface Props {
  pageKey: string;
  children: ReactNode;
  previous: ReactNode;
  next: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
  gap?: number;
  autoHeight?: boolean;
  minimumHeight?: number;
  /** 앞뒤 페이지를 쉬는 틈에 미리 그려 둔다(무거운 달력 같은 화면만) */
  preload?: boolean;
  className?: string;
  'data-calendar-swipe'?: boolean;
  'data-task-swipe'?: boolean;
  'data-import-swipe'?: boolean;
}

export function SwipePager({ pageKey, children, previous, next, onPrevious, onNext, disabled = false, gap = 0, autoHeight = false, minimumHeight = 160, preload = false, className = '', ...attributes }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const panes = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const measure = useRef<() => void>(() => {});
  const [height, setHeight] = useState(minimumHeight);
  const gesture = useRef<{ id: number; x: number; y: number; time: number; horizontal: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreClickUntil = useRef(0);
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'dragging' | 'settling'>('idle');
  // 앞뒤 페이지는 화면이 쉬는 틈에 미리 그려 둔다(밀기 시작할 때 그리면 첫 움직임이 끊긴다)
  const [preloaded, setPreloaded] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    measure.current = () => {
      if (!autoHeight) return;
      const current = Math.max(minimumHeight, panes[1].current?.getBoundingClientRect().height || 0);
      const neighbor = Math.max(minimumHeight, panes[offset < 0 ? 2 : 0].current?.getBoundingClientRect().height || 0);
      const progress = Math.min(1, Math.abs(offset) / ((root.current?.clientWidth || 1) + gap));
      setHeight(current + (neighbor - current) * progress);
    };
    measure.current();
  });
  useLayoutEffect(() => {
    if (!autoHeight) return;
    const observer = new ResizeObserver(() => measure.current());
    panes.forEach(pane => { if (pane.current) observer.observe(pane.current); });
    return () => observer.disconnect();
  }, [autoHeight]);
  const reset = () => { if (timer.current) clearTimeout(timer.current); pending.current = null; gesture.current = null; setOffset(0); setPhase('idle'); };
  useLayoutEffect(() => {
    // 넘김을 끝내자마자 시작한 새 밀기는 살려 둔다(연달아 넘기기)
    const fresh = gesture.current && Date.now() - gesture.current.time < 1000 ? gesture.current : null;
    reset();
    gesture.current = fresh;
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [pageKey, disabled]);
  useEffect(() => {
    // 처음 한 번만 쉬는 틈을 기다렸다가 켠다(이후엔 앞뒤 페이지가 늘 그려져 있다)
    if (!preload) return;
    if ('requestIdleCallback' in window) { const id = window.requestIdleCallback(() => setPreloaded(true), { timeout: 400 }); return () => window.cancelIdleCallback(id); }
    const id = setTimeout(() => setPreloaded(true), 120);
    return () => clearTimeout(id);
  }, [preload]);
  const settle = (direction: -1 | 0 | 1, velocity = 0) => {
    const width = root.current?.clientWidth || 1;
    setPhase('settling');
    setOffset(direction * -(width + gap));
    // 빠르게 튕기면 더 빨리 넘어간다
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.round(Math.max(140, Math.min(240, 240 - velocity * 60)));
    durationRef.current = duration;
    const finish = () => {
      if (direction < 0) onPrevious();
      if (direction > 0) onNext();
      reset();
    };
    pending.current = finish;
    timer.current = setTimeout(finish, duration);
  };
  const durationRef = useRef(220);
  const cancel = () => { gesture.current = null; if (phase === 'dragging') settle(0); };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) { cancel(); return; }
    // 넘어가는 중에 다시 밀면 지금 넘김을 바로 끝내고 새 밀기를 받는다(연달아 넘기기)
    if (phase === 'settling' && pending.current) { if (timer.current) clearTimeout(timer.current); pending.current(); }
    else if (phase !== 'idle') { ignoreClickUntil.current = Date.now() + 500; return; }
    ignoreClickUntil.current = 0;
    gesture.current = null;
    if (disabled || event.pointerType !== 'touch' || (event.target as Element).closest('button, a, input, textarea, select, [contenteditable="true"], [data-no-swipe]')) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: Date.now(), horizontal: false };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    if (!start || event.pointerId !== start.id) return;
    const x = event.clientX - start.x, y = event.clientY - start.y;
    if (!start.horizontal) {
      if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x) * 1.2) { gesture.current = null; return; }
      if (Math.abs(x) < 8 || Math.abs(x) < Math.abs(y) * 1.1) return;
      start.horizontal = true;
      try { (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId); } catch { /* 이미 놓은 손가락 */ }
      setPhase('dragging');
    }
    const width = root.current?.clientWidth || 1;
    setOffset(Math.max(-width - gap, Math.min(width + gap, x)));
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || event.pointerId !== start.id || !start.horizontal) return;
    event.preventDefault();
    ignoreClickUntil.current = Date.now() + 500;
    const x = event.clientX - start.x, width = root.current?.clientWidth || 1;
    const velocity = Math.abs(x) / Math.max(1, Date.now() - start.time);
    const commit = !disabled && (Math.abs(x) >= Math.min(64, width * 0.18) || (Math.abs(x) > 20 && velocity > 0.3));
    settle(commit ? x < 0 ? 1 : -1 : 0, velocity);
  };
  return <div {...attributes} ref={root} data-swipe-phase={phase} className={'relative min-w-0 overflow-hidden ' + className} style={{ touchAction: 'pan-y pinch-zoom', height: autoHeight ? height : undefined, transition: autoHeight && phase !== 'dragging' ? 'height 220ms cubic-bezier(.22,.68,0,1)' : undefined }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onClickCapture={event => { if (Date.now() < ignoreClickUntil.current) { event.preventDefault(); event.stopPropagation(); } }}>
    <div data-swipe-track className={autoHeight ? 'absolute top-0 left-0 flex w-full items-start' : 'flex h-full min-h-0 w-full'} style={{ columnGap: gap, transform: `translate3d(calc(-100% - ${gap}px + ${offset}px), 0, 0)`, transition: phase === 'settling' ? `transform ${durationRef.current}ms cubic-bezier(.22,.68,0,1)` : 'none', willChange: phase === 'idle' ? undefined : 'transform' } as CSSProperties}>
      <div ref={panes[0]} aria-hidden="true" inert className={'flex min-h-0 w-full shrink-0 flex-col' + (autoHeight ? '' : ' h-full')}>{(preloaded || phase !== 'idle') && previous}</div>
      <div ref={panes[1]} data-swipe-current className={'flex min-h-0 w-full shrink-0 flex-col' + (autoHeight ? '' : ' h-full')}>{children}</div>
      <div ref={panes[2]} aria-hidden="true" inert className={'flex min-h-0 w-full shrink-0 flex-col' + (autoHeight ? '' : ' h-full')}>{(preloaded || phase !== 'idle') && next}</div>
    </div>
  </div>;
}
