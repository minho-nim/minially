import React, { useEffect, useRef, useState } from 'react';
import { Preset, PhraseType } from '../../types';
import { X, Star, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { sortPresets } from '../../utils/phrases';

type PhraseActions = {
  presets: Preset[];
  onSelectPhrase?: (text: string, phrase: Preset) => void;
  onSavePreset: (preset: Preset) => Promise<void> | void;
  onDeletePreset: (id: string) => Promise<void> | void;
  onReorderPresets: (ids: string[]) => Promise<void> | void;
  onUsePreset?: (id: string) => Promise<void> | void;
  initialType?: PhraseType | 'all';
};

const button = 'px-2 py-1 text-xs rounded-lg text-[#85777D] hover:bg-[#F6E8ED] disabled:opacity-40 cursor-pointer';
const primary = `${button} bg-[#CF8FA8] text-white hover:bg-[#BD7F98]`;
const input = 'w-full px-3 py-2 text-sm border border-[#F0E7EB] rounded-lg bg-white text-[#3E3438] focus:outline-none focus:border-[#CF8FA8]';

export function PhraseManager({ presets, onSelectPhrase, onSavePreset, onDeletePreset, onReorderPresets, onUsePreset, initialType = 'title' }: PhraseActions) {
  const [filter, setFilter] = useState(initialType);
  const [sort, setSort] = useState<'manual' | 'recent' | 'usage'>('manual');
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<PhraseType>(initialType === 'memo' ? 'memo' : 'title');
  const [favorite, setFavorite] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    setFilter(initialType);
    setNewType(initialType === 'memo' ? 'memo' : 'title');
  }, [initialType]);

  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try { await action(); }
    catch { setError('문구를 저장하거나 불러오지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.'); }
    finally { busy.current = false; setPending(false); }
  }

  const ordered = sortPresets(presets, sort);
  const visible = ordered.filter(p => filter === 'all' || p.type === filter);

  return <fieldset disabled={pending} aria-busy={pending} className="min-w-0 flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1" aria-label="문구 종류">
        {(['all', 'title', 'memo'] as const).map(type => <button type="button" key={type} aria-pressed={filter === type} onClick={() => { setFilter(type); if (type !== 'all') setNewType(type); setEditingId(null); setDeletingId(null); }} className={filter === type ? primary : button}>{type === 'all' ? '전체' : type === 'title' ? '일정 제목' : '메모'}</button>)}
      </div>
      <select aria-label="문구 정렬" value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="text-xs bg-white text-[#85777D] border border-[#F0E7EB] rounded-lg px-2 py-1">
        <option value="manual">지정 순서</option><option value="recent">최근 사용순</option><option value="usage">자주 사용순</option>
      </select>
    </div>
    {error && <p role="alert" className="text-xs text-[#C4476B]">{error}</p>}
    <p className="text-[11px] text-[#85777D]">즐겨찾기가 먼저 표시됩니다. 지정 순서에서 화살표로 순서를 바꿀 수 있습니다.</p>
    <ul className="divide-y divide-[#F0E7EB] max-h-[38vh] overflow-y-auto">
      {visible.length === 0 && <li className="py-8 text-center text-xs text-[#85777D]">등록된 문구가 없습니다. 아래에서 새 문구를 추가하세요.</li>}
      {visible.map((phrase, index) => <li key={phrase.id} data-phrase-id={phrase.id} className="py-3">
        {editingId === phrase.id ? <form onSubmit={e => { e.preventDefault(); if (!editText.trim()) return; void run(async () => { await onSavePreset({ ...phrase, text: editText.trim() }); setEditingId(null); }); }} className="flex flex-wrap gap-2">
          <input aria-label="문구 수정 내용" className={input} autoFocus required value={editText} onChange={e => setEditText(e.target.value)} />
          <button type="submit" className={primary} disabled={!editText.trim()}>저장하기</button>
          <button type="button" className={button} onClick={() => setEditingId(null)}>취소</button>
        </form> : <>
          <div className="flex items-start gap-1">
            <button type="button" aria-label={phrase.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 등록'} aria-pressed={phrase.isFavorite} className={button} onClick={() => void run(async () => { await onSavePreset({ ...phrase, isFavorite: !phrase.isFavorite }); })}><Star className={`w-4 h-4 ${phrase.isFavorite ? 'text-[#CF8FA8] fill-[#CF8FA8]' : ''}`} /></button>
            {onSelectPhrase ? <button type="button" className="text-left text-sm text-[#3E3438] flex-1 min-w-0 break-words py-1 hover:text-[#CF8FA8]" onClick={() => void run(async () => { await onUsePreset?.(phrase.id); onSelectPhrase(phrase.text, phrase); })}>{phrase.text}</button> : <span className="text-sm text-[#3E3438] flex-1 min-w-0 break-words py-1">{phrase.text}</span>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1 pl-1 mt-1">
            <span className="text-[11px] text-[#85777D]">{phrase.type === 'memo' ? '메모' : '제목'} · 사용 {phrase.usageCount}회</span>
            <div className="flex items-center gap-0.5">
              {onSelectPhrase && <button type="button" className={button} onClick={() => void run(async () => { await onUsePreset?.(phrase.id); onSelectPhrase(phrase.text, phrase); })}>선택</button>}
              {([-1, 1] as const).map(direction => {
                const target = visible[index + direction];
                return <button key={direction} type="button" aria-label={direction === -1 ? '위로 이동' : '아래로 이동'} className={button} disabled={sort !== 'manual' || !target || target.isFavorite !== phrase.isFavorite} onClick={() => void run(async () => {
                  const ids = ordered.map(p => p.id);
                  const a = ids.indexOf(phrase.id), b = ids.indexOf(target.id);
                  [ids[a], ids[b]] = [ids[b], ids[a]];
                  await onReorderPresets(ids);
                })}>{direction === -1 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}</button>;
              })}
              <button type="button" aria-label="문구 수정" className={button} onClick={() => { setEditingId(phrase.id); setEditText(phrase.text); setDeletingId(null); }}><Edit2 className="w-3.5 h-3.5" /></button>
              <button type="button" aria-label="문구 삭제" className={button} onClick={() => setDeletingId(phrase.id)}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          {deletingId === phrase.id && <div className="flex items-center gap-2 mt-2 text-xs text-[#C4476B]" role="group" aria-label="문구 삭제 확인"><span>이 문구를 삭제할까요?</span><button type="button" className={primary} onClick={() => void run(async () => { await onDeletePreset(phrase.id); setDeletingId(null); })}>삭제 확인</button><button type="button" className={button} onClick={() => setDeletingId(null)}>취소</button></div>}
        </>}
      </li>)}
    </ul>
    <form className="border-t border-[#F0E7EB] pt-3 space-y-2" onSubmit={e => { e.preventDefault(); if (!newText.trim()) return; void run(async () => {
      const now = Date.now();
      await onSavePreset({ id: crypto.randomUUID(), type: newType, text: newText.trim(), isFavorite: favorite, usageCount: 0, createdAt: now, updatedAt: now, order: Math.max(0, ...presets.map(p => p.order || 0)) + 1 });
      setNewText(''); setFavorite(false); setFilter(newType);
    }); }}>
      <label className="text-xs font-semibold text-[#3E3438] block" htmlFor="new-phrase">새 문구 추가</label>
      <input id="new-phrase" className={input} placeholder="새 문구 내용을 입력하세요" required value={newText} onChange={e => setNewText(e.target.value)} />
      <div className="flex items-center gap-3 text-xs text-[#85777D]">
        <select aria-label="새 문구 종류" value={newType} onChange={e => setNewType(e.target.value as PhraseType)} className="bg-white border border-[#F0E7EB] rounded-lg py-1"><option value="title">일정 제목</option><option value="memo">메모</option></select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} />즐겨찾기</label>
        <button type="submit" disabled={!newText.trim()} className={`${primary} ml-auto`}>새 문구 추가</button>
      </div>
    </form>
  </fieldset>;
}

export function PhraseManageModal({ isOpen, onClose, ...props }: PhraseActions & { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-xs">
    <div role="dialog" aria-modal="true" aria-labelledby="phrase-modal-title" className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-[#F0E7EB] max-h-[90vh] overflow-y-auto p-5 safe-bottom">
      <div className="flex items-center justify-between mb-3"><h3 id="phrase-modal-title" className="text-sm font-bold text-[#3E3438]">자주 쓰는 문구</h3><button type="button" onClick={onClose} aria-label="문구 팝업 닫기" className={button}><X className="w-4 h-4" /></button></div>
      <PhraseManager {...props} />
    </div>
  </div>;
}
