export interface DesktopPreferences {alwaysOnTop:boolean;startOnLogin:boolean;closeToTray:boolean;autoDownload:boolean}
export interface DesktopUpdate {kind:'unsupported'|'idle'|'checking'|'current'|'available'|'downloading'|'ready'|'preparing'|'installing'|'error';version:string;percent:number;message?:string}
export interface DesktopState {window:{maximized:boolean;focused:boolean};version:string;platform:string;preferences:DesktopPreferences;update:DesktopUpdate;shortcutAvailable:boolean;shortcut:string;canStartOnLogin:boolean}
declare global {interface Window {miniallyDesktop?:{
 mode:'main'|'quick';windowAction:(action:'minimize'|'maximize'|'close')=>Promise<void>;getState:()=>Promise<DesktopState>;updatePreferences:(patch:Partial<DesktopPreferences>)=>Promise<DesktopState>;showMain:()=>Promise<void>;showQuick:()=>Promise<void>;hideQuick:()=>Promise<void>;openNote:(id:string)=>Promise<void>;notifySaved:()=>void;
 checkUpdate:()=>Promise<DesktopUpdate>;downloadUpdate:()=>Promise<DesktopUpdate>;installUpdate:()=>Promise<void>;
 onState:(callback:(state:DesktopState)=>void)=>()=>void;onOpenNote:(callback:(id:string)=>void)=>()=>void;onRefresh:(callback:()=>void)=>()=>void;onQuickFocus:(callback:()=>void)=>()=>void;onPrepareClose:(callback:()=>Promise<boolean>)=>()=>void;
}}}
