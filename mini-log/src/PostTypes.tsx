import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';
import { POST_TYPES, type PostType } from '../functions/_postTypes';

// 글 종류(계정마다): 원고 화면 버튼은 기본 '자주 쓴 순', 설정에서 화살표로 옮기면 '내가 정한 순'.
// 설정에서 숨기기·뼈대 고치기·새 글 종류 추가·AI로 뼈대 만들기를 한다(저장 버튼을 눌러야 바뀜).
export interface TypeDef { key: string; label: string; outline: string[]; guide: string; custom: boolean; hidden: boolean }
export interface TypesData { types: TypeDef[]; manual: boolean; usage: { type: string; count: number }[] }
interface Settings { order: string[] | null; custom: { key: string; label: string; outline: string[]; guide: string }[]; outlines: Record<string, string[]>; hidden: string[] }

const BASE = ['food', 'cafe', 'sponsored'];
const isBuiltin = (k: string): k is Exclude<PostType, 'none'> => k !== 'none' && k in POST_TYPES;

/** 원고 화면에 보일 순서(숨긴 것 빼고). 내가 정한 순이 없으면 자주 쓴 순 → 기본 3개 → 원래 순서 */
export function orderedTypes(d: TypesData): TypeDef[] {
  const shown = d.types.filter(t => !t.hidden);
  if (d.manual) return shown;
  const used = Object.fromEntries(d.usage.map(u => [u.type, u.count]));
  const idx = (k: string) => d.types.findIndex(t => t.key === k);
  return [...shown].sort((a, b) => (used[b.key] ?? 0) - (used[a.key] ?? 0) || Number(BASE.includes(b.key)) - Number(BASE.includes(a.key)) || idx(a.key) - idx(b.key));
}
/** 경험 칸에 넣는 뼈대("항목: " 줄들) */
export const outlineOf = (t: TypeDef | undefined) => (t ? t.outline.map(l => `${l}: `).join('\n') : '');

/** 기본 글 종류만 있는 값(서버를 못 읽었을 때) */
export const fallbackTypes = (): TypesData => ({
  types: (Object.keys(POST_TYPES) as PostType[]).filter(isBuiltin).map(k => ({ key: k, label: POST_TYPES[k].label, outline: [...POST_TYPES[k].outline], guide: POST_TYPES[k].guide, custom: false, hidden: false })),
  manual: false, usage: [],
});

export function usePostTypes(): TypesData {
  const [data, setData] = useState<TypesData>(fallbackTypes);
  useEffect(() => {
    let alive = true;
    api<TypesData>('/api/post-types').then(d => { if (alive) setData(d); }).catch(() => { /* 못 읽으면 기본 글 종류 */ });
    return () => { alive = false; };
  }, []);
  return data;
}

const newKey = () => { const a = new Uint8Array(6); crypto.getRandomValues(a); return 'c_' + [...a].map(n => 'abcdefghijklmnopqrstuvwxyz0123456789'[n % 36]).join(''); };
const toLines = (s: string) => s.split('\n').map(x => x.replace(/:\s*$/, '').trim()).filter(Boolean).slice(0, 15);

