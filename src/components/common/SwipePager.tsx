import { useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent, type CSSProperties } from 'react';

interface Props {
  pageKey: string;
  children: ReactNode;
  previous: ReactNode;
  next: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
  gap?: number;
  className?: string;
  'data-calendar-swipe'?: boolean;
  'data-task-swipe'?: boolean;
}

export function SwipePager({ pageKey, children, previous, next, onPrevious, onNext, disabled = false, gap = 0, className = '', ...attributes }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; time: number; horizontal: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreClickUntil = useRef(0);
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'dragging' | 'settling'>('idle');
  const reset = () => { if (timer.current) clearTimeout(timer.current); gesture.current = null; setOffset(0); setPhase('idle'); };
  useLayoutEffect(() => { reset(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [pageKey, disabled]);
  const settle = (direction: -1 | 0 | 1) => {
    const width = root.current?.clientWidth || 1;
    setPhase('settling');
    setOffset(direction * -(width + gap));
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
    timer.current = setTimeout(() => {
      if (direction < 0) onPrevious();
      if (direction > 0) onNext();
      reset();
    }, duration);
  };
  const cancel = () => { gesture.current = null; if (phase === 'dragging') settle(0); };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) { cancel(); return; }
    if (phase !== 'idle') { ignoreClickUntil.current = Date.now() + 500; return; }
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
      if (Math.abs(y) > 12 && Math.abs(y) > Math.abs(x)) { gesture.current = null; return; }
      if (Math.abs(x) < 12 || Math.abs(x) < Math.abs(y) * 1.4) return;
      start.horizontal = true;
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
    const commit = !disabled && (Math.abs(x) >= Math.min(92, width * 0.24) || (Math.abs(x) > 28 && velocity > 0.5));
    settle(commit ? x < 0 ? 1 : -1 : 0);
  };
  return <div {...attributes} ref={root} data-swipe-phase={phase} className={'relative min-w-0 overflow-hidden ' + className} style={{ touchAction: 'pan-y pinch-zoom' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onClickCapture={event => { if (Date.now() < ignoreClickUntil.current) { event.preventDefault(); event.stopPropagation(); } }}>
    <div data-swipe-track className="flex h-full min-h-0 w-full" style={{ columnGap: gap, transform: `translate3d(calc(-100% - ${gap}px + ${offset}px), 0, 0)`, transition: phase === 'settling' ? 'transform 220ms cubic-bezier(.22,.68,0,1)' : 'none', willChange: phase === 'idle' ? undefined : 'transform' } as CSSProperties}>
      <div aria-hidden="true" inert className="flex h-full min-h-0 w-full shrink-0 flex-col">{phase !== 'idle' && previous}</div>
      <div data-swipe-current className="flex h-full min-h-0 w-full shrink-0 flex-col">{children}</div>
      <div aria-hidden="true" inert className="flex h-full min-h-0 w-full shrink-0 flex-col">{phase !== 'idle' && next}</div>
    </div>
  </div>;
}
