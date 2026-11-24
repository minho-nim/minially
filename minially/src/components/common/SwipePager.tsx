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
  /** 앞뒤 페이지의 고유 키(주면 넘긴 뒤 화면을 새로 만들지 않고 옮겨 써서 끝이 덜 끊긴다) */
  previousKey?: string;
  currentKey?: string;
  nextKey?: string;
  className?: string;
  'data-calendar-swipe'?: boolean;
  'data-task-swipe'?: boolean;
  'data-import-swipe'?: boolean;
}

export function SwipePager({ pageKey, children, previous, next, onPrevious, onNext, disabled = false, gap = 0, autoHeight = false, minimumHeight = 160, preload = false, previousKey, currentKey, nextKey, className = '', ...attributes }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const panes = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const measure = useRef<() => void>(() => {});
  const [height, setHeight] = useState(minimumHeight);
  const gesture = useRef<{ id: number; x: number; y: number; time: number; horizontal: boolean; lastX: number; lastT: number; vx: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreClickUntil = useRef(0);
  // 손가락을 따라가는 동안에는 React로 다시 그리지 않고 transform만 바로 바꾼다(끊김 줄이기)
  const offset = useRef(0);
  const frame = useRef(0);
  const [phase, setPhase] = useState<'idle' | 'dragging' | 'settling'>('idle');
  const phaseRef = useRef<'idle' | 'dragging' | 'settling'>('idle');
  const setPhaseBoth = (p: 'idle' | 'dragging' | 'settling') => { phaseRef.current = p; setPhase(p); };
  // 앞뒤 페이지는 화면이 쉬는 틈에 미리 그려 둔다(밀기 시작할 때 그리면 첫 움직임이 끊긴다)
  const [preloaded, setPreloaded] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const apply = (px: number, ms = 0) => {
    const el = track.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms cubic-bezier(.2,.8,.2,1)` : 'none';
    el.style.transform = `translate3d(calc(-100% - ${gap}px + ${px}px), 0, 0)`;
  };
  useLayoutEffect(() => {
    measure.current = () => {
      if (!autoHeight) return;
      const o = offset.current;
      const current = Math.max(minimumHeight, panes[1].current?.getBoundingClientRect().height || 0);
      const neighbor = Math.max(minimumHeight, panes[o < 0 ? 2 : 0].current?.getBoundingClientRect().height || 0);
      const progress = Math.min(1, Math.abs(o) / ((root.current?.clientWidth || 1) + gap));
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
  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    cancelAnimationFrame(frame.current);
    pending.current = null; gesture.current = null; offset.current = 0;
    apply(0);
    setPhaseBoth('idle');
  };
  useLayoutEffect(() => {
    // 새 페이지가 그려지기 전에 가운데로(번쩍임 없이). 넘김을 끝내자마자 시작한 새 밀기는 살려 둔다(연달아 넘기기)
    const fresh = gesture.current && Date.now() - gesture.current.time < 1000 ? gesture.current : null;
    reset();
    gesture.current = fresh;
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [pageKey, disabled, gap]);
  useEffect(() => {
    // 처음 한 번만 쉬는 틈을 기다렸다가 켠다(이후엔 앞뒤 페이지가 늘 그려져 있다)
    if (!preload) return;
    if ('requestIdleCallback' in window) { const id = window.requestIdleCallback(() => setPreloaded(true), { timeout: 400 }); return () => window.cancelIdleCallback(id); }
    const id = setTimeout(() => setPreloaded(true), 120);
    return () => clearTimeout(id);
  }, [preload]);
  const settle = (direction: -1 | 0 | 1, velocity = 0) => {
    const width = root.current?.clientWidth || 1;
    const target = direction * -(width + gap);
    const remaining = Math.abs(target - offset.current);
    // 남은 거리와 손 속도로 시간을 정한다(빠르게 튕기면 빨리, 조금 남았으면 짧게)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduce ? 0 : Math.round(Math.max(120, Math.min(300, velocity > 0.2 ? remaining / Math.max(velocity, 1.2) : 120 + remaining * 0.35)));
    setPhaseBoth('settling');
    offset.current = target;
    apply(target, duration);
    measure.current();
    const finish = () => {
      if (timer.current) clearTimeout(timer.current);
      pending.current = null;
      if (direction < 0) onPrevious();
      else if (direction > 0) onNext();
      else reset();
    };
    pending.current = finish;
    if (!duration) { finish(); return; }
    // 움직임이 실제로 끝난 순간(transitionend)에 페이지를 바꾼다. 이벤트가 안 오면 조금 뒤에
    const el = track.current;
    const onEnd = (e: TransitionEvent) => { if (e.target === el && e.propertyName === 'transform') { el?.removeEventListener('transitionend', onEnd); if (pending.current === finish) finish(); } };
    el?.addEventListener('transitionend', onEnd);
    timer.current = setTimeout(() => { el?.removeEventListener('transitionend', onEnd); if (pending.current === finish) finish(); }, duration + 80);
  };
  const cancel = () => { gesture.current = null; if (phaseRef.current === 'dragging') settle(0); };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) { cancel(); return; }
    // 넘어가는 중에 다시 밀면 지금 넘김을 바로 끝내고 새 밀기를 받는다(연달아 넘기기)
    if (phaseRef.current === 'settling' && pending.current) pending.current();
    else if (phaseRef.current !== 'idle') { ignoreClickUntil.current = Date.now() + 500; return; }
    ignoreClickUntil.current = 0;
    gesture.current = null;
    if (disabled || event.pointerType !== 'touch' || (event.target as Element).closest('button, a, input, textarea, select, [contenteditable="true"], [data-no-swipe]')) return;
    const now = performance.now();
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: Date.now(), horizontal: false, lastX: event.clientX, lastT: now, vx: 0 };
    // 손가락을 대는 순간 레이어를 미리 띄워 둔다(첫 움직임에서 레이어를 만드느라 끊기지 않게)
    if (track.current) track.current.style.willChange = 'transform';
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
      setPhaseBoth('dragging');
    }
    // 최근 움직임으로 속도(px/ms)를 부드럽게 잰다
    const now = performance.now(), dt = Math.max(1, now - start.lastT);
    start.vx = start.vx * 0.6 + ((event.clientX - start.lastX) / dt) * 0.4;
    start.lastX = event.clientX; start.lastT = now;
    const width = root.current?.clientWidth || 1;
    offset.current = Math.max(-width - gap, Math.min(width + gap, x));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { apply(offset.current); measure.current(); });
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || event.pointerId !== start.id || !start.horizontal) return;
    event.preventDefault();
    ignoreClickUntil.current = Date.now() + 500;
    const x = event.clientX - start.x, width = root.current?.clientWidth || 1;
    const velocity = Math.abs(start.vx);
    // 손을 뗄 때 반대로 튕기면 그쪽으로
    const flick = velocity > 0.35 && Math.abs(x) > 16 ? (start.vx < 0 ? 1 : -1) : 0;
    const dir = disabled ? 0 : flick || (Math.abs(x) >= Math.min(64, width * 0.18) ? (x < 0 ? 1 : -1) : 0);
    settle(dir as -1 | 0 | 1, velocity);
  };
  const paneClass = 'swipe-pane flex min-h-0 w-full shrink-0 flex-col' + (autoHeight ? '' : ' h-full');
  const showSides = preloaded || phase !== 'idle';
  return <div {...attributes} ref={root} data-swipe-phase={phase} className={'relative min-w-0 overflow-hidden ' + className} style={{ touchAction: 'pan-y pinch-zoom', height: autoHeight ? height : undefined, transition: autoHeight && phase !== 'dragging' ? 'height 220ms cubic-bezier(.22,.68,0,1)' : undefined }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onClickCapture={event => { if (Date.now() < ignoreClickUntil.current) { event.preventDefault(); event.stopPropagation(); } }}>
    <div ref={track} data-swipe-track className={autoHeight ? 'absolute top-0 left-0 flex w-full items-start' : 'flex h-full min-h-0 w-full'} style={{ columnGap: gap, transform: `translate3d(calc(-100% - ${gap}px), 0, 0)`, willChange: phase === 'idle' ? undefined : 'transform' } as CSSProperties}>
      <div key={previousKey ?? 'prev'} ref={panes[0]} aria-hidden="true" inert className={paneClass}>{showSides && previous}</div>
      <div key={currentKey ?? 'current'} ref={panes[1]} data-swipe-current className={paneClass}>{children}</div>
      <div key={nextKey ?? 'next'} ref={panes[2]} aria-hidden="true" inert className={paneClass}>{showSides && next}</div>
    </div>
  </div>;
}
