import { CategoryItem } from '../../types';

export function CategoryGrid({categories,value,onChange}:{categories:CategoryItem[];value:string;onChange:(id:string)=>void}) {
  return <div role="group" aria-label="카테고리 목록" className="flex flex-wrap gap-1.5 min-w-0">
    {categories.map(category=><button key={category.id} type="button" title={category.name} aria-label={category.name} aria-pressed={value===category.id} onClick={()=>onChange(value===category.id?'':category.id)} className={'category-compact-control min-w-0 max-w-full px-2 py-1 rounded-lg border inline-flex items-center justify-center gap-1.5 text-xs '+(value===category.id?'border-app-accent bg-app-soft text-app-accent':'border-app-line bg-white text-app-ink')}><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:category.color}}/><span className="truncate max-w-40">{category.name}</span></button>)}
  </div>;
}
