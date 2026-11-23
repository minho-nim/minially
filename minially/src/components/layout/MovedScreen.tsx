import React, { useState } from 'react';
import { exportAllData } from '../../db/indexedDB';

// GitHub Pages(예전 주소) 전용 화면: 여기는 서버가 없어 로그인할 수 없으므로 새 주소로 안내하고, 이 주소에 남은 데이터를 백업할 수 있게 한다.
export const NEW_URL = 'https://minially.pages.dev/';

export const MovedScreen: React.FC = () => {
  const [status, setStatus] = useState('');
  const backup = async () => {
    try {
      const data = await exportAllData();
      const count = data.schedules.length + data.tasks.length;
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `Minially_Backup_old-site_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus(count ? `일정·할 일 ${count}개를 백업했어요. 새 주소의 설정 → 백업/복원에서 복원하세요.` : '이 주소에는 저장된 일정이 없어요.');
    } catch { setStatus('백업하지 못했어요. 다시 시도해 주세요.'); }
  };
  return (
    <div className="min-h-dvh bg-app-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-app-line p-5 space-y-4 text-center">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="w-14 h-14 mx-auto" />
        <div>
          <h1 className="text-lg font-bold text-app-ink">미니어리가 새 주소로 옮겼어요</h1>
          <p className="text-xs text-app-muted mt-1">이제 코드로 로그인하고 PC·폰이 자동으로 맞춰지는 새 주소에서 써 주세요.</p>
        </div>
        <a href={NEW_URL} className="block w-full py-2.5 rounded-xl bg-app-accent text-white text-sm font-bold">새 주소로 가기</a>
        <div className="pt-3 border-t border-app-line space-y-2">
          <p className="text-[11px] text-app-muted">예전에 이 주소에서 쓰던 일정이 있다면 먼저 백업한 뒤, 새 주소에서 복원하세요.</p>
          <button type="button" onClick={() => void backup()} className="w-full py-2 rounded-xl border border-app-line text-xs font-bold text-app-ink hover:bg-app-soft cursor-pointer">이 주소의 데이터 백업 받기</button>
          {status && <p role="status" className="text-xs text-app-muted">{status}</p>}
        </div>
      </div>
    </div>
  );
};
