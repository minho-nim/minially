import React, { useState } from 'react';
import { Copy, Eye, EyeOff, RefreshCw, Share2, Trash2, Users } from 'lucide-react';
import type { AppSettings, CategoryItem, ShareSettings, SharedView } from '../../types';
import { disableShare, fetchShared, rotateShareCode, SHARED_COLORS } from '../../sync/shared';
import { normalizeCode } from '../../sync/syncEngine';
import { isDemo } from '../../sync/demoMode';

interface Props { settings: AppSettings; categories: CategoryItem[]; onUpdateSettings: (settings: AppSettings) => Promise<void> | void }

const box = 'p-3.5 border border-app-line bg-app-canvas rounded-xl space-y-2.5';
const btn = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-app-line bg-white text-app-ink hover:bg-app-soft disabled:opacity-60 cursor-pointer';
const primary = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-app-accent text-white disabled:opacity-60 cursor-pointer';

export const SharePanel: React.FC<Props> = (props) => {
  // 공유는 서버를 쓰므로 체험 모드에서는 막는다.
  if (isDemo()) return <div className={box}><p className="text-xs text-app-muted">체험 모드에서는 일정 공유(같이 보기)를 쓸 수 없어요. 코드로 로그인하면 쓸 수 있어요.</p></div>;
  return <SharePanelInner {...props} />;
};

