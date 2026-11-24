// 광고 수익 CSV(애드센스·애드포스트 보고서) 읽기: 날짜 칸과 수익 칸을 머리글로 찾아 달마다 더한다.
// 지원: 쉼표·탭 구분, 따옴표, BOM, '₩1,234'·'1,234.5' 같은 숫자, 날짜 2026-11-03·2026. 11. 3.·2026/11/03·2026-11(월 보고서).
export type AdSource = 'adsense' | 'adpost' | 'other';
export const AD_SOURCE_LABEL: Record<AdSource, string> = { adsense: '애드센스', adpost: '애드포스트', other: '기타 광고' };

function splitLine(line: string, sep: string) {
  const out: string[] = []; let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') quoted = false; else cur += c; }
    else if (c === '"') quoted = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out.map(v => v.trim());
}

const DATE_HEAD = /^(날짜|일자|기간|월|date|day|month)$/i;
const MONEY_HEAD = /(예상\s*수입|예상\s*수익|수입|수익|earnings|revenue|금액)/i;

function monthOf(value: string) {
  const m = value.match(/(20\d{2})\s*[-./년]\s*(\d{1,2})/);
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? `${m[1]}-${String(month).padStart(2, '0')}` : null;
}
const money = (value: string) => { const n = Number(value.replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null; };

/** CSV 글 → 달마다 수익 합계(원, 반올림). 찾지 못하면 이유를 돌려준다. */
export function parseAdCsv(text: string): { months: { month: string; amount: number }[]; rows: number; skipped: number } | string {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return '내용이 없는 파일이에요.';
  const sep = lines[0].includes('\t') ? '\t' : ',';
  // 보고서 위쪽 설명 줄을 건너뛰고 머리글 줄 찾기
  const headerIndex = lines.findIndex(l => { const cells = splitLine(l, sep); return cells.some(c => DATE_HEAD.test(c)) && cells.some(c => MONEY_HEAD.test(c)); });
  if (headerIndex < 0) return '날짜와 수익(예상 수입) 칸을 찾지 못했어요. 보고서를 CSV로 받아 그대로 올려 주세요.';
  const head = splitLine(lines[headerIndex], sep);
  const dateCol = head.findIndex(c => DATE_HEAD.test(c)), moneyCol = head.findIndex(c => MONEY_HEAD.test(c));
  const sums = new Map<string, number>(); let rows = 0, skipped = 0;
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = splitLine(line, sep), month = monthOf(cells[dateCol] ?? ''), amount = money(cells[moneyCol] ?? '');
    if (!month || amount === null) { skipped++; continue; } // 합계·빈 줄 등
    sums.set(month, (sums.get(month) ?? 0) + amount); rows++;
  }
  if (!rows) return '읽을 수 있는 날짜·수익 줄이 없어요.';
  return { months: [...sums].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount: Math.max(0, Math.round(amount)) })), rows, skipped };
}
