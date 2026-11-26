// 사진·글로 일정 넣기: 사진 고르기 또는 글 붙여넣기 → (읽는 중) → 찾은 일정 고르기(고치기·겹침·확인 필요) → 고른 것만 등록.
// 글은 이 기기 안에서 규칙으로 읽고, 못 찾았을 때 사람이 누를 때만 AI로 보낸다. 사진은 AI로 읽되 저장하지 않는다.
// 등록은 App이 한 번에 하고 되돌리기도 한 번에 된다.
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Clock, ImagePlus, Sparkles, TextSearch, X } from 'lucide-react';
import type { CategoryItem, Schedule } from '../../types';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { getTodayDateString } from '../../utils/dateHelpers';
import { overlapping, PhotoReadError, readPhotoSchedule, readTextScheduleWithAi, shrinkForReading, type PhotoEvent } from '../../utils/photoSchedule';
import { parseScheduleText, TEXT_LIMIT } from '../../utils/textSchedule';
import { historyHint } from '../../utils/scheduleSuggest';

/** hint: 카테고리를 고른 이유, pastTitle: 예전에 쓴 비슷한 제목, original: 예전 제목으로 바꾸기 전 제목(되돌리기용) */
interface Row extends PhotoEvent { key: string; picked: boolean; category: string; hint: string; pastTitle: string; original: string }
interface Props {
  open: boolean; file?: Blob | null; text?: string | null; categories: CategoryItem[]; schedules: Schedule[];
  onClose: () => void; onAdd: (list: Schedule[]) => Promise<void>;
}

const field = 'min-w-0 rounded-lg border border-app-line bg-white px-2 text-sm text-app-ink';
/** 시작일~끝날(포함) 날짜 목록. 끝날이 없거나 앞서면 하루, 최대 14일 */
export function daysOf(start: string, until?: string) {
  if (!until || until <= start) return [start];
  const out: string[] = [];
  for (let d = new Date(`${start}T00:00:00Z`); out.length < 14; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    if (day > until) break;
    out.push(day);
  }
  return out;
}

