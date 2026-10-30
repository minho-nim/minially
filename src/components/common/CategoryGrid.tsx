import { CategoryItem } from '../../types';

export function CategoryGrid({categories,value,onChange}:{categories:CategoryItem[];value:string;onChange:(id:string)=>void}) {
  return <div role="group" aria-label="카테고리 목록" className="grid grid-cols-6 gap-1.5 min-w-0">
    {categories.map(category=><button key={category.id} type="button" title={category.name} aria-label={category.name} aria-pressed={value===category.id} onClick={()=>onChange(value===category.id?'':category.id)} className={'min-w-0 min-h-14 px-1 py-2 rounded-lg border flex flex-col items-center justify-center gap-1 text-[11px] '+(value===category.id?'border-[#CF8FA8] bg-[#F6E8ED] text-[#8F526C]':'border-[#F0E7EB] bg-white text-[#3E3438]')}><span className="w-3 h-3 rounded-full shrink-0" style={{background:category.color}}/><span className="truncate w-full">{category.name}</span></button>)}
  </div>;
}
