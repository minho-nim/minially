import { CategoryItem } from '../../types';

export function CategoryGrid({categories,value,onChange}:{categories:CategoryItem[];value:string;onChange:(id:string)=>void}) {
  if(!categories.length)return <div role="group" aria-label="카테고리 목록" className="py-3 text-center text-xs text-app-muted">아직 카테고리가 없어요. 추가하거나 카테고리 없이 등록할 수 있어요.</div>;
  return <div role="group" aria-label="카테고리 목록" className="grid grid-cols-4 gap-2 min-w-0">
    {categories.map(category=><button key={category.id} type="button" title={category.name} aria-label={category.name} aria-pressed={value===category.id} onClick={()=>onChange(category.id)} className={'min-w-0 px-1 py-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-xs '+(value===category.id?'border-app-accent bg-app-soft font-semibold':'border-transparent bg-app-canvas hover:border-app-outline')}><span className="w-5 h-5 rounded-full shrink-0" style={{background:category.color}}/><span className="w-full truncate text-center text-app-ink">{category.name}</span></button>)}
  </div>;
}