const SharePanelInner: React.FC<Props> = ({ settings, categories, onUpdateSettings }) => {
  const share: ShareSettings = settings.share ?? { name: '', categoryIds: [], includeTasks: false };
  const views = settings.sharedViews ?? [];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [name, setName] = useState(share.name);

  const save = (next: Partial<AppSettings>) => onUpdateSettings({ ...settings, ...next });
  const saveShare = (next: Partial<ShareSettings>) => save({ share: { ...share, ...next } });
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await fn(); } catch (error) { setMessage(error instanceof Error ? error.message : '처리하지 못했어요.'); } finally { setBusy(false); }
  };

  const start = () => run(async () => {
    const code = await rotateShareCode();
    await saveShare({ code, categoryIds: share.categoryIds.length ? share.categoryIds : [] });
    setMessage(share.code ? '공유 코드를 새로 만들었어요. 이전 코드로는 더 이상 볼 수 없어요.' : '공유 코드를 만들었어요. 공유할 카테고리를 골라 주세요.');
  });
  const stop = () => run(async () => {
    if (!window.confirm('공유를 끌까요? 이 코드를 받은 사람은 더 이상 내 일정을 볼 수 없어요.')) return;
    await disableShare();
    await saveShare({ code: undefined });
    setMessage('공유를 껐어요.');
  });
  const toggleCategory = (id: string) => saveShare({ categoryIds: share.categoryIds.includes(id) ? share.categoryIds.filter(c => c !== id) : [...share.categoryIds, id] });

  const addView = () => run(async () => {
    const code = normalizeCode(newCode);
    if (share.code && normalizeCode(share.code) === code) throw new Error('내 공유 코드예요. 다른 사람에게 받은 코드를 넣어 주세요.');
    if (views.some(v => normalizeCode(v.code) === code)) throw new Error('이미 추가한 코드예요.');
    const payload = await fetchShared(code);
    const used = new Set(views.map(v => v.color));
    const view: SharedView = { id: crypto.randomUUID().slice(0, 8), code, label: newLabel.trim() || payload.name || '공유 일정', color: SHARED_COLORS.find(c => !used.has(c)) ?? SHARED_COLORS[views.length % SHARED_COLORS.length], visible: true };
    await save({ sharedViews: [...views, view] });
    setNewCode(''); setNewLabel('');
    setMessage(`'${view.label}'의 일정을 추가했어요.`);
  });
  const updateView = (id: string, next: Partial<SharedView>) => save({ sharedViews: views.map(v => v.id === id ? { ...v, ...next } : v) });
  const removeView = (view: SharedView) => { if (window.confirm(`'${view.label}'의 일정을 그만 볼까요?`)) void save({ sharedViews: views.filter(v => v.id !== view.id) }); };

  return (
    <div className="space-y-3">
      <section className={box} aria-label="내 일정 공유">
        <div className="flex items-center gap-1.5"><Share2 className="w-4 h-4 text-app-accent" /><h4 className="text-sm font-bold text-app-ink">내 일정 공유하기</h4></div>
        <p className="text-[11px] text-app-muted">공유 코드를 받은 사람은 내가 고른 카테고리의 일정을 <b>볼 수만</b> 있어요. 고치거나 지울 수는 없어요.</p>
        {!share.code ? (
          <button type="button" disabled={busy} onClick={start} className={primary + ' w-full'}>공유 코드 만들기</button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-app-line bg-white text-sm font-semibold tracking-wider text-app-ink truncate" aria-label="내 공유 코드">{share.code}</code>
              <button type="button" className={btn} onClick={() => { void navigator.clipboard?.writeText(share.code!); setMessage('공유 코드를 복사했어요.'); }}><Copy className="w-3.5 h-3.5" />복사</button>
            </div>
            <label className="block text-xs text-app-muted">상대에게 보일 내 이름
              <input value={name} maxLength={20} onChange={e => setName(e.target.value)} onBlur={() => { if (name.trim() !== share.name) void saveShare({ name: name.trim() }); }} className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-app-line bg-white text-app-ink" />
            </label>
            <fieldset>
              <legend className="text-xs text-app-muted mb-1">공유할 카테고리</legend>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <label key={c.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs cursor-pointer ${share.categoryIds.includes(c.id) ? 'border-app-accent bg-white text-app-ink font-semibold' : 'border-app-line text-app-muted'}`}>
                    <input type="checkbox" className="sr-only" checked={share.categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />{c.name}
                  </label>
                ))}
              </div>
              {!share.categoryIds.length && <p className="mt-1 text-[11px] text-red-600">고른 카테고리가 없어서 지금은 아무 일정도 보이지 않아요.</p>}
            </fieldset>
            <label className="flex items-center gap-2 text-xs text-app-ink"><input type="checkbox" checked={share.includeTasks} onChange={e => void saveShare({ includeTasks: e.target.checked })} />할 일도 공유하기(전체)</label>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => { if (window.confirm('공유 코드를 새로 만들까요? 이전 코드를 받은 사람은 더 이상 볼 수 없어요.')) void start(); }} className={btn + ' flex-1'}><RefreshCw className="w-3.5 h-3.5" />코드 새로 만들기</button>
              <button type="button" disabled={busy} onClick={stop} className={btn + ' text-red-600'}>공유 끄기</button>
            </div>
          </>
        )}
      </section>

      <section className={box} aria-label="같이 보기">
        <div className="flex items-center gap-1.5"><Users className="w-4 h-4 text-app-accent" /><h4 className="text-sm font-bold text-app-ink">같이 보기</h4></div>
        <p className="text-[11px] text-app-muted">다른 사람에게 받은 공유 코드를 넣으면 그 사람의 일정이 내 달력에 다른 색으로 보여요. 내 PC·폰에 같이 저장돼요.</p>
        {views.map(view => (
          <div key={view.id} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-app-line">
            <input type="color" aria-label={`${view.label} 색상`} value={view.color} onChange={e => void updateView(view.id, { color: e.target.value })} className="w-6 h-6 shrink-0 rounded-full border-0 p-0 cursor-pointer" />
            <input aria-label="이름" value={view.label} maxLength={20} onChange={e => void updateView(view.id, { label: e.target.value })} className="flex-1 min-w-0 px-2 py-1 text-sm rounded-md border border-transparent hover:border-app-line" />
            <button type="button" aria-label={view.visible ? `${view.label} 숨기기` : `${view.label} 보이기`} onClick={() => void updateView(view.id, { visible: !view.visible })} className="p-1.5 rounded-lg text-app-muted hover:bg-app-soft cursor-pointer">{view.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
            <button type="button" aria-label={`${view.label} 삭제`} onClick={() => removeView(view)} className="p-1.5 rounded-lg text-app-muted hover:text-red-600 hover:bg-app-soft cursor-pointer"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <form className="space-y-2" onSubmit={e => { e.preventDefault(); if (!busy && newCode.trim()) void addView(); }}>
          <div className="flex gap-2">
            <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="받은 공유 코드" aria-label="받은 공유 코드" autoComplete="off" spellCheck={false} className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-app-line bg-white uppercase tracking-wider" />
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="이름(선택)" aria-label="보일 이름" maxLength={20} className="w-24 px-3 py-2 text-sm rounded-lg border border-app-line bg-white" />
          </div>
          <button type="submit" disabled={busy || !newCode.trim()} className={primary + ' w-full'}>{busy ? '확인 중…' : '추가'}</button>
        </form>
      </section>
      {message && <p role="status" className="text-xs text-app-muted">{message}</p>}
    </div>
  );
};