export function PhotoScheduleSheet({ open, file, text, categories, schedules, onClose, onAdd }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'pick' | 'reading' | 'list' | 'error'>('pick');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<{ text: string; code: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasted, setPasted] = useState('');
  const [source, setSource] = useState<'photo' | 'text'>('photo');
  const [aiTried, setAiTried] = useState(false);
  const run = useRef(0);
  const close = () => { if (saving) return false; run.current += 1; onClose(); };
  useScheduleDialog(open, false, root, close, close);

  // 내 예전 일정을 보고 카테고리를 정하고, 같은 제목을 두 번 이상 썼으면 그 제목으로 맞춘다(이 기기 안에서만)
  const show = (events: PhotoEvent[]) => {
    setRows(events.map((e, i) => {
      const h = historyHint(e, schedules, categories);
      return { ...e, key: `${i}-${e.date}-${e.title}`, picked: !e.uncertain, category: h.category, hint: h.reason, title: h.habit ? h.pastTitle : e.title, pastTitle: h.habit ? '' : h.pastTitle, original: h.habit ? e.title : '' };
    }));
    setPhase('list');
  };

  async function ask(load: () => Promise<PhotoEvent[]>, what: string) {
    const id = ++run.current;
    setPhase('reading'); setError(null); setRows([]);
    try {
      const events = await load();
      if (id === run.current) show(events);
    } catch (e) {
      if (id !== run.current) return;
      setError({ text: e instanceof Error ? e.message : `${what}을 읽지 못했어요.`, code: e instanceof PhotoReadError ? e.code : 'error' });
      setPhase('error');
    }
  }
  const read = (blob: Blob) => { setSource('photo'); return ask(async () => readPhotoSchedule(await shrinkForReading(blob), getTodayDateString()), '사진'); };
  /** 글은 이 기기 안에서 규칙으로만 읽는다(서버·AI로 보내지 않음) */
  const findInText = (value = pasted) => { run.current += 1; setSource('text'); setAiTried(false); setError(null); show(parseScheduleText(value, getTodayDateString())); };
  const askAi = () => { setAiTried(true); void ask(() => readTextScheduleWithAi(pasted.trim(), getTodayDateString()), '글'); };

  useEffect(() => {
    if (!open) return;
    setRows([]); setError(null); setSaving(false); setAiTried(false);
    setPasted(text ?? '');
    if (file) void read(file); else if (text?.trim()) findInText(text); else { setSource('photo'); setPhase('pick'); }
    return () => { run.current += 1; };
  }, [open, file, text]);

  if (!open) return null;
  const set = (key: string, patch: Partial<Row>) => setRows(list => list.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const picked = rows.filter(r => r.picked && r.title.trim() && r.date);

  async function register() {
    if (!picked.length) return;
    setSaving(true);
    try {
      // 여러 날 일정(until)은 날마다 같은 일정을 만든다(달력이 이어진 한 줄로 그림, 최대 14일)
      await onAdd(picked.flatMap(r => daysOf(r.date, r.until).map(date => ({
        id: crypto.randomUUID(), title: r.title.trim(), date, ...(r.start ? { startTime: r.start } : {}), ...(r.start && r.end ? { endTime: r.end } : {}),
        category: r.category, completed: false, ...(r.location || r.memo ? { memo: [r.location && `장소: ${r.location}`, r.memo].filter(Boolean).join('\n') } : {}),
      } as Schedule))));
      setSaving(false);
      onClose();
    } catch (e) { setSaving(false); setError({ text: e instanceof Error ? e.message : '등록하지 못했어요.', code: 'save' }); }
  }

  const pickButton = <button type="button" className="min-h-11 rounded-xl border border-app-accent bg-app-soft px-4 text-sm font-semibold text-app-accent-ink" onClick={() => input.current?.click()}><ImagePlus className="mr-1 inline h-4 w-4" aria-hidden="true" />{phase === 'pick' ? '사진 고르기' : '다른 사진'}</button>;
  const editTextButton = <button type="button" className="min-h-11 rounded-xl border border-app-accent bg-app-soft px-4 text-sm font-semibold text-app-accent-ink" onClick={() => { run.current += 1; setError(null); setPhase('pick'); }}>글 고치기</button>;
  const againButton = source === 'text' ? editTextButton : pickButton;
  const aiButton = <button type="button" className="min-h-11 rounded-xl border border-app-line bg-white px-4 text-sm font-semibold text-app-ink" onClick={askAi}><Sparkles className="mr-1 inline h-4 w-4 text-app-accent-ink" aria-hidden="true" />AI로 다시 읽기</button>;
  const aiNote = <p className="text-xs text-app-muted">AI로 읽으면 이 글이 구글 무료 AI(Gemini)로 가요. 무료 AI에 보낸 내용은 구글 서비스 개선에 쓰일 수 있어요.</p>;

  return <div ref={root} role="dialog" aria-modal="true" aria-label="사진으로 일정 넣기" data-photo-schedule className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[rgba(52,40,35,0.30)]" onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="flex max-h-[92%] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl">
      <header className="flex shrink-0 items-center gap-2 border-b border-app-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-app-ink">{phase === 'list' ? `찾은 일정 ${rows.length}개` : '사진·글로 일정 넣기'}</h3>
          {phase === 'list' && rows.length > 0 && <p className="text-xs text-app-muted">고친 뒤 체크한 것만 등록돼요</p>}
        </div>
        <button type="button" aria-label="사진으로 일정 넣기 닫기" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-lg text-app-muted hover:bg-app-soft"><X className="h-5 w-5" /></button>
      </header>
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="일정이 적힌 사진" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f); }} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {phase === 'pick' && <div className="space-y-3">
          <form className="space-y-2" onSubmit={e => { e.preventDefault(); if (pasted.trim()) findInText(); }}>
            <label htmlFor="photo-schedule-text" className="block text-sm font-semibold text-app-ink">문자·메일 붙여넣기</label>
            <textarea id="photo-schedule-text" rows={4} maxLength={TEXT_LIMIT} value={pasted} onChange={e => setPasted(e.target.value)} placeholder={'예) [OO치과] 11월 28일(토) 오후 2시 30분 진료 예약되었습니다.'} className="w-full resize-y rounded-xl border border-app-line bg-white p-3 text-base text-app-ink placeholder:text-app-muted sm:text-sm" />
            <button type="submit" disabled={!pasted.trim()} className="min-h-11 rounded-xl bg-[#9E5873] px-4 text-sm font-bold text-white disabled:bg-[#C9B8BF]"><TextSearch className="mr-1 inline h-4 w-4" aria-hidden="true" />글에서 찾기</button>
            <p className="text-xs text-app-muted">글은 이 기기 안에서만 읽고, 어디로도 보내지 않아요.</p>
          </form>
          <div className="flex items-center gap-2 text-xs text-app-muted" aria-hidden="true"><span className="h-px flex-1 bg-app-line" />또는<span className="h-px flex-1 bg-app-line" /></div>
          <p className="text-sm text-app-ink">예약 문자·공지·포스터 사진을 고르면 날짜와 시간을 찾아 일정 후보로 보여 줘요. 고른 것만 등록돼요.</p>
          {pickButton}
          <p className="rounded-xl bg-app-soft p-3 text-xs text-app-ink">사진은 구글 무료 AI(Gemini)로 읽어요. 무료 AI에 보낸 내용은 구글 서비스 개선에 쓰일 수 있어요. 개인정보가 있는 문자는 사진 대신 글을 복사해 위에 붙여넣어 주세요.</p>
        </div>}
        {phase === 'reading' && <div className="space-y-3" role="status">
          <p className="flex items-center gap-2 font-semibold text-app-ink"><span className="h-5 w-5 animate-spin rounded-full border-2 border-app-line border-t-app-accent-hover motion-reduce:animate-none" aria-hidden="true" />{source === 'text' ? '글에서 날짜와 시간을 AI로 찾고 있어요' : '사진에서 날짜와 시간을 찾고 있어요'}</p>
          <ul className="list-disc space-y-1 rounded-xl bg-app-soft py-2 pl-7 pr-3 text-xs text-app-ink">{source === 'text'
            ? <><li>글은 저장하지 않아요</li><li>찾은 일정은 바로 들어가지 않아요. 다음 화면에서 골라 주세요</li></>
            : <><li>사진은 저장하지 않고, 읽은 뒤 바로 지워요</li><li>위치·촬영 정보는 보내기 전에 지웠어요</li><li>찾은 일정은 바로 들어가지 않아요. 다음 화면에서 골라 주세요</li></>}</ul>
        </div>}
        {phase === 'error' && error && <div className="space-y-3" role="alert">
          <p className="text-sm font-semibold text-app-ink">{error.code === 'no_key' ? 'AI 읽기가 아직 연결되지 않았어요' : error.code === 'offline' || error.code === 'no_login' ? '지금은 쓸 수 없어요' : error.code === 'quota_exceeded' ? '오늘 AI 읽기 한도를 다 썼어요' : source === 'text' ? '글을 읽지 못했어요' : '사진을 읽지 못했어요'}</p>
          <p className="text-sm text-app-muted">{error.text}</p>
          {againButton}
        </div>}
        {phase === 'list' && rows.length === 0 && (source === 'text' ? <div className="space-y-3">
          <p className="text-sm font-semibold text-app-ink">글에서 일정을 못 찾았어요</p>
          <p className="text-sm text-app-muted">‘11월 28일 오후 2시’, ‘12/3(수) 14:00’, ‘내일 3시’처럼 날짜가 들어간 글인지 확인해 주세요.</p>
          <div className="flex flex-wrap gap-2">{editTextButton}{!aiTried && aiButton}</div>
          {!aiTried && aiNote}
        </div> : <div className="space-y-3">
          <p className="text-sm font-semibold text-app-ink">사진에서 일정을 못 찾았어요</p>
          <p className="text-sm text-app-muted">날짜와 시간이 잘 보이게 다시 찍거나, 글자가 있는 부분만 잘라서 올려 주세요.</p>
          {pickButton}
        </div>)}
        {phase === 'list' && rows.map(r => {
          const clash = overlapping(r, schedules);
          return <article key={r.key} data-photo-event className={`flex gap-2 rounded-xl border p-3 ${r.picked ? 'border-app-accent bg-app-canvas' : 'border-app-line bg-white'}`}>
            <label className="-ml-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-[#9E5873]" checked={r.picked} onChange={e => set(r.key, { picked: e.target.checked })} aria-label={`${r.title} 등록하기`} /></label>
            <div className="min-w-0 flex-1 space-y-2">
              <input className={field + ' h-10 w-full font-semibold'} value={r.title} maxLength={60} aria-label="일정 제목" onChange={e => set(r.key, { title: e.target.value })} />
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4 text-app-accent-ink" aria-hidden="true" /><span className="sr-only">날짜</span><input type="date" className={field + ' h-9'} value={r.date} onChange={e => set(r.key, { date: e.target.value })} /></label>
                {r.until && <label className="inline-flex items-center gap-1"><span className="text-xs text-app-muted">~</span><span className="sr-only">끝 날짜</span><input type="date" className={field + ' h-9'} min={r.date} value={r.until} onChange={e => set(r.key, { until: e.target.value || undefined })} /><span className="text-xs text-app-muted">{daysOf(r.date, r.until).length}일</span></label>}
                <label className="inline-flex items-center gap-1"><Clock className="h-4 w-4 text-app-accent-ink" aria-hidden="true" /><span className="sr-only">시작 시간</span><input type="time" className={field + ' h-9'} value={r.start ?? ''} onChange={e => set(r.key, { start: e.target.value || null })} /></label>
                {r.start && <label className="inline-flex items-center gap-1"><span className="text-xs text-app-muted">~</span><span className="sr-only">끝 시간</span><input type="time" className={field + ' h-9'} value={r.end ?? ''} onChange={e => set(r.key, { end: e.target.value || null })} /></label>}
                <label className="inline-flex items-center"><span className="sr-only">카테고리</span><select className={field + ' h-9'} value={r.category} onChange={e => set(r.key, { category: e.target.value })}><option value="">미분류</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              </div>
              {r.hint && r.category && <p className="text-xs text-app-muted">카테고리 추천: {r.hint}</p>}
              {r.original && <p className="flex flex-wrap items-center gap-x-2 text-xs text-app-muted">예전에 쓰던 제목으로 맞췄어요<button type="button" className="min-h-8 font-semibold text-app-accent-ink underline underline-offset-2" onClick={() => set(r.key, { title: r.original, pastTitle: r.title, original: '' })}>원래대로</button></p>}
              {r.pastTitle && <button type="button" className="min-h-8 rounded-lg bg-app-soft px-2.5 text-left text-xs text-app-ink" onClick={() => set(r.key, { title: r.pastTitle, original: r.title, pastTitle: '' })}>예전처럼 ‘{r.pastTitle}’로 쓰기</button>}
              {r.location && <p className="text-xs text-app-ink">장소: {r.location}</p>}
              {r.memo && <p className="text-xs text-app-ink">메모: {r.memo}</p>}
              {clash && <p className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />같은 시간에 ‘{clash.title}{clash.startTime ? ` ${clash.startTime}` : ''}’이 있어요</p>}
              {r.uncertain && <p className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />확인 필요: 날짜를 짐작했어요(연도·요일을 확인해 주세요)</p>}
              {r.source && <p className="break-words text-xs text-app-muted">{source === 'text' ? '붙여넣은 글' : '사진 속 글'}: “{r.source}”</p>}
            </div>
          </article>;
        })}
        {phase === 'list' && rows.length > 0 && source === 'text' && !aiTried && <div className="space-y-1 pt-1">
          <button type="button" className="min-h-11 text-sm font-semibold text-app-accent-ink underline underline-offset-4" onClick={askAi}>결과가 이상하면 AI로 다시 읽기</button>
          {aiNote}
        </div>}
        {phase === 'list' && error && <p role="alert" className="text-sm text-red-700">{error.text}</p>}
      </div>
      {phase === 'list' && rows.length > 0 && <footer className="flex shrink-0 items-center gap-2 border-t border-app-line px-4 py-3">
        {againButton}
        <span className="flex-1" />
        <button type="button" className="min-h-11 rounded-xl bg-[#9E5873] px-5 text-sm font-bold text-white disabled:bg-[#C9B8BF]" disabled={!picked.length || saving} onClick={() => { void register(); }}>{saving ? '등록하는 중…' : picked.length ? `${picked.length}개 등록` : '고른 일정 없음'}</button>
      </footer>}
    </div>
  </div>;
}
