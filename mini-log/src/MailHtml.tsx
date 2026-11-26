import { createElement, type CSSProperties, type ReactNode } from 'react';

// 받은 메일 HTML을 보기 좋게: template에서 읽어 허용한 태그·속성·스타일만 React 요소로 다시 그린다(innerHTML로 넣지 않음).
// 스크립트·폼·iframe은 버리고, 바깥 이미지(열람 추적에 쓰임)는 [이미지]로만 표시한다. 링크는 https·mailto만 새 창으로.
const TAGS: Record<string, string> = {
  p: 'p', div: 'div', center: 'div', section: 'div', article: 'div', header: 'div', footer: 'div', main: 'div', br: 'br', hr: 'hr', span: 'span', font: 'span',
  b: 'b', strong: 'strong', i: 'i', em: 'em', u: 'u', s: 's', strike: 's', del: 's', small: 'small', sub: 'sub', sup: 'sup', code: 'code', pre: 'pre',
  a: 'a', ul: 'ul', ol: 'ol', li: 'li', h1: 'h3', h2: 'h3', h3: 'h4', h4: 'h4', h5: 'h4', h6: 'h4', blockquote: 'blockquote',
  table: 'table', thead: 'thead', tbody: 'tbody', tfoot: 'tfoot', tr: 'tr', td: 'td', th: 'th', caption: 'caption',
};
const DROP = new Set(['script', 'style', 'head', 'title', 'meta', 'link', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'svg', 'math', 'video', 'audio', 'noscript', 'template']);
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i;
const LENGTH = /^(\d{1,3}(\.\d+)?)(px|pt|em|rem|%)$/;
const STYLES: Record<string, (v: string) => string | null> = {
  color: v => (COLOR.test(v) ? v : null),
  backgroundColor: v => (COLOR.test(v) ? v : null),
  fontWeight: v => (/^(bold|bolder|normal|[1-9]00)$/.test(v) ? v : null),
  fontStyle: v => (/^(italic|normal)$/.test(v) ? v : null),
  textDecoration: v => (/^(underline|line-through|none)( solid)?$/.test(v) ? v : null),
  textAlign: v => (/^(left|right|center|justify)$/.test(v) ? v : null),
  fontSize: v => { const m = v.match(LENGTH); return m && (m[3] !== 'px' || Number(m[1]) <= 40) && (m[3] !== 'pt' || Number(m[1]) <= 30) ? v : null; },
  lineHeight: v => (/^(\d(\.\d+)?|normal|\d{1,2}px)$/.test(v) ? v : null),
};
const CSS_NAME: Record<string, string> = { color: 'color', backgroundColor: 'background-color', fontWeight: 'font-weight', fontStyle: 'font-style', textDecoration: 'text-decoration', textAlign: 'text-align', fontSize: 'font-size', lineHeight: 'line-height' };
const FONT_SIZE = ['', '10px', '12px', '14px', '16px', '20px', '24px', '30px'];

function styleOf(el: Element): CSSProperties | undefined {
  const style: Record<string, string> = {};
  const css = (el as HTMLElement).style;
  if (css) for (const [key, check] of Object.entries(STYLES)) {
    const v = css.getPropertyValue(CSS_NAME[key]).trim().toLowerCase();
    const ok = v ? check(v) : null;
    if (ok) style[key] = ok;
  }
  if (el.tagName === 'FONT') {
    const color = el.getAttribute('color')?.trim() ?? '';
    if (COLOR.test(color)) style.color = color;
    const size = Number(el.getAttribute('size'));
    if (size >= 1 && size <= 7) style.fontSize = FONT_SIZE[size];
  }
  const align = el.getAttribute('align')?.toLowerCase();
  if (align && STYLES.textAlign(align)) style.textAlign = align;
  return Object.keys(style).length ? (style as CSSProperties) : undefined;
}

function convert(node: Node, budget: { left: number }, depth: number, key: number): ReactNode {
  if (budget.left-- <= 0 || depth > 40) return null;
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const name = el.tagName.toLowerCase();
  if (DROP.has(name)) return null;
  if (name === 'img') {
    const alt = (el.getAttribute('alt') ?? '').trim().slice(0, 40);
    return createElement('span', { key, className: 'mail-img' }, alt ? `[이미지: ${alt}]` : '[이미지]');
  }
  const kids = Array.from(el.childNodes).map((c, i) => convert(c, budget, depth + 1, i));
  const tag = TAGS[name];
  if (!tag) return kids.length ? createElement('span', { key }, kids) : null; // 모르는 태그는 글만 살린다
  const props: Record<string, unknown> = { key, style: styleOf(el) };
  if (tag === 'a') {
    const href = (el.getAttribute('href') ?? '').trim();
    if (/^(https:\/\/|mailto:)/i.test(href)) Object.assign(props, { href, target: '_blank', rel: 'noopener noreferrer' });
  }
  if (tag === 'td' || tag === 'th') for (const attr of ['colspan', 'rowspan'] as const) {
    const n = Number(el.getAttribute(attr));
    if (Number.isInteger(n) && n > 1 && n <= 20) props[attr === 'colspan' ? 'colSpan' : 'rowSpan'] = n;
  }
  if (tag === 'br' || tag === 'hr') return createElement(tag, { key });
  return createElement(tag, props, kids.length ? kids : undefined);
}

/** 받은 HTML → 안전한 React 요소(노드 5,000개·깊이 40까지) */
export function SafeMailHtml({ html }: { html: string }) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html; // template 안의 내용은 실행·로드되지 않는다(읽기만 하고 아래에서 허용한 것만 다시 그림)
  const budget = { left: 5000 };
  return <div className="mail-html">{Array.from(tpl.content.childNodes).map((n, i) => convert(n, budget, 0, i))}</div>;
}
