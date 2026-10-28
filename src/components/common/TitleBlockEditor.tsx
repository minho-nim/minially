import React, { useId } from 'react';
import { GripVertical, X, Plus } from 'lucide-react';
import { TitleBlock } from '../../types';
import { useDragOrder } from '../../hooks/useDragOrder';

export function TitleBlockEditor({ blocks, onChange, word, onWordChange }: { blocks: TitleBlock[]; onChange: (blocks: TitleBlock[]) => void; word: string; onWordChange: (word: string) => void }) {
  const helpId = useId();
  const drag = useDragOrder(blocks.map(b => b.id), ids => onChange(ids.map(id => blocks.find(b => b.id === id)!)));
  const add = () => { if (!word.trim()) return; onChange([...blocks, { id: crypto.randomUUID(), text: word.trim() }]); onWordChange(''); };
  return <div className="space-y-2">
    <p id={helpId} className="text-xs text-[#85777D]">프리셋을 눌러 조합하세요. 손잡이를 끌거나 방향키로 순서를 바꿀 수 있습니다.</p>
    <div ref={drag.rootRef} role="list" aria-label="제목 블록" className="flex flex-wrap gap-2 min-h-14 p-2 bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl">
      {!blocks.length && <p className="text-xs text-[#85777D] self-center px-1">선택한 프리셋이 여기에 모입니다.</p>}
      {blocks.map((block, index) => <div key={block.id} role="listitem" {...drag.itemProps(block.id)} className="flex items-center min-w-0 max-w-full rounded-lg bg-[#F6E8ED] border border-[#E9CDD8]">
        <button type="button" {...drag.handleProps(block.id)} aria-label={block.text + ' 블록 이동'} aria-describedby={helpId} className="px-1.5 min-w-11 cursor-grab active:cursor-grabbing"><GripVertical className="w-4 h-4 text-[#AD728B]" /></button>
        <span className="text-sm text-[#3E3438] break-words min-w-0 py-2">{block.text}</span><button type="button" aria-label={block.text + ' 블록 제거'} className="px-2 min-w-11" onClick={() => onChange(blocks.filter((_, i) => i !== index))}><X className="w-3.5 h-3.5" /></button>
      </div>)}
    </div>
    <div className="flex gap-2"><input aria-label="단어 추가" placeholder="직접 단어 추가" value={word} onChange={e => onWordChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }} className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-[#F0E7EB] text-sm" /><button type="button" disabled={!word.trim()} aria-label="제목에 단어 추가" onClick={add} className="px-3 rounded-lg bg-[#F6E8ED] disabled:opacity-40"><Plus className="w-4 h-4" /></button></div>
    <p role="status" aria-label="완성된 제목" className="text-sm break-words text-[#3E3438]">{[...blocks.map(b => b.text), word.trim()].filter(Boolean).join(' ') || '제목을 조합해 주세요'}</p>
  </div>;
}
