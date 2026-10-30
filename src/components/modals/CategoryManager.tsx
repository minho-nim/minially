import React, { useLayoutEffect, useRef, useState } from 'react';
import { CATEGORY_LIMIT, nextCategoryColor } from '../../utils/categories';
import { CategoryItem, Schedule } from '../../types';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { DiscardPrompt } from '../common/DiscardPrompt';

export interface CategoryActions {
  categories: CategoryItem[];
  schedules: Schedule[];
  onSaveCategory: (category: CategoryItem) => Promise<void> | void;
  onDeleteCategory: (id: string) => Promise<void> | void;
  onReorderCategories?: (ids: string[]) => Promise<void> | void;
}
const button = 'min-h-11 px-2 rounded-lg text-xs text-[#85777D] hover:bg-[#F6E8ED] disabled:opacity-40';
const input = 'min-w-0 w-full border border-[#F0E7EB] rounded-lg p-2 text-base bg-white';
export function CategoryManager({ categories, schedules, onSaveCategory, onDeleteCategory, onReorderCategories, onCreated, onDirtyChange, onBusyChange }: CategoryActions & { onCreated?: (id: string) => void; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const draftId = useRef<string | null>(null);
  const original = categories.find(c => c.id === editing);
  const color = original?.color || nextCategoryColor(categories);
  const dirty = editing ? name !== original?.name : Boolean(name);
  const guard = useDiscardGuard(dirty, pending);
  useLayoutEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useLayoutEffect(() => { onBusyChange?.(pending); }, [pending, onBusyChange]);
  const reset = () => { draftId.current = null; setEditing(null); setName(''); setError(''); };
  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await action(); } catch (error) { setError(error instanceof Error && error.message.includes('최대 12개') ? error.message : '저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.'); }
    finally { busy.current = false; setPending(false); }
  };
  return <fieldset disabled={pending} className="space-y-3 min-w-0">
    {guard.confirming && <DiscardPrompt onContinue={guard.cancel} onDiscard={guard.discard} />}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    <p className="text-xs text-[#85777D]">내 카테고리 {categories.length}/{CATEGORY_LIMIT}개{categories.length >= CATEGORY_LIMIT ? ' · 추가하려면 기존 카테고리를 삭제하세요.' : ''}</p>
    <ul aria-label="카테고리 관리 목록" className="divide-y divide-[#F0E7EB]">
      {!categories.length && <li className="text-sm py-3">카테고리가 없습니다. 아래에서 추가하세요.</li>}
      {categories.map((cat, index) => <li key={cat.id} data-category-id={cat.id} className="py-2">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="w-3 h-3 rounded-full" style={{ background: cat.color }} /><span className="text-sm flex-1 break-all">{cat.name}</span>
          <button type="button" className={button} onClick={() => guard.request(() => { setEditing(cat.id); setName(cat.name); setDeleting(null); })}>수정</button>
          <button type="button" className={button} onClick={() => setDeleting(cat.id)}>삭제</button>
          {onReorderCategories && ([-1, 1] as const).map(direction => <button key={direction} type="button" className={button} aria-label={direction < 0 ? '카테고리 위로 이동' : '카테고리 아래로 이동'} disabled={!categories[index + direction]} onClick={() => void run(async () => {
            const ids = categories.map(c => c.id); [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]; await onReorderCategories(ids);
          })}>{direction < 0 ? '↑' : '↓'}</button>)}
        </div>
        {deleting === cat.id && <div role="group" aria-label="카테고리 삭제 확인" className="text-xs space-y-1 p-2 bg-[#FFFAFB] rounded-lg">
          <p>이 카테고리를 사용하는 일정 {schedules.filter(s => s.category === cat.id).length}개는 삭제하지 않고 미분류로 변경합니다. 반복 일정의 변경 내역도 보존합니다.</p>
          <button type="button" className={button} onClick={() => void run(async () => { await onDeleteCategory(cat.id); setDeleting(null); if (editing === cat.id) reset(); })}>삭제</button>
          <button type="button" className={button} onClick={() => setDeleting(null)}>취소</button>
        </div>}
      </li>)}
    </ul>
    <form className="border-t border-[#F0E7EB] pt-3 space-y-2" onSubmit={e => {
      e.preventDefault(); if (!name.trim()) return;
      if (!editing && categories.length >= CATEGORY_LIMIT) { setError('카테고리는 최대 12개까지 만들 수 있습니다.'); return; }
      void run(async () => {
        const existing = categories.find(c => c.id === editing);
        draftId.current ??= crypto.randomUUID();
        const id = existing?.id || draftId.current;
        await onSaveCategory({ ...existing, id, name: name.trim(), color, sortOrder: existing ? existing.sortOrder : Math.max(0, ...categories.map(c => c.sortOrder ?? 0)) + 1 });
        reset(); if (!existing) onCreated?.(id);
      });
    }}>
      <label htmlFor="category-name" className="block text-sm font-semibold">{editing ? '카테고리 수정' : '새 카테고리 추가'}</label>
      <div className="flex items-center gap-2"><span aria-label="고정 카테고리 색상" className="w-5 h-5 rounded-full shrink-0" style={{background:color}}/><input id="category-name" className={input} required placeholder="카테고리 이름" value={name} onChange={e => setName(e.target.value)} /></div>
      <p className="text-xs text-[#85777D]">색상은 자동 배정되며 변경되지 않습니다.</p>
      <button type="submit" className={button + ' bg-[#F6E8ED]'} disabled={!name.trim() || (!editing && categories.length >= CATEGORY_LIMIT)}>{editing ? '변경사항 저장' : '추가'}</button>
      {(editing || dirty) && <button type="button" className={button} onClick={() => guard.request(reset)}>취소</button>}
    </form>
  </fieldset>;
}
