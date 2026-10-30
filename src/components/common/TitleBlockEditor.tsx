import React, { useId } from 'react';
import { GripVertical, X, Plus } from 'lucide-react';
import { TitleBlock } from '../../types';
import { useDragOrder } from '../../hooks/useDragOrder';

export function TitleBlockEditor({ blocks, onChange, word, onWordChange, editable = false, hideWordInput = false, compact = false, purpose = 'title' }: { blocks: TitleBlock[]; onChange: (blocks: TitleBlock[]) => void; word: string; onWordChange: (word: string) => void; editable?: boolean; hideWordInput?: boolean; compact?: boolean; purpose?: 'title' | 'preset' }) {
  const helpId = useId();
  const drag = useDragOrder(blocks.map(b => b.id), ids => onChange(ids.map(id => blocks.find(b => b.id === id)!)));
  const add = () => { if (!word.trim()) return; onChange([...blocks, { id: crypto.randomUUID(), text: word.trim() }]); onWordChange(''); };
  return <div className={compact ? "title-blocks-compact space-y-1" : "space-y-2"}>
    <p id={helpId} className={compact ? "sr-only" : "text-xs text-[#85777D]"}>프리셋을 눌러 조합하세요. 손잡이를 끌거나 방향키로 순서를 바꿀 수 있습니다.</p>
    <div ref={drag.rootRef} role="list" aria-label={purpose === 'preset' ? '프리셋 블록' : '제목 블록'} className={compact ? "flex flex-wrap gap-1.5" : "flex flex-wrap gap-2 min-h-14 p-2 bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl"}>
      {!blocks.length && <p className="text-xs text-[#85777D] self-center px-1">선택한 프리셋이 여기에 모입니다.</p>}
      {blocks.map((block, index) => <div key={block.id} role="listitem" {...drag.itemProps(block.id)} className="flex items-center min-w-0 max-w-full rounded-lg bg-[#F6E8ED] border border-[#E9CDD8]">
        <button type="button" {...drag.handleProps(block.id)} aria-label={block.text + ' 블록 이동'} aria-describedby={helpId} className={compact ? "px-1 cursor-grab active:cursor-grabbing" : "px-1.5 min-w-11 cursor-grab active:cursor-grabbing"}><GripVertical className="w-4 h-4 text-[#AD728B]" /></button>
        {editable ? <><span aria-hidden="true" className="sr-only">{block.text}</span><input aria-label={`${index + 1}번째 블록 내용`} title={block.text} value={block.text} onChange={e => onChange(blocks.map((b, i) => i === index ? { ...b, text: e.target.value } : b))} className="min-w-0 text-sm bg-transparent px-1" style={{ width: compact ? Math.min(160, Math.max(28, block.text.length * 16 + 8)) : Math.min(180, Math.max(72, block.text.length * 14)) }} /></> : <span className="text-sm text-[#3E3438] break-words min-w-0 py-2">{block.text}</span>}<button type="button" aria-label={block.text + ' 블록 제거'} className={compact ? "px-1" : "px-2 min-w-11"} onClick={() => onChange(blocks.filter((_, i) => i !== index))}><X className="w-3.5 h-3.5" /></button>
      </div>)}
    </div>
    {!hideWordInput && <div className="flex gap-2"><input aria-label="단어 추가" placeholder="직접 단어 추가" value={word} onChange={e => onWordChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }} className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-[#F0E7EB] text-sm" /><button type="button" disabled={!word.trim()} aria-label={purpose === 'preset' ? '프리셋에 단어 추가' : '제목에 단어 추가'} onClick={add} className="px-3 rounded-lg bg-[#F6E8ED] disabled:opacity-40"><Plus className="w-4 h-4" /></button></div>}
    <p role="status" aria-label={purpose === 'preset' ? '완성된 프리셋' : '완성된 제목'} className={compact ? "sr-only" : "text-sm break-words text-[#3E3438]"}>{[...blocks.map(b => b.text), word.trim()].filter(Boolean).join(' ') || (purpose === 'preset' ? '프리셋 단어를 조합해 주세요' : '제목을 조합해 주세요')}</p>
  </div>;
}
