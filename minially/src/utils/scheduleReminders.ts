import type {ReminderSettings,Schedule} from '../types';

/** undefined는 공통 설정, null은 이 일정만 끄기, 숫자는 개별 알림 시간이다. */
export function scheduleReminderWindow(schedule:Schedule,settings:ReminderSettings|undefined){
 const minutes=schedule.reminderMinutes===undefined?(settings?.enabled?settings.minutesBefore:null):schedule.reminderMinutes;
 if(schedule.completed||minutes===null||typeof minutes!=='number'||!Number.isInteger(minutes)||minutes<0||minutes>1440||!/^\d{4}-\d{2}-\d{2}$/.test(schedule.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.startTime||''))return null;
 const start=new Date(schedule.date+'T'+schedule.startTime);
 if(!Number.isFinite(start.getTime())||start.getFullYear()!==Number(schedule.date.slice(0,4))||start.getMonth()+1!==Number(schedule.date.slice(5,7))||start.getDate()!==Number(schedule.date.slice(8,10)))return null;
 return{start:start.getTime(),at:start.getTime()-minutes*60_000,until:start.getTime()+10*60_000};
}
