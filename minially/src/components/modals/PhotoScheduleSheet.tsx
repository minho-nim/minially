// 사진·글로 일정 넣기: 사진 고르기 또는 글 붙여넣기 → (읽는 중) → 찾은 일정 고르기(고치기·겹침·확인 필요) → 고른 것만 등록.
// 글은 이 기기 안에서 규칙으로 읽고, 못 찾았을 때 사람이 누를 때만 AI로 보낸다. 사진은 AI로 읽되 저장하지 않는다.
// 등록은 App이 한 번에 하고 되돌리기도 한 번에 된다.
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Clock, ImagePlus, Repeat2, Sparkles, TextSearch, X } from 'lucide-react';
import type { CategoryItem, RecurrenceRule, Schedule } from '../../types';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { getTodayDateString } from '../../utils/dateHelpers';
import { checkPhotoConnection, overlapping, PhotoReadError, readGoogleCalendar, readPhotoSchedule, readTextScheduleWithAi, savedGoogleUrl, saveGoogleUrl, shrinkForReading, type AiCheck, type PhotoEvent } from '../../utils/photoSchedule';
import { parseScheduleText, TEXT_LIMIT } from '../../utils/textSchedule';
import { historyHint, rejectKey, type HistoryHint } from '../../utils/scheduleSuggest';
import { readMarks, type MarkKind } from '../../utils/readMarks';

/** hint: 카테고리를 고른 이유, pastTitle: 예전에 쓴 비슷한 제목, original: 예전 제목으로 바꾸기 전 제목(되돌리기용),
 *  borrowed: 예전 같은 일정에서 채운 칸, duplicate: 같은 날 이미 있는 일정, cadence: 예전 반복 간격(반복 제안), repeatOn: 반복으로 등록 */
interface Row extends PhotoEvent { key: string; picked: boolean; category: string; hint: string; pastTitle: string; original: string; borrowed: string[]; reminderMinutes?: number | null; duplicate: string; cadence?: HistoryHint['cadence']; repeatOn: boolean }
interface Props {
  open: boolean; file?: Blob | null; text?: string | null; categories: CategoryItem[]; schedules: Schedule[];
  /** 사람이 '원래대로'로 되돌린 제목 바꾸기(계정 설정에 기억, 다음부터 자동으로 바꾸지 않음) */
  rejected?: string[]; onReject?: (key: string) => void;
  onClose: () => void; onAdd: (list: Schedule[], rules: RecurrenceRule[]) => Promise<void>;
}
const DAY_NAMES = '일월화수목금토';
/** 구글 캘린더 가져오기: 소유자 결정(2026-11-28)으로 미니어리 화면에서는 뺌(구글 일정은 미니로그에서 봄). 코드는 남겨 둠 */
const SHOW_GOOGLE_IMPORT = false;
const MAX_PHOTOS = 3;

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

