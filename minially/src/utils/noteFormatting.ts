import type {NoteDefaults} from '../types';
import {NOTE_FONTS,NOTE_LINE_HEIGHTS} from './noteRichDocument';
export const DEFAULT_NOTE_STYLE:NoteDefaults={fontFamily:'맑은 고딕',fontSize:10.5,lineHeight:1.8,color:'#3e3438',highlight:'#fff2a8'};
export function validNoteDefaults(value:unknown):value is NoteDefaults{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as NoteDefaults;
 return Object.keys(v).every(key=>['fontFamily','fontSize','lineHeight','color','highlight'].includes(key))&&(NOTE_FONTS as readonly string[]).includes(v.fontFamily)&&Number.isFinite(v.fontSize)&&v.fontSize>=8&&v.fontSize<=72&&NOTE_LINE_HEIGHTS.includes(v.lineHeight)&&[v.color,v.highlight].every(color=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color));
}
export const resolveNoteDefaults=(value:unknown):NoteDefaults=>({...validNoteDefaults(value)?value:DEFAULT_NOTE_STYLE});
export function validateNoteDefaults(value:unknown){if(!validNoteDefaults(value))throw new Error('메모 기본 서식이 올바르지 않습니다.');}
export const THEME_COLORS=['#3e3438','#8d8990','#cf8fa8','#b4a2d3','#94bed9','#9fc4b1','#f5d9aa','#e8b9a7'];
export const STANDARD_COLORS=['#000000','#ffffff','#c03030','#ed7d31','#ffff00','#00b050','#00b0f0','#0070c0','#7030a0','#ff00ff'];
export function colorShade(hex:string,ratio:number){const target=ratio>=0?255:0;return '#'+[1,3,5].map(at=>Math.round(parseInt(hex.slice(at,at+2),16)*(1-Math.abs(ratio))+target*Math.abs(ratio)).toString(16).padStart(2,'0')).join('');}