export function PostTypesCard() {
  const [list, setList] = useState<TypeDef[] | null>(null);
  const [manual, setManual] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const load = (d: TypesData) => { setRaw({}); setManual(d.manual); setList(d.manual ? d.types : [...orderedTypes(d), ...d.types.filter(t => t.hidden)]); setDirty(false); };
  useEffect(() => { api<TypesData>('/api/post-types').then(load).catch(() => load(fallbackTypes())); }, []);
  if (!list) return <section className="card step" aria-labelledby="types-title"><h2 id="types-title" className="step-title">글 종류</h2><p className="muted small" style={{ margin: 0 }}>불러오는 중…</p></section>;

  const resetRaw = (key: string) => setRaw(({ [key]: _gone, ...rest }) => rest);
  const edit = (key: string, patch: Partial<TypeDef>) => { setList(l => l!.map(t => (t.key === key ? { ...t, ...patch } : t))); setDirty(true); };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
    setList(next); setManual(true); setDirty(true);
  };
  const add = () => {
    const label = newName.trim().slice(0, 20); if (!label) return;
    const key = newKey();
    setList([...list, { key, label, outline: [], guide: '', custom: true, hidden: false }]);
    setNewName(''); setOpen(key); setDirty(true);
  };
  async function aiOutline(t: TypeDef) {
    setBusy(t.key); setMsg(null);
    try {
      const r = await api<{ outline: string[]; guide: string }>('/api/post-types/outline', { body: { label: t.label } });
      resetRaw(t.key);
      edit(t.key, t.custom ? { outline: r.outline, guide: t.guide || r.guide } : { outline: r.outline });
      setMsg({ kind: 'info', text: `${t.label} 뼈대 초안을 넣었어요. 고친 뒤 '저장'을 눌러 주세요.` });
    } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'AI 뼈대를 만들지 못했어요.' }); }
    finally { setBusy(null); }
  }
  async function save() {
    const settings: Settings = {
      order: manual ? list!.map(t => t.key) : null,
      custom: list!.filter(t => t.custom).map(t => ({ key: t.key, label: t.label.trim(), outline: t.outline, guide: t.guide })),
      outlines: Object.fromEntries(list!.filter(t => !t.custom && isBuiltin(t.key) && t.outline.join('\n') !== POST_TYPES[t.key as Exclude<PostType, 'none'>].outline.join('\n')).map(t => [t.key, t.outline])),
      hidden: list!.filter(t => t.hidden).map(t => t.key),
    };
    setBusy('save'); setMsg(null);
    try {
      await api('/api/post-types', { method: 'PUT', body: { settings } });
      load(await api<TypesData>('/api/post-types'));
      setMsg({ kind: 'info', text: '글 종류를 저장했어요. 원고 화면 버튼에 바로 보여요.' });
    } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : '저장하지 못했어요.' }); }
    finally { setBusy(null); }
  }

  return (
    <section className="card step" aria-labelledby="types-title">
      <h2 id="types-title" className="step-title">글 종류</h2>
      <p className="muted small" style={{ margin: 0 }}>
        원고 화면 버튼 순서: <b>{manual ? '내가 정한 순' : '자주 쓴 순'}</b>. 화살표로 옮기면 내가 정한 순이 돼요.
        {manual && <> <button type="button" className="link-btn small" onClick={() => { setManual(false); setDirty(true); }}>자주 쓴 순으로 돌리기</button></>}
      </p>
      <ol className="type-list" aria-label="글 종류 목록">
        {list.map((t, i) => (
          <li key={t.key} className={t.hidden ? 'off' : ''}>
            <div className="type-row">
              <span className="type-move">
                <button type="button" className="btn ghost icon" aria-label={`${t.label} 위로`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="btn ghost icon" aria-label={`${t.label} 아래로`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
              </span>
              <b className="type-name">{t.label}{t.custom && <span className="muted small"> · 내가 만든</span>}</b>
              <label className="small type-show"><input type="checkbox" checked={!t.hidden} onChange={e => edit(t.key, { hidden: !e.target.checked })} /> 버튼에 보이기</label>
              <button type="button" className="btn ghost small" aria-expanded={open === t.key} onClick={() => setOpen(open === t.key ? null : t.key)}>{open === t.key ? '접기' : '뼈대 고치기'}</button>
            </div>
            {open === t.key && (
              <div className="type-edit">
                {t.custom && (
                  <label className="field small">이름
                    <input className="input" value={t.label} maxLength={20} onChange={e => edit(t.key, { label: e.target.value })} />
                  </label>
                )}
                <label className="field small">경험 칸 뼈대(한 줄에 항목 하나)
                  <textarea className="textarea" rows={Math.min(10, Math.max(4, t.outline.length + 1))} value={raw[t.key] ?? t.outline.join('\n')} onChange={e => { const v = e.target.value; setRaw(m => ({ ...m, [t.key]: v })); edit(t.key, { outline: toLines(v) }); }} />
                </label>
                {t.custom && (
                  <label className="field small">AI 초안이 따를 흐름(선택)
                    <input className="input" value={t.guide} maxLength={300} placeholder="예) 장소 정보 → 경험 → 총평 순서" onChange={e => edit(t.key, { guide: e.target.value })} />
                  </label>
                )}
                <div className="ai-row">
                  <button type="button" className="btn small" disabled={busy !== null} onClick={() => { void aiOutline(t); }}>{busy === t.key ? 'AI가 만드는 중…' : 'AI로 뼈대 만들기'}</button>
                  {!t.custom && isBuiltin(t.key) && <button type="button" className="btn ghost small" onClick={() => { resetRaw(t.key); edit(t.key, { outline: [...POST_TYPES[t.key as Exclude<PostType, 'none'>].outline] }); }}>기본 뼈대로</button>}
                  {t.custom && <button type="button" className="btn ghost small" onClick={() => { setList(list.filter(x => x.key !== t.key)); setOpen(null); setDirty(true); }}>이 글 종류 지우기</button>}
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      <form className="ai-row" onSubmit={e => { e.preventDefault(); add(); }}>
        <input className="input" aria-label="새 글 종류 이름" placeholder="새 글 종류 이름(예: 전시회)" value={newName} maxLength={20} onChange={e => setNewName(e.target.value)} style={{ flex: '1 1 180px' }} />
        <button type="submit" className="btn" disabled={!newName.trim() || list.filter(t => t.custom).length >= 20}>글 종류 추가</button>
      </form>
      <div className="ai-row">
        <button type="button" className="btn primary" disabled={!dirty || busy !== null} onClick={() => { void save(); }}>{busy === 'save' ? '저장하는 중…' : '글 종류 저장'}</button>
        {dirty && <span className="muted small">저장하지 않은 바뀐 것이 있어요.</span>}
      </div>
      {msg && <p className={msg.kind === 'error' ? 'error small' : 'muted small'} role={msg.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{msg.text}</p>}
    </section>
  );
}