export function PhotoScheduleSheet({ open, file, text, categories, schedules, rejected = [], onReject, onClose, onAdd }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'pick' | 'reading' | 'list' | 'error'>('pick');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<{ text: string; code: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasted, setPasted] = useState('');
  const [source, setSource] = useState<'photo' | 'text' | 'google'>('photo');
  const [googleUrl, setGoogleUrl] = useState(savedGoogleUrl);
  const [aiTried, setAiTried] = useState(false);
  const [check, setCheck] = useState<AiCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const run = useRef(0);
  const close = () => { if (saving) return false; run.current += 1; onClose(); };
  useScheduleDialog(open, false, root, close, close);

  // 내 예전 일정을 보고 카테고리를 정하고, 같은 일정이면 예전 제목·시간·장소·알림을 채운다(이 기기 안에서만).
  // 비슷하기만 한 일정(교정 상담 ↔ 정기검진)은 제목·시간을 바꾸지 않는다. 같은 날 이미 있으면 체크를 꺼 둔다.
  const show = (events: PhotoEvent[]) => {
    setRows(events.map((e, i) => {
      const h = historyHint(e, schedules, categories, { rejected });
      const b = h.match === 'same' ? h.borrow ?? {} : {};
      const borrowed: string[] = [];
      let { start, end, location } = e;
      if (!start && b.start) { start = b.start; borrowed.push('시작 시각'); }
      if (start && !end && b.end) { end = b.end; borrowed.push('끝 시각'); }
      if (!location && b.location) { location = b.location; borrowed.push('장소'); }
      if (b.reminderMinutes !== undefined) borrowed.push('알림');
      return { ...e, start, end, location, key: `${i}-${e.date}-${e.title}`, picked: !e.uncertain && !h.duplicate, category: h.category, hint: h.reason, title: h.habit ? h.pastTitle : e.title, pastTitle: h.habit ? '' : h.pastTitle, original: h.habit ? e.title : '', borrowed, ...(b.reminderMinutes !== undefined ? { reminderMinutes: b.reminderMinutes } : {}), duplicate: h.duplicate ?? '', cadence: e.repeat ? undefined : h.cadence, repeatOn: Boolean(e.repeat) };
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
  /** 사진 여러 장(3장까지)을 차례로 읽어 후보를 합친다(같은 날·시간·제목은 한 번만) */
  const read = (blobs: Blob[]) => { setSource('photo'); return ask(async () => {
    const all: PhotoEvent[] = [];
    for (const blob of blobs.slice(0, MAX_PHOTOS)) all.push(...await readPhotoSchedule(await shrinkForReading(blob), getTodayDateString()));
    const seen = new Set<string>();
    return all.filter(e => { const k = `${e.date}|${e.start}|${e.title}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
  }, '사진'); };
  /** 글은 이 기기 안에서 규칙으로만 읽는다(서버·AI로 보내지 않음) */
  const findInText = (value = pasted) => { run.current += 1; setSource('text'); setAiTried(false); setError(null); show(parseScheduleText(value, getTodayDateString())); };
  const askAi = () => { setAiTried(true); void ask(() => readTextScheduleWithAi(pasted.trim(), getTodayDateString()), '글'); };
  /** 구글 캘린더(iCal 비공개 주소)에서 다가오는 일정을 후보로. 주소는 이 기기에만 기억한다 */
  const readGoogle = () => { const url = googleUrl.trim(); if (!url) return; saveGoogleUrl(url); setSource('google'); void ask(() => readGoogleCalendar(url, getTodayDateString()), '구글 캘린더'); };

  useEffect(() => {
    if (!open) return;
    setRows([]); setError(null); setSaving(false); setAiTried(false);
    setPasted(text ?? '');
    if (file) void read([file]); else if (text?.trim()) findInText(text); else { setSource('photo'); setPhase('pick'); }
    return () => { run.current += 1; };
  }, [open, file, text]);

  if (!open) return null;
  const set = (key: string, patch: Partial<Row>) => setRows(list => list.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const picked = rows.filter(r => r.picked && r.title.trim() && r.date);

  async function register() {
    if (!picked.length) return;
    setSaving(true);
    try {
      // 여러 날 일정(until)은 날마다 같은 일정을 만든다(달력이 이어진 한 줄로 그림, 최대 14일).
      // 반복 일정(매주 화·목·격주·매일·매달)은 첫 날 일정 하나와 반복 규칙으로 넣는다
      const rules: RecurrenceRule[] = [];
      const make = (r: Row, date: string, extra: Partial<Schedule> = {}) => ({
        id: crypto.randomUUID(), title: r.title.trim(), date, ...(r.start ? { startTime: r.start } : {}), ...(r.start && r.end ? { endTime: r.end } : {}),
        category: r.category, completed: false, ...(r.location || r.memo ? { memo: [r.location && `장소: ${r.location}`, r.memo].filter(Boolean).join('\n') } : {}),
        ...(r.reminderMinutes !== undefined ? { reminderMinutes: r.reminderMinutes } : {}), ...extra,
      } as Schedule);
      await onAdd(picked.flatMap(r => {
        if (r.repeat && r.repeatOn) {
          const s = make(r, r.date);
          const rule: RecurrenceRule = { id: crypto.randomUUID(), scheduleId: s.id, frequency: r.repeat.frequency, interval: r.repeat.interval, ...(r.repeat.weekdays ? { weekdays: r.repeat.weekdays } : {}), startDate: r.date };
          rules.push(rule);
          return [{ ...s, recurrenceRuleId: rule.id }];
        }
        return daysOf(r.date, r.until).map(date => make(r, date));
      }), rules);
      setSaving(false);
      onClose();
    } catch (e) { setSaving(false); setError({ text: e instanceof Error ? e.message : '등록하지 못했어요.', code: 'save' }); }
  }

  const runCheck = async () => { setChecking(true); setCheck(null); try { setCheck(await checkPhotoConnection()); } finally { setChecking(false); } };
  // 연결 확인: 사진 읽기가 안 될 때 어디서 막혔는지(코드·키·구글 AI) 한 번에 보여 준다
  const checkBox = <div className="space-y-1.5">
    <button type="button" className="min-h-9 text-xs font-semibold text-app-accent-ink underline underline-offset-4" disabled={checking} aria-busy={checking} onClick={() => { void runCheck(); }}>{checking ? 'AI 연결 확인 중…' : 'AI 연결 확인'}</button>
    {check && <p role="status" aria-label="AI 연결 확인 결과" className={`rounded-lg px-2.5 py-2 text-xs ${check.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>{check.ok ? '✓ ' : '! '}{check.message}</p>}
  </div>;
  const pickButton = <button type="button" className="min-h-11 rounded-xl border border-app-accent bg-app-soft px-4 text-sm font-semibold text-app-accent-ink" onClick={() => input.current?.click()}><ImagePlus className="mr-1 inline h-4 w-4" aria-hidden="true" />{phase === 'pick' ? '사진 고르기' : '다른 사진'}</button>;
  const editTextButton = <button type="button" className="min-h-11 rounded-xl border border-app-accent bg-app-soft px-4 text-sm font-semibold text-app-accent-ink" onClick={() => { run.current += 1; setError(null); setPhase('pick'); }}>{source === 'google' ? '주소 고치기' : '글 고치기'}</button>;
  const againButton = source === 'photo' ? pickButton : editTextButton;
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
      <input ref={input} type="file" accept="image/*" multiple className="hidden" aria-label="일정이 적힌 사진" onChange={e => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) void read(fs); }} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {phase === 'pick' && <div className="space-y-3">
          <form className="space-y-2" onSubmit={e => { e.preventDefault(); if (pasted.trim()) findInText(); }}>
            <label htmlFor="photo-schedule-text" className="block text-sm font-semibold text-app-ink">문자·메일 붙여넣기</label>
            <textarea id="photo-schedule-text" rows={4} maxLength={TEXT_LIMIT} value={pasted} onChange={e => setPasted(e.target.value)} placeholder={'예) [OO치과] 11월 28일(토) 오후 2시 30분 진료 예약되었습니다.'} className="w-full resize-y rounded-xl border border-app-line bg-white p-3 text-base text-app-ink placeholder:text-app-muted sm:text-sm" />
            <button type="submit" disabled={!pasted.trim()} className="min-h-11 rounded-xl bg-[#9E5873] px-4 text-sm font-bold text-white disabled:bg-[#C9B8BF]"><TextSearch className="mr-1 inline h-4 w-4" aria-hidden="true" />글에서 찾기</button>
            <p className="text-xs text-app-muted">글은 이 기기 안에서만 읽고, 어디로도 보내지 않아요.</p>
          </form>
          <div className="flex items-center gap-2 text-xs text-app-muted" aria-hidden="true"><span className="h-px flex-1 bg-app-line" />또는<span className="h-px flex-1 bg-app-line" /></div>
          <p className="text-sm text-app-ink">예약 문자·공지·포스터 사진을 고르면(3장까지) 날짜와 시간을 찾아 일정 후보로 보여 줘요. 고른 것만 등록돼요.</p>
          {pickButton}
          {SHOW_GOOGLE_IMPORT && <><div className="flex items-center gap-2 text-xs text-app-muted" aria-hidden="true"><span className="h-px flex-1 bg-app-line" />또는<span className="h-px flex-1 bg-app-line" /></div>
          <form className="space-y-2" onSubmit={e => { e.preventDefault(); readGoogle(); }}>
            <label htmlFor="google-ics" className="block text-sm font-semibold text-app-ink"><CalendarDays className="mr-1 inline h-4 w-4" aria-hidden="true" />구글 캘린더에서 가져오기</label>
            <input id="google-ics" type="url" inputMode="url" autoComplete="off" spellCheck={false} value={googleUrl} onChange={e => setGoogleUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" className="min-h-11 w-full rounded-xl border border-app-line bg-white px-3 text-base text-app-ink placeholder:text-app-muted sm:text-sm" />
            <button type="submit" disabled={!googleUrl.trim()} className="min-h-11 rounded-xl border border-app-accent bg-app-soft px-4 text-sm font-semibold text-app-accent-ink disabled:opacity-50">다가오는 일정 가져오기</button>
            <p className="text-xs text-app-muted">구글 캘린더 → 설정 → 내 캘린더 → 캘린더 통합의 ‘iCal 형식의 비공개 주소’를 붙여 넣어요. 앞으로 90일 일정만 읽고, 고른 것만 등록돼요. 주소는 이 기기에만 기억하고(남에게 알려 주지 마세요) 서버에 저장하지 않아요.</p>
          </form></>}
          <p className="rounded-xl bg-app-soft p-3 text-xs text-app-ink">사진은 구글 무료 AI(Gemini)로 읽어요. 무료 AI에 보낸 내용은 구글 서비스 개선에 쓰일 수 있어요. 개인정보가 있는 문자는 사진 대신 글을 복사해 위에 붙여넣어 주세요.</p>
          {checkBox}
        </div>}
        {phase === 'reading' && <div className="space-y-3" role="status">
          <p className="flex items-center gap-2 font-semibold text-app-ink"><span className="h-5 w-5 animate-spin rounded-full border-2 border-app-line border-t-app-accent-hover motion-reduce:animate-none" aria-hidden="true" />{source === 'google' ? '구글 캘린더에서 다가오는 일정을 읽고 있어요' : source === 'text' ? '글에서 날짜와 시간을 AI로 찾고 있어요' : '사진에서 날짜와 시간을 찾고 있어요'}</p>
          <ul className="list-disc space-y-1 rounded-xl bg-app-soft py-2 pl-7 pr-3 text-xs text-app-ink">{source === 'google'
            ? <><li>구글 캘린더는 읽기만 하고 바꾸지 않아요</li><li>찾은 일정은 바로 들어가지 않아요. 다음 화면에서 골라 주세요</li></>
            : source === 'text'
            ? <><li>글은 저장하지 않아요</li><li>찾은 일정은 바로 들어가지 않아요. 다음 화면에서 골라 주세요</li></>
            : <><li>사진은 저장하지 않고, 읽은 뒤 바로 지워요</li><li>위치·촬영 정보는 보내기 전에 지웠어요</li><li>찾은 일정은 바로 들어가지 않아요. 다음 화면에서 골라 주세요</li></>}</ul>
        </div>}
        {phase === 'error' && error && <div className="space-y-3" role="alert">
          <p className="text-sm font-semibold text-app-ink">{error.code === 'no_key' ? 'AI 읽기가 아직 연결되지 않았어요' : error.code === 'offline' || error.code === 'no_login' ? '지금은 쓸 수 없어요' : error.code === 'quota_exceeded' ? '오늘 AI 읽기 한도를 다 썼어요' : source === 'google' ? '구글 캘린더를 읽지 못했어요' : source === 'text' ? '글을 읽지 못했어요' : '사진을 읽지 못했어요'}</p>
          <p className="text-sm text-app-muted">{error.text} <span className="text-xs">(오류 이름: {error.code})</span></p>
          {againButton}
          {checkBox}
        </div>}
        {phase === 'list' && rows.length === 0 && (source === 'google' ? <div className="space-y-3">
          <p className="text-sm font-semibold text-app-ink">앞으로 90일 동안 가져올 일정이 없어요</p>
          <p className="text-sm text-app-muted">구글 캘린더에 일정이 있는데 안 보이면, 주소가 그 캘린더의 ‘비공개 주소’인지 확인해 주세요.</p>
          {editTextButton}
        </div> : source === 'text' ? <div className="space-y-3">
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
              {r.original && <p className="flex flex-wrap items-center gap-x-2 text-xs text-app-muted">예전에 쓰던 제목으로 맞췄어요<button type="button" className="min-h-8 font-semibold text-app-accent-ink underline underline-offset-2" onClick={() => { onReject?.(rejectKey(r.original, r.title)); set(r.key, { title: r.original, pastTitle: r.title, original: '' }); }}>원래대로</button></p>}
              {r.pastTitle && <button type="button" className="min-h-8 rounded-lg bg-app-soft px-2.5 text-left text-xs text-app-ink" onClick={() => set(r.key, { title: r.pastTitle, original: r.title, pastTitle: '' })}>예전처럼 ‘{r.pastTitle}’로 쓰기</button>}
              {r.repeat && <label className="flex flex-wrap items-center gap-2 text-xs text-app-ink"><input type="checkbox" className="h-4 w-4 accent-[#9E5873]" checked={r.repeatOn} onChange={e => set(r.key, { repeatOn: e.target.checked })} aria-label={`${r.title} 반복으로 등록`} /><Repeat2 className="h-3.5 w-3.5 text-app-accent-ink" aria-hidden="true" />반복: {r.repeat.label}{r.repeatOn ? ' (첫 날부터 이어서)' : ' — 끄면 이 날 하루만'}</label>}
              {r.cadence && <button type="button" className="min-h-8 rounded-lg bg-app-soft px-2.5 text-left text-xs text-app-ink" onClick={() => set(r.key, { repeat: { frequency: 'weekly', interval: r.cadence!.days / 7, weekdays: [new Date(`${r.date}T00:00:00Z`).getUTCDay()], label: `${r.cadence!.label} ${DAY_NAMES[new Date(`${r.date}T00:00:00Z`).getUTCDay()]}` }, repeatOn: true, cadence: undefined })}>예전처럼 {r.cadence.label} 반복으로 넣기</button>}
              {r.borrowed.length > 0 && <p className="text-xs text-app-muted">예전 같은 일정 기준으로 채웠어요: {r.borrowed.join('·')}</p>}
              {r.duplicate && <p className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />같은 날 ‘{r.duplicate}’이 이미 있어요(체크를 꺼 뒀어요)</p>}
              {r.location && <p className="text-xs text-app-ink">장소: {r.location}</p>}
              {r.memo && <p className="text-xs text-app-ink">메모: {r.memo}</p>}
              {clash && <p className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />같은 시간에 ‘{clash.title}{clash.startTime ? ` ${clash.startTime}` : ''}’이 있어요</p>}
              {r.guessed && <p className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />확인 필요: 오전·오후가 없어 오후로 짐작했어요</p>}
              {r.uncertain && !r.guessed && <p className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />확인 필요: 날짜를 짐작했어요(연도·요일·'몇 주 뒤'를 확인해 주세요)</p>}
              {r.source && source !== 'google' && <ReadSource source={r.source} title={r.original || r.title} location={r.location} label={source === 'text' ? '붙여넣은 글' : '사진 속 글'} />}
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

// 원문을 어떻게 읽었는지(알고리즘 시각화 도구처럼 지금 읽은 곳을 색으로): 날짜·시간·장소·제목에 색, 누르면 고치는 칸으로.
const MARK: Record<MarkKind, { label: string; as: string; cls: string; field?: string }> = {
  date: { label: '날짜', as: '날짜로', cls: 'bg-sky-100 text-sky-900 decoration-sky-500', field: 'input[type=date]' },
  time: { label: '시간', as: '시간으로', cls: 'bg-amber-100 text-amber-900 decoration-amber-500', field: 'input[type=time]' },
  place: { label: '장소', as: '장소로', cls: 'bg-emerald-100 text-emerald-900 decoration-emerald-500' },
  title: { label: '제목', as: '제목으로', cls: 'bg-pink-100 text-pink-900 decoration-pink-500', field: 'input[aria-label="일정 제목"]' },
};
function ReadSource({ source, title, location, label }: { source: string; title: string; location?: string; label: string }) {
  const parts = readMarks(source, { title, location });
  const used = [...new Set(parts.map(p => p.kind).filter((k): k is MarkKind => !!k))];
  const focus = (el: HTMLElement, sel?: string) => { const input = sel ? el.closest('article')?.querySelector<HTMLInputElement>(sel) : null; input?.focus(); };
  return <div className="space-y-1" data-read-source>
    <p className="break-words text-xs leading-6 text-app-muted"><span>{label}: “</span>{parts.map((p, i) => {
      if (!p.kind) return <span key={i}>{p.text}</span>;
      const m = MARK[p.kind];
      return m.field
        ? <button key={i} type="button" data-mark={p.kind} className={`rounded px-0.5 font-semibold underline decoration-2 underline-offset-2 ${m.cls}`} title={`${m.as} 읽었어요 · 눌러서 고치기`} aria-label={`${m.as} 읽은 ‘${p.text}’ 고치기`} onClick={e => focus(e.currentTarget, m.field)}>{p.text}</button>
        : <mark key={i} data-mark={p.kind} className={`rounded px-0.5 font-semibold underline decoration-2 underline-offset-2 ${m.cls}`} title={`${m.as} 읽었어요`}>{p.text}</mark>;
    })}<span>”</span></p>
    {used.length > 0 && <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-app-muted" aria-label="색 설명">{used.map(k => <span key={k} className="inline-flex items-center gap-1"><i className={`inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-inset ring-black/15 ${MARK[k].cls}`} aria-hidden="true" />{MARK[k].label}</span>)}<span>· 색 글자를 누르면 고치는 칸으로</span></p>}
  </div>;
}
