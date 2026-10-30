import React, { useState, useRef, useEffect } from 'react';
import {
  Preset,
  CategoryItem,
  AppSettings,
  AppData,
} from '../../types';
import {
  X,
  Sliders,
  Bookmark,
  Palette,
  Download,
  Upload,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { CategoryActions, CategoryManager } from './CategoryManager';
import { PhraseManager } from './PhraseManageModal';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { DiscardPrompt } from '../common/DiscardPrompt';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface SettingsModalProps extends CategoryActions {
  isOpen: boolean;
  onClose: () => void;
  presets: Preset[];
  categories: CategoryItem[];
  settings: AppSettings;
  onSavePreset: (preset: Preset) => Promise<void> | void;
  onReorderPresets: (ids: string[]) => Promise<void> | void;
  onDeletePreset: (presetId: string) => Promise<void> | void;
  onUpdateSettings: (settings: AppSettings) => Promise<void> | void;
  onExportBackup: () => Promise<void> | void;
  onImportBackup: (data: Partial<AppData>) => Promise<void> | void;
  onResetData: () => Promise<void> | void;
}

type SettingsTab = 'presets' | 'categories' | 'calendar' | 'backup' | 'pwa';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  presets,
  categories,
  schedules, onReorderCategories,
  settings,
  onSavePreset,
  onReorderPresets,
  onDeletePreset,
  onSaveCategory,
  onDeleteCategory,
  onUpdateSettings,
  onExportBackup,
  onImportBackup,
  onResetData,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('presets');

  const [backupStatus, setBackupStatus] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);

  const [panelDirty, setPanelDirty] = useState(false), [panelBusy, setPanelBusy] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false), [settingsError, setSettingsError] = useState('');
  const guard = useDiscardGuard(panelDirty, panelBusy || backupBusy || settingsSaving);
  const modalRef = useRef<HTMLDivElement>(null);
  const requestClose = () => { if (guard.confirming) { guard.cancel(); return false; } return guard.request(onClose); };
  useScheduleDialog(isOpen, false, modalRef, requestClose, requestClose);
  useEffect(() => { if (isOpen) { setPanelDirty(false); setPanelBusy(false); setSettingsError(''); setBackupStatus(''); } }, [isOpen]);
  const changeTab = (tab: SettingsTab) => { if (tab === activeTab) return; guard.request(() => { setActiveTab(tab); setPanelDirty(false); setPanelBusy(false); }); };
  const updateSettings = async (next: AppSettings) => { if (settingsSaving) return; setSettingsSaving(true); setSettingsError(''); try { await onUpdateSettings(next); } catch { setSettingsError('설정을 저장하지 못했습니다. 다시 시도해 주세요.'); } finally { setSettingsSaving(false); } };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('백업 파일의 데이터로 복원할까요? 파일에 포함된 항목은 현재 데이터를 대체합니다.')) return;
    setBackupBusy(true);
    setBackupStatus('');
    try {
      await onImportBackup(JSON.parse(await file.text()));
      setBackupStatus('백업을 복원했습니다.');
    } catch {
      setBackupStatus('백업을 복원하지 못했습니다. 파일 형식과 저장 공간을 확인해 주세요.');
    } finally { setBackupBusy(false); }
  };

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label="설정" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[rgba(45,35,40,0.25)]">
      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-[#F0E7EB] overflow-hidden flex flex-col max-h-[min(90dvh,var(--modal-height,100dvh))] pb-safe safe-bottom">
        <div className="w-10 h-1 bg-[#F0E7EB] rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#F0E7EB] flex items-center justify-between bg-white shrink-0">
          <h3 className="text-base font-bold text-[#3E3438]">설정</h3>
          <button
            onClick={requestClose}
            aria-label="설정 닫기"
            className="p-1 text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#F0E7EB] bg-[#FFFAFB] px-4 gap-1 overflow-x-auto text-xs font-semibold shrink-0 no-scrollbar">
          <button
            onClick={() => changeTab('presets')}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'presets'
                ? 'border-[#CF8FA8] text-[#CF8FA8]'
                : 'border-transparent text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>프리셋</span>
          </button>
          <button
            onClick={() => changeTab('categories')}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'categories'
                ? 'border-[#CF8FA8] text-[#CF8FA8]'
                : 'border-transparent text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>카테고리</span>
          </button>
          <button
            onClick={() => changeTab('calendar')}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'calendar'
                ? 'border-[#CF8FA8] text-[#CF8FA8]'
                : 'border-transparent text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>달력 설정</span>
          </button>
          <button
            onClick={() => changeTab('backup')}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'border-[#CF8FA8] text-[#CF8FA8]'
                : 'border-transparent text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>백업/복원</span>
          </button>
          <button
            onClick={() => changeTab('pwa')}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'pwa'
                ? 'border-[#CF8FA8] text-[#CF8FA8]'
                : 'border-transparent text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>앱 설치</span>
          </button>
        </div>

        {guard.confirming && <DiscardPrompt onContinue={guard.cancel} onDiscard={guard.discard} />}
        {settingsError && <p role="alert" className="p-3 text-xs text-red-600">{settingsError}</p>}
        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: PHRASE PRESETS (프리셋 관리) */}
          {activeTab === 'presets' && <PhraseManager presetGroups={settings.presetGroups || []} onDirtyChange={setPanelDirty} onBusyChange={setPanelBusy} presets={presets} onSavePreset={onSavePreset} onDeletePreset={onDeletePreset} onReorderPresets={onReorderPresets} />}

          {activeTab === 'categories' && <CategoryManager onDirtyChange={setPanelDirty} onBusyChange={setPanelBusy} categories={categories} schedules={schedules} onSaveCategory={onSaveCategory} onDeleteCategory={onDeleteCategory} onReorderCategories={onReorderCategories} />}

          {/* TAB 3: CALENDAR SETTINGS */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#3E3438]">달력 환경 설정</h4>
              </div>

              <fieldset disabled={settingsSaving} className="space-y-2.5">
                <div className="p-3 bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#3E3438]">시작 요일</p>
                    <p className="text-[11px] text-[#85777D]">
                      달력의 첫 번째 요일을 설정합니다.
                    </p>
                  </div>
                  <div className="flex rounded-lg border border-[#F0E7EB] p-0.5 bg-white text-xs">
                    <button
                      type="button"
                      onClick={() => void updateSettings({ ...settings, startDayOfWeek: 0 })}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        settings.startDayOfWeek === 0
                          ? 'bg-[#CF8FA8] text-white'
                          : 'text-[#85777D] hover:bg-stone-50'
                      }`}
                    >
                      일요일
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateSettings({ ...settings, startDayOfWeek: 1 })}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        settings.startDayOfWeek === 1
                          ? 'bg-[#CF8FA8] text-white'
                          : 'text-[#85777D] hover:bg-stone-50'
                      }`}
                    >
                      월요일
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#3E3438]">완료 일정 달력 표시</p>
                    <p className="text-[11px] text-[#85777D]">
                      완료된 일정도 달력에 취소선으로 표시합니다.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      aria-label="완료 일정 달력 표시"
                      checked={settings.showCompletedInCalendar}
                      onChange={(e) =>
                        void updateSettings({ ...settings, showCompletedInCalendar: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#CF8FA8]"></div>
                  </label>
                </div>
              </fieldset>
            </div>
          )}

          {/* TAB 4: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#3E3438]">데이터 백업 및 복원</h4>
                <p className="text-xs text-[#85777D]">
                  이 브라우저에 저장된 데이터를 JSON 파일로 백업하거나 복원합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={async () => {
                    setBackupBusy(true); setBackupStatus('');
                    try { await onExportBackup(); setBackupStatus('백업 파일을 내보냈습니다.'); }
                    catch { setBackupStatus('백업 파일을 내보내지 못했습니다. 다시 시도해 주세요.'); }
                    finally { setBackupBusy(false); }
                  }}
                  className="p-3.5 border border-[#F0E7EB] bg-[#FFFAFB] hover:bg-[#F6E8ED] rounded-xl text-left transition-colors cursor-pointer"
                >
                  <Download className="w-5 h-5 text-[#CF8FA8] mb-1.5" />
                  <p className="text-xs font-bold text-[#3E3438]">JSON 백업 다운로드</p>
                  <p className="text-[11px] text-[#85777D] mt-0.5">파일로 내보내기</p>
                </button>

                <div
                  role="button" tabIndex={backupBusy ? -1 : 0} aria-label="JSON 백업 복원" onKeyDown={e => { if (!backupBusy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInputRef.current?.click(); } }}
                  onClick={() => { if (!backupBusy) fileInputRef.current?.click(); }}
                  className="p-3.5 border border-[#F0E7EB] bg-[#FFFAFB] hover:bg-[#F6E8ED] rounded-xl text-left transition-colors cursor-pointer"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="w-5 h-5 text-[#CF8FA8] mb-1.5" />
                  <p className="text-xs font-bold text-[#3E3438]">JSON 백업 복원</p>
                  <p className="text-[11px] text-[#85777D] mt-0.5">파일에서 불러오기</p>
                </div>
              </div>

              {backupStatus && <p role="status" className="text-xs text-[#85777D]">{backupStatus}</p>}
              {/* Reset */}
              <div className="pt-3 border-t border-[#F0E7EB]">
                <div className="p-3 bg-red-50/70 border border-red-100 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-red-800">기본 데이터로 초기화</p>
                    <p className="text-[11px] text-red-600">모든 일정을 비우고 재설정합니다.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('정말 모든 데이터를 초기화하시겠습니까?')) {
                        setBackupBusy(true); setBackupStatus(''); Promise.resolve(onResetData()).then(() => setBackupStatus('데이터를 초기화했습니다.')).catch(() => setBackupStatus('초기화하지 못했습니다. 다시 시도해 주세요.')).finally(() => setBackupBusy(false));
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl cursor-pointer"
                  >
                    초기화
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PWA INSTALL */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#3E3438]">홈 화면에 앱 설치하기 (PWA)</h4>
                <p className="text-xs text-[#85777D]">
                  스마트폰 홈 화면에 바로가기 앱으로 설치하여 오프라인에서도 즉시 사용할 수 있습니다.
                </p>
              </div>

              <div className="p-4 bg-[#FFFAFB] border border-[#F0E7EB] rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#CF8FA8] text-white flex items-center justify-center font-bold text-lg shadow-2xs">M</div>
                  <div>
                    <p className="text-sm font-bold text-[#3E3438]">미니어리 (Minially)</p>
                    <p className="text-xs text-[#85777D]">
                      {isInstalled ? '앱으로 설치되어 있습니다.' : '홈 화면 설치 가능'}
                    </p>
                  </div>
                </div>

                {isInstallable && (
                  <button
                    type="button"
                    onClick={promptInstall}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>홈 화면에 앱 설치하기</span>
                  </button>
                )}

                {isIOS && (
                  <div className="p-3 bg-white border border-[#F0E7EB] rounded-xl text-xs space-y-1">
                    <p className="font-bold text-[#3E3438]">iOS Safari 설치 방법:</p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#85777D]">
                      <li>Safari 하단의 <span className="font-semibold text-[#3E3438]">공유 버튼</span>을 누릅니다.</li>
                      <li>메뉴에서 <span className="font-semibold text-[#3E3438]">'홈 화면에 추가'</span>를 선택합니다.</li>
                      <li>우측 상단 <span className="font-semibold text-[#3E3438]">'추가'</span>를 누르면 홈 화면에 설치됩니다.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
