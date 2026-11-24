import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { api, formatNumber } from '../../shared/client/api';
import { Columns } from './Charts';
import { Help } from './Help';
import { Tomong } from './Tomong';

// 블로그 구조: 카테고리 나무(2단) · 글 배치(끌어다 놓기, 휴대폰은 골라서 옮기기) · 균형·잠잠한 곳 · 주제 묶음과 빠진 링크
export interface Category { id: string; name: string; parent_id: string | null; sort: number }
interface Item { key: string; kind: 'post' | 'draft'; title: string; url: string; date: string | null; views: number | null; status: string; tags: string[]; category_id: string | null }
interface Bundle { id: string; name: string; hub: string; members: string[] }
interface Data { categories: Category[]; items: Item[]; bundles: Bundle[]; gaps: Record<string, { item: string; missing: string[] }[]> }

const UNSORTED = '__unsorted';
const COLORS = ['#E37D12', '#F2B66D', '#7C8CE0', '#3FAE8B', '#D9534F', '#A77BD6', '#5BA8C8', '#C9B8AE'];
const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const daysSince = (date: string) => Math.round((Date.parse(`${kstToday()}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
const lastMonths = () => Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.now() + 9 * 3600000); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - (5 - i)); return d.toISOString().slice(0, 7); });

/** "맛집\n  성수\n  강남\n카페" 같이 붙여 넣은 글을 나무로(앞에 공백이 있으면 소분류) */
export function parseOutline(text: string, newId: () => string): Category[] {
  const out: Category[] = [];
  let parent: string | null = null;
  for (const raw of text.split('\n')) {
    const name = raw.trim().replace(/^[-•·]\s*/, '').slice(0, 30);
    if (!name) continue;
    const sub = /^\s+/.test(raw) && parent !== null;
    const id = newId();
    out.push({ id, name, parent_id: sub ? parent : null, sort: out.length });
    if (!sub) parent = id;
  }
  return out;
}

export function StructureView({ onBack, onOpenDraft }: { onBack: () => void; onOpenDraft: (id: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<string>(UNSORTED);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [outline, setOutline] = useState<string | null>(null);
  const [bundleForm, setBundleForm] = useState<{ name: string; hub: string } | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const fail = (e: unknown, text: string) => setMessage({ kind: 'error', text: e instanceof Error ? e.message : text });

  const load = () => api<Data>('/api/structure').then(d => { setData(d); return d; });
  useEffect(() => { load().then(d => { if (d.categories.length) setSelected(s => (s === UNSORTED && !d.items.some(i => !i.category_id) ? d.categories[0].id : s)); }).catch(e => fail(e, '불러오지 못했어요.')); }, []);

  const cats = data?.categories ?? [];
  const tops = cats.filter(c => !c.parent_id);
  const childrenOf = (id: string) => cats.filter(c => c.parent_id === id);
  const colorOf = (id: string) => COLORS[tops.findIndex(t => t.id === id) % COLORS.length];
  /** 대분류는 소분류 글까지 함께 센다 */
  const idsIn = (id: string) => [id, ...childrenOf(id).map(c => c.id)];
  const itemsIn = (id: string) => (data?.items ?? []).filter(i => (id === UNSORTED ? !i.category_id || !cats.some(c => c.id === i.category_id) : i.category_id !== null && idsIn(id).includes(i.category_id)));
  const published = (list: Item[]) => list.filter(i => i.kind === 'post' || i.status === 'published');
  const totalPosts = published((data?.items ?? []).filter(i => i.category_id && cats.some(c => c.id === i.category_id))).length;

  const statsOf = (id: string) => {
    const list = itemsIn(id), pub = published(list);
    const dates = pub.map(i => i.date).filter((d): d is string => !!d).sort();
    const last = dates.length ? daysSince(dates[dates.length - 1]) : null;
    const viewed = pub.filter(i => i.views !== null);
    const month = kstToday().slice(0, 7);
    return {
      posts: pub.length, drafts: list.length - pub.length, last,
      thisMonth: pub.filter(i => i.date?.startsWith(month)).length,
      avgViews: viewed.length ? Math.round(viewed.reduce((n, i) => n + (i.views ?? 0), 0) / viewed.length) : null,
      months: lastMonths().map(m => ({ label: `${Number(m.slice(5))}월`, value: pub.filter(i => i.date?.startsWith(m)).length })),
    };
  };
  const flagOf = (id: string) => {
    const s = statsOf(id);
    if (s.posts === 0) return { kind: 'warn', text: '비어 있음' };
    if (s.last !== null && s.last >= 90) return { kind: 'warn', text: `잠잠함 ${s.last}일` };
    if (!cats.find(c => c.id === id)?.parent_id && totalPosts >= 5 && s.posts / totalPosts >= 0.4) return { kind: 'info', text: '쏠림' };
    if (s.thisMonth >= 2) return { kind: 'ok', text: '활발' };
    return null;
  };

  async function saveTree(next: Category[], text?: string) {
    try { const r = await api<{ categories: Category[] }>('/api/structure/categories', { method: 'PUT', body: { categories: next } }); setData(d => d && { ...d, categories: r.categories }); if (text) setMessage({ kind: 'info', text }); return true; }
    catch (e) { fail(e, '저장하지 못했어요.'); return false; }
  }
  async function move(keys: string[], categoryId: string | null) {
    if (!keys.length) return;
    try {
      await api('/api/structure/place', { method: 'PUT', body: { items: keys, category_id: categoryId } });
      setData(d => d && { ...d, items: d.items.map(i => (keys.includes(i.key) ? { ...i, category_id: categoryId } : i)) });
      setChecked(new Set());
      const where = categoryId ? cats.find(c => c.id === categoryId)?.name : '미분류';
      setMessage({ kind: 'info', text: `${keys.length}개를 '${where}'(으)로 옮겼어요.` });
    } catch (e) { fail(e, '옮기지 못했어요.'); }
  }
  const addCategory = (parent: string | null) => {
    const name = parent ? window.prompt?.('소분류 이름') ?? '' : newName.trim();
    if (!name) return;
    void saveTree([...cats, { id: crypto.randomUUID(), name: name.slice(0, 30), parent_id: parent, sort: cats.length }]).then(ok => { if (ok && !parent) setNewName(''); });
  };
  const shift = (id: string, dir: -1 | 1) => {
    const c = cats.find(x => x.id === id)!;
    const sib = cats.filter(x => x.parent_id === c.parent_id);
    const i = sib.findIndex(x => x.id === id), j = i + dir;
    if (j < 0 || j >= sib.length) return;
    const order = [...sib]; [order[i], order[j]] = [order[j], order[i]];
    const rest = cats.filter(x => x.parent_id !== c.parent_id);
    void saveTree([...rest, ...order]);
  };
  const remove = (id: string) => {
    const c = cats.find(x => x.id === id)!;
    const n = itemsIn(id).length;
    if (!window.confirm(`'${c.name}'${childrenOf(id).length ? '과 소분류' : ''}를 지울까요? 안의 글 ${n}개는 미분류로 가요.`)) return;
    void saveTree(cats.filter(x => x.id !== id && x.parent_id !== id), `'${c.name}'을(를) 지웠어요.`).then(() => { setSelected(UNSORTED); void load(); });
  };
  // 태그가 카테고리 이름과 같은 미분류 글(티스토리는 RSS 분류가 태그로 들어온다)
  const tagMatches = useMemo(() => {
    const byName = new Map(cats.map(c => [c.name.replace(/\s/g, '').toLowerCase(), c.id]));
    const out = new Map<string, string[]>();
    for (const i of data?.items ?? []) {
      if (i.category_id) continue;
      const hit = i.tags.map(t => byName.get(t.replace(/\s/g, '').toLowerCase())).find(Boolean);
      if (hit) out.set(hit, [...(out.get(hit) ?? []), i.key]);
    }
    return out;
  }, [data, cats]);
  const tagMatchCount = [...tagMatches.values()].reduce((n, l) => n + l.length, 0);

  // 끌어다 놓기(PC): 고른 글이 있으면 고른 글 전부, 아니면 잡은 글 하나
  const onDragStart = (e: DragEvent, key: string) => {
    const keys = checked.has(key) ? [...checked] : [key];
    e.dataTransfer.setData('text/minilog-items', JSON.stringify(keys));
    e.dataTransfer.effectAllowed = 'move';
  };
  const dropProps = (target: string) => ({
    onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes('text/minilog-items')) { e.preventDefault(); setDragOver(target); } },
    onDragLeave: () => setDragOver(d => (d === target ? null : d)),
    onDrop: (e: DragEvent) => { e.preventDefault(); setDragOver(null); try { void move(JSON.parse(e.dataTransfer.getData('text/minilog-items')), target === UNSORTED ? null : target); } catch { /* 다른 끌기 */ } },
  });

  async function createBundle() {
    if (!bundleForm) return;
    try {
      const { bundle } = await api<{ bundle: Bundle }>('/api/structure/bundles', { body: { name: bundleForm.name, hub: bundleForm.hub, members: [...checked] } });
      setBundleForm(null); setChecked(new Set());
      await load();
      setMessage({ kind: 'info', text: `묶음 '${bundle.name}'을(를) 만들었어요.` });
    } catch (e) { fail(e, '묶음을 만들지 못했어요.'); }
  }
  async function removeBundle(b: Bundle) {
    if (!window.confirm(`묶음 '${b.name}'을(를) 풀까요? 글은 그대로 남아요.`)) return;
    try { await api(`/api/structure/bundles/${b.id}`, { method: 'DELETE' }); await load(); } catch (e) { fail(e, '풀지 못했어요.'); }
  }
  async function copyLinks(b: Bundle) {
    const byKey = new Map((data?.items ?? []).map(i => [i.key, i]));
    const lines = [b.hub, ...b.members].map(k => byKey.get(k)).filter((i): i is Item => !!i?.url).map(i => `▶ ${i.title}\n${i.url}`);
    try { await navigator.clipboard.writeText(`[함께 보면 좋은 글]\n${lines.join('\n')}`); setMessage({ kind: 'info', text: '묶음 링크 문구를 복사했어요. 글 맨 아래에 붙여 넣으세요.' }); }
    catch { setMessage({ kind: 'error', text: '복사하지 못했어요.' }); }
  }

  if (!data) return <article className="stack"><p className="muted small" role={message ? 'alert' : 'status'}>{message?.text ?? '불러오는 중…'}</p></article>;

  const current = selected === UNSORTED ? null : cats.find(c => c.id === selected) ?? null;
  const list = itemsIn(selected).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const stats = statsOf(selected);
  const titleOf = (k: string) => data.items.find(i => i.key === k)?.title ?? '(지운 글)';
  const bundlesHere = data.bundles.filter(b => [b.hub, ...b.members].some(k => list.some(i => i.key === k)));
  const path = current ? (current.parent_id ? `${cats.find(c => c.id === current.parent_id)?.name ?? ''} › ${current.name}` : current.name) : '미분류';
  const flag = current ? flagOf(current.id) : null;

  return (
    <article className="stack structure" aria-labelledby="st-title">
      <div className="editor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" onClick={onBack}>← 목록</button>
          <h1 id="st-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>블로그 구조</h1>
        </div>
        <div className="actions">
          {tagMatchCount > 0 && <button className="btn" onClick={() => { void Promise.all([...tagMatches].map(([cat, keys]) => move(keys, cat))); }}>태그로 자동 배치({tagMatchCount})</button>}
          <button className="btn" onClick={() => setOutline(o => (o === null ? '' : null))} aria-expanded={outline !== null}>목록 붙여 넣기</button>
        </div>
      </div>
      <Help short="블로그 카테고리를 그대로 적고, 글을 끌어다 카테고리에 넣어요.">
        네이버는 카테고리 목록을 가져갈 방법이 없어서 처음 한 번은 직접 적어요('목록 붙여 넣기'에 한 줄에 하나, 소분류는 앞에 공백). 글은 PC에서는 끌어다 왼쪽 카테고리에 놓고, 휴대폰에서는 체크한 뒤 '옮기기'를 눌러요. 블로그 쪽 카테고리는 바뀌지 않아요.
      </Help>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}

      {outline !== null && (
        <section className="card step" aria-label="목록 붙여 넣기">
          <label htmlFor="st-outline" className="small">카테고리 목록(한 줄에 하나, 소분류는 앞에 공백 두 칸)</label>
          <textarea id="st-outline" className="textarea" rows={6} value={outline} placeholder={'맛집\n  성수\n  강남\n카페\n제품 리뷰'} onChange={e => setOutline(e.target.value)} />
          <div className="ai-row">
            <button className="btn primary small" disabled={!outline.trim()} onClick={() => {
              const add = parseOutline(outline, () => crypto.randomUUID());
              if (cats.length && !window.confirm('지금 카테고리 뒤에 더할까요?')) return;
              void saveTree([...cats, ...add], `카테고리 ${add.length}개를 더했어요.`).then(ok => { if (ok) setOutline(null); });
            }}>더하기</button>
            <button className="btn ghost small" onClick={() => setOutline(null)}>닫기</button>
          </div>
        </section>
      )}

      <div className="st-layout">
        <aside className="card st-tree" aria-label="카테고리">
          {totalPosts > 0 && (
            <div className="st-balance">
              <div className="row-between small"><b>글 비율</b><span className="muted">게시 글 {totalPosts}개</span></div>
              <div className="st-bal-bar" role="img" aria-label={tops.map(t => `${t.name} ${statsOf(t.id).posts}개`).join(', ')}>
                {tops.map(t => <span key={t.id} style={{ width: `${(statsOf(t.id).posts / totalPosts) * 100}%`, background: colorOf(t.id) }} />)}
              </div>
            </div>
          )}
          <ul className="st-nodes">
            {tops.map(t => (
              <li key={t.id}>
                <TreeNode cat={t} color={colorOf(t.id)} count={itemsIn(t.id).length} flag={flagOf(t.id)} selected={selected === t.id} over={dragOver === t.id}
                  renaming={renaming?.id === t.id ? renaming.name : null} onRename={name => setRenaming(name === null ? null : { id: t.id, name })}
                  onSaveName={() => { if (renaming?.name.trim()) void saveTree(cats.map(c => (c.id === t.id ? { ...c, name: renaming.name.trim().slice(0, 30) } : c))); setRenaming(null); }}
                  onSelect={() => setSelected(t.id)} onUp={() => shift(t.id, -1)} onDown={() => shift(t.id, 1)} onRemove={() => remove(t.id)} onAddSub={() => addCategory(t.id)} drop={dropProps(t.id)} />
                {childrenOf(t.id).length > 0 && (
                  <ul className="st-nodes sub">
                    {childrenOf(t.id).map(c => (
                      <li key={c.id}>
                        <TreeNode cat={c} count={itemsIn(c.id).length} flag={flagOf(c.id)} selected={selected === c.id} over={dragOver === c.id}
                          renaming={renaming?.id === c.id ? renaming.name : null} onRename={name => setRenaming(name === null ? null : { id: c.id, name })}
                          onSaveName={() => { if (renaming?.name.trim()) void saveTree(cats.map(x => (x.id === c.id ? { ...x, name: renaming.name.trim().slice(0, 30) } : x))); setRenaming(null); }}
                          onSelect={() => setSelected(c.id)} onUp={() => shift(c.id, -1)} onDown={() => shift(c.id, 1)} onRemove={() => remove(c.id)} drop={dropProps(c.id)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            <li>
              <div className={`st-node unsorted${selected === UNSORTED ? ' on' : ''}${dragOver === UNSORTED ? ' over' : ''}`} {...dropProps(UNSORTED)}>
                <button type="button" className="st-name" aria-current={selected === UNSORTED} onClick={() => setSelected(UNSORTED)}>미분류</button>
                <span className="st-count">{itemsIn(UNSORTED).length}</span>
              </div>
            </li>
          </ul>
          <form className="st-add" onSubmit={e => { e.preventDefault(); addCategory(null); }}>
            <input className="input small-input" aria-label="새 카테고리 이름" value={newName} maxLength={30} placeholder="새 카테고리" onChange={e => setNewName(e.target.value)} />
            <button className="btn small" type="submit" disabled={!newName.trim()}>+ 더하기</button>
          </form>
          {!cats.length && <div className="profile"><Tomong kind="minilog" size={36} /><p className="muted small" style={{ margin: 0 }}>블로그 카테고리를 적어 주세요. 여러 개면 '목록 붙여 넣기'가 빨라요.</p></div>}
        </aside>

        <section className="st-detail stack" aria-labelledby="st-path">
          <div className="row-between">
            <h2 id="st-path" className="step-title" style={{ margin: 0 }}>{path}{flag && <span className={`st-flag ${flag.kind}`}>{flag.text}</span>}</h2>
            {stats.last !== null && <span className="muted small">마지막 글 {stats.last}일 전</span>}
          </div>
          <div className="st-stats">
            <div className="card"><b>{stats.posts}</b><span>게시 글</span></div>
            <div className="card"><b>{stats.thisMonth}</b><span>이번 달</span></div>
            <div className="card"><b>{stats.avgViews === null ? '—' : formatNumber(stats.avgViews)}</b><span>평균 조회수</span></div>
            <div className="card"><b>{stats.drafts}</b><span>쓰는 중 원고</span></div>
          </div>
          {stats.posts > 0 && <div className="card"><Columns label={`${path} 월별 게시`} items={stats.months} format={n => `${n}개`} /></div>}
          {flag?.text.startsWith('잠잠함') && <p className="st-tip small">{path}에 {stats.last}일째 글이 없어요. 글감 화면에서 이 주제로 추천받아 보세요.</p>}

          <div className="card stack" style={{ gap: 8 }}>
            <div className="row-between">
              <b className="small">글 {list.length}개{checked.size ? ` · ${checked.size}개 고름` : ''}</b>
              {checked.size > 0 && (
                <div className="ai-row" style={{ gap: 6 }}>
                  <label className="sr-only" htmlFor="st-move">고른 글 옮기기</label>
                  <select id="st-move" className="input small-input" value="" onChange={e => { if (e.target.value) void move([...checked], e.target.value === UNSORTED ? null : e.target.value); }}>
                    <option value="">옮기기…</option>
                    {tops.flatMap(t => [t, ...childrenOf(t.id)]).map(c => <option key={c.id} value={c.id}>{c.parent_id ? '　› ' : ''}{c.name}</option>)}
                    <option value={UNSORTED}>미분류</option>
                  </select>
                  {checked.size >= 2 && <button className="btn small" onClick={() => setBundleForm({ name: '', hub: [...checked][0] })}>묶음 만들기</button>}
                  <button className="btn ghost small" onClick={() => setChecked(new Set())}>고르기 풀기</button>
                </div>
              )}
            </div>
            {list.length === 0 ? <p className="muted small" style={{ margin: 0 }}>{selected === UNSORTED ? '미분류 글이 없어요.' : '이 카테고리에 넣은 글이 없어요. 다른 카테고리나 미분류에서 끌어다 놓으세요.'}</p> : (
              <ul className="st-items">
                {list.map(i => (
                  <li key={i.key} draggable onDragStart={e => onDragStart(e, i.key)} className={checked.has(i.key) ? 'on' : ''}>
                    <input type="checkbox" aria-label={`${i.title} 고르기`} checked={checked.has(i.key)} onChange={e => setChecked(s => { const n = new Set(s); if (e.target.checked) n.add(i.key); else n.delete(i.key); return n; })} />
                    <span className={`st-kind ${i.kind === 'post' || i.status === 'published' ? '' : 'draft'}`}>{i.kind === 'post' || i.status === 'published' ? '게시' : '원고'}</span>
                    {i.kind === 'draft' ? <button className="link-button st-title" onClick={() => onOpenDraft(i.key.slice(6))}>{i.title}</button>
                      : i.url.startsWith('https://') ? <a className="st-title" href={i.url} target="_blank" rel="noopener noreferrer">{i.title}</a> : <span className="st-title">{i.title}</span>}
                    <span className="muted small st-meta">{i.date ? i.date.slice(2).replace(/-/g, '.') : ''}{i.views !== null ? ` · 조회 ${formatNumber(i.views)}` : ''}</span>
                    <span className="st-grip" aria-hidden="true">⠿</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {bundleForm && (
            <form className="card stack" style={{ gap: 8 }} aria-label="주제 묶음 만들기" onSubmit={e => { e.preventDefault(); void createBundle(); }}>
              <b className="small">주제 묶음 만들기 · 고른 글 {checked.size}개</b>
              <input className="input" aria-label="묶음 이름" value={bundleForm.name} maxLength={40} placeholder="예: 성수 소금빵" onChange={e => setBundleForm(f => f && { ...f, name: e.target.value })} />
              <label className="small" htmlFor="st-hub">대표 글(나머지는 세부 글)</label>
              <select id="st-hub" className="input" value={bundleForm.hub} onChange={e => setBundleForm(f => f && { ...f, hub: e.target.value })}>
                {[...checked].map(k => <option key={k} value={k}>{titleOf(k)}</option>)}
              </select>
              <div className="ai-row"><button className="btn primary small" type="submit" disabled={!bundleForm.name.trim()}>만들기</button><button className="btn ghost small" type="button" onClick={() => setBundleForm(null)}>취소</button></div>
            </form>
          )}

          {bundlesHere.map(b => {
            const gaps = data.gaps[b.id] ?? [];
            const missingTotal = gaps.reduce((n, g) => n + g.missing.length, 0);
            return (
              <div key={b.id} className="card stack st-bundle" style={{ gap: 8 }} aria-label={`묶음 ${b.name}`}>
                <div className="row-between">
                  <b className="small">주제 묶음 · {b.name}</b>
                  <span className="ai-row" style={{ gap: 6 }}>
                    <button className="btn small" onClick={() => { void copyLinks(b); }}>링크 문구 복사</button>
                    <button className="btn ghost small" onClick={() => { void removeBundle(b); }}>묶음 풀기</button>
                  </span>
                </div>
                <ul className="st-items plain">
                  {[b.hub, ...b.members].map(k => (
                    <li key={k}><span className={`st-role${k === b.hub ? '' : ' sub'}`}>{k === b.hub ? '대표' : '세부'}</span><span className="st-title">{titleOf(k)}</span></li>
                  ))}
                </ul>
                {gaps.length === 0
                  ? <p className="muted small" style={{ margin: 0 }}>미니로그에서 쓴 원고가 묶음에 있으면 서로 링크했는지 점검해요.</p>
                  : missingTotal === 0 ? <p className="small st-ok" style={{ margin: 0 }}>✓ 묶음 글끼리 서로 링크했어요.</p>
                  : (
                    <div className="stack" style={{ gap: 4 }}>
                      <b className="small">빠진 링크 {missingTotal}개</b>
                      {gaps.filter(g => g.missing.length).map(g => (
                        <p key={g.item} className="small" style={{ margin: 0 }}>{titleOf(g.item)} → {g.missing.map(m => <span key={m} className="chip warn" style={{ marginLeft: 4 }}>{titleOf(m)}</span>)}</p>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}
        </section>
      </div>
    </article>
  );
}

function TreeNode({ cat, color, count, flag, selected, over, renaming, onRename, onSaveName, onSelect, onUp, onDown, onRemove, onAddSub, drop }: {
  cat: Category; color?: string; count: number; flag: { kind: string; text: string } | null; selected: boolean; over: boolean; renaming: string | null;
  onRename: (name: string | null) => void; onSaveName: () => void; onSelect: () => void; onUp: () => void; onDown: () => void; onRemove: () => void; onAddSub?: () => void;
  drop: { onDragOver: (e: DragEvent) => void; onDragLeave: () => void; onDrop: (e: DragEvent) => void };
}) {
  return (
    <div className={`st-node${selected ? ' on' : ''}${over ? ' over' : ''}`} {...drop}>
      {renaming !== null ? (
        <form className="st-rename" onSubmit={e => { e.preventDefault(); onSaveName(); }}>
          <input className="input small-input" aria-label={`${cat.name} 새 이름`} autoFocus value={renaming} maxLength={30} onChange={e => onRename(e.target.value)} onBlur={onSaveName} />
        </form>
      ) : (
        <button type="button" className="st-name" aria-current={selected} onClick={onSelect} onDoubleClick={() => onRename(cat.name)}>
          {color && <i className="st-dot" style={{ background: color }} aria-hidden="true" />}{cat.name}
          {flag && <span className={`st-flag ${flag.kind}`}>{flag.text}</span>}
        </button>
      )}
      <span className="st-count">{count}</span>
      <span className="st-acts">
        <button type="button" aria-label={`${cat.name} 이름 바꾸기`} title="이름 바꾸기" onClick={() => onRename(cat.name)}>✎</button>
        {onAddSub && <button type="button" aria-label={`${cat.name}에 소분류 더하기`} title="소분류 더하기" onClick={onAddSub}>＋</button>}
        <button type="button" aria-label={`${cat.name} 위로`} onClick={onUp}>↑</button>
        <button type="button" aria-label={`${cat.name} 아래로`} onClick={onDown}>↓</button>
        <button type="button" aria-label={`${cat.name} 지우기`} onClick={onRemove}>×</button>
      </span>
    </div>
  );
}
