import { useRef, useState } from 'react';
import type React from 'react';

export function useDragOrder(ids: string[], onReorder: (ids: string[]) => void, enabled = true, holdMs = 0) {
  const rootRef = useRef<HTMLDivElement>(null);
  const source = useRef<string | null>(null);
  const interaction = useRef('mouse');
  const pointer = useRef<{ id: string; x: number; y: number; moved: boolean; since: number } | null>(null);
  const target = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null), [over, setOver] = useState<string | null>(null);
  const reset = () => { source.current = null; pointer.current = null; target.current = null; setDragging(null); setOver(null); };
  const commit = (from: string, to: string) => {
    const a = ids.indexOf(from), b = ids.indexOf(to);
    if (a < 0 || b < 0 || a === b) return;
    const next = [...ids]; next.splice(a, 1); next.splice(b, 0, from); onReorder(next);
  };
  const itemProps = (id: string) => ({
    'data-sort-item': id,
    'data-sort-over': over === id && dragging !== id ? 'true' : undefined,
    'data-sort-dragging': dragging === id ? 'true' : undefined,
    onDragOver: (e: React.DragEvent) => { if (!enabled || !source.current || !rootRef.current?.contains(e.currentTarget)) return; e.preventDefault(); target.current = id; setOver(id); },
    onDrop: (e: React.DragEvent) => { if (!enabled || !source.current) return; e.preventDefault(); e.stopPropagation(); commit(source.current, id); reset(); },
  });
  const handleProps = (id: string) => ({
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    draggable: enabled,
    style: { touchAction: enabled ? 'none' : 'auto' } as React.CSSProperties,
    onDragStart: (e: React.DragEvent) => { if (interaction.current === 'touch' || interaction.current === 'pen') { e.preventDefault(); return; } if (!enabled) { e.preventDefault(); return; } source.current = id; setDragging(id); e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; },
    onDragEnd: reset,
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      interaction.current = e.pointerType;
      if (!enabled || e.button !== 0 || e.pointerType === 'mouse') return;
      e.preventDefault();
      pointer.current = { id, x: e.clientX, y: e.clientY, moved: false, since: Date.now() }; target.current = id;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const start = pointer.current; if (!start || !enabled) return;
      if (!start.moved && Date.now() - start.since < holdMs) return;
      if (!start.moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      start.moved = true; source.current = start.id; setDragging(start.id); e.preventDefault();
      // Scroll the actual list/panel under the handle, including group managers.
      let scroll: HTMLElement | null = e.currentTarget.parentElement;
      while (scroll && !(scroll.scrollHeight > scroll.clientHeight && /auto|scroll/.test(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement;

      if (scroll) {
        const bounds = scroll.getBoundingClientRect();
        if (e.clientY < bounds.top + 32) scroll.scrollTop -= 12;
        else if (e.clientY > bounds.bottom - 32) scroll.scrollTop += 12;
      }
      const element = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-sort-item]');
      if (element && rootRef.current?.contains(element) && ids.includes(element.dataset.sortItem!)) { target.current = element.dataset.sortItem!; setOver(target.current); } else { target.current = null; setOver(null); }
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      const start = pointer.current;
      if (!start) return;
      if (start.moved && target.current) { e.preventDefault(); commit(start.id, target.current); }
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      reset();
    },
    onPointerCancel: () => { if (pointer.current) reset(); },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!enabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault(); const direction = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
      const to = ids[ids.indexOf(id) + direction]; if (to) commit(id, to);
    },
  });
  return { rootRef, itemProps, handleProps };
}
