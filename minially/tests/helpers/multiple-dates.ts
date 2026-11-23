import type {Locator} from '@playwright/test';
export async function chooseMultipleDate(scope:Locator,date:string){
 const [year,month]=date.split('-'),calendar=scope.getByRole('group',{name:'등록 날짜 달력',exact:true});
 await calendar.getByLabel('등록 날짜 연도',{exact:true}).selectOption(year);
 await calendar.getByLabel('등록 날짜 월',{exact:true}).selectOption(String(Number(month)));
 await calendar.getByRole('button',{name:date+' 선택',exact:true}).click();
}
