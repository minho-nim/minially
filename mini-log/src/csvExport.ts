import { KIND_LABEL, STATUS_LABEL, type Campaign } from './Campaigns';

// 협찬·수익 기록을 엑셀에서 바로 열리는 CSV로(정산·세금 신고용). 서버에 보내지 않고 화면에서 만든다.
const HEAD = ['종류', '업체', '캠페인', '상태', '금액(원)', '마감일', '받은 날', '제공 내용', '메모', '만든 날'];

/** 엑셀이 수식으로 읽지 않게(=, +, -, @로 시작하면 앞에 ') 하고, 쉼표·따옴표·줄바꿈은 따옴표로 감싼다 */
export function csvCell(value: string | number | null | undefined) {
  let s = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function campaignsCsv(items: Campaign[]) {
  const day = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
  const rows = [...items]
    .sort((a, b) => (a.paid_on ?? a.deadline ?? day(a.created_at)).localeCompare(b.paid_on ?? b.deadline ?? day(b.created_at)))
    .map(c => [KIND_LABEL[c.kind], c.brand, c.title, STATUS_LABEL[c.status], c.amount, c.deadline, c.paid_on, c.provided, c.memo, day(c.created_at)].map(csvCell).join(','));
  return '﻿' + [HEAD.join(','), ...rows].join('\r\n') + '\r\n'; // 앞의 BOM: 엑셀에서 한글이 깨지지 않게
}

export function downloadCsv(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
