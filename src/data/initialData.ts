import { AppData } from '../types';

export const INITIAL_DATA: AppData = {
  schedules: [
    {
      id: 'sch-1',
      title: '주간 디자인 & 프로덕트 싱크업',
      date: '2026-10-27',
      startTime: '10:00',
      endTime: '11:00',
      category: 'work',
      linkedProjectId: 'proj-1',
      completed: true,
      memo: '미니어리 (Minially) 웹 2.0 메인 인터페이스 및 캘린더 인터랙션 리뷰'
    },
    {
      id: 'sch-2',
      title: 'Q4 개발 스프린트 태스크 분배',
      date: '2026-10-27',
      startTime: '14:00',
      endTime: '15:30',
      category: 'work',
      linkedProjectId: 'proj-1',
      completed: false,
      memo: '로컬스토리지 안정화 및 간트차트 마감일 점검'
    },
    {
      id: 'sch-3',
      title: '마케팅 팀 브랜드 팝업 1차 기획안 검토',
      date: '2026-10-28',
      startTime: '11:00',
      endTime: '12:00',
      category: 'work',
      linkedProjectId: 'proj-2',
      completed: false,
      memo: '성수동 팝업스토어 굿즈 리스트 확인'
    },
    {
      id: 'sch-4',
      title: '모닝 필라테스 & 리프레시 스트레칭',
      date: '2026-10-27',
      startTime: '08:00',
      endTime: '09:00',
      category: 'personal',
      completed: true,
      memo: '폼롤러 코어 운동 및 수분 섭취'
    },
    {
      id: 'sch-5',
      title: '디저트 카페 독서 & 주간 정리',
      date: '2026-10-29',
      startTime: '16:00',
      endTime: '17:30',
      category: 'personal',
      completed: false,
      memo: '위클리 플래너 정리 및 에세이 읽기'
    }
  ],
  projects: [
    {
      id: 'proj-1',
      name: '미니어리 (Minially) 웹앱 2.0 런칭',
      description: '캘린더, 할 일, 프로젝트를 통합 관리하는 미니멀 생산성 웹앱',
      startDate: '2026-10-20',
      dueDate: '2026-11-08',
      status: 'active',
      progress: 60,
      color: '#D98DAA',
      taskIds: ['task-1-1', 'task-1-2', 'task-1-3', 'task-1-4'],
      memo: '로컬스토리지 기반 웹앱 MVP'
    },
    {
      id: 'proj-2',
      name: '브랜드 팝업스토어 & 굿즈 제작',
      description: '연말 플래너 시즌 맞이 한정판 스티커 및 굿즈 런칭',
      startDate: '2026-10-25',
      dueDate: '2026-11-20',
      status: 'planned',
      progress: 25,
      color: '#875982',
      taskIds: ['task-2-1', 'task-2-2', 'task-2-3'],
      memo: '릴스 숏폼 홍보 영상 촬영 계획'
    }
  ],
  tasks: [
    {
      id: 'task-1-1',
      projectId: 'proj-1',
      title: 'UI 디자인 시스템 & 로즈 핑크 컬러 팔레트 구축',
      startDate: '2026-10-20',
      dueDate: '2026-10-24',
      status: 'done',
      priority: 'high',
      dependencyTaskIds: [],
      checklist: [
        { id: 'chk-1', text: '로즈 핑크 테마 정의', done: true },
        { id: 'chk-2', text: '버튼 및 모달 모서리 규격 통일', done: true },
        { id: 'chk-3', text: '폰트 Pretendard 세팅', done: true }
      ],
      memo: '데이터 가독성을 최우선으로 정돈된 톤앤매너'
    },
    {
      id: 'task-1-2',
      projectId: 'proj-1',
      title: '프리셋 기반 빠른 일정 등록 모듈 개발',
      startDate: '2026-10-24',
      dueDate: '2026-10-28',
      status: 'doing',
      priority: 'high',
      dependencyTaskIds: ['task-1-1'],
      checklist: [
        { id: 'chk-4', text: '사용자 커스텀 프리셋 CRUD 구현', done: true },
        { id: 'chk-5', text: '일정에서 원클릭 프리셋 적용 기능', done: true },
        { id: 'chk-6', text: '체크리스트 자동 바인딩 로직 검증', done: false }
      ],
      memo: '자주 반복되는 미팅/루틴을 1초 만에 캘린더에 넣는 핵심 UX'
    },
    {
      id: 'task-1-3',
      projectId: 'proj-1',
      title: '간트차트 타임라인 시각화 엔진 구현',
      startDate: '2026-10-27',
      dueDate: '2026-11-03',
      status: 'todo',
      priority: 'medium',
      dependencyTaskIds: ['task-1-2'],
      checklist: [
        { id: 'chk-7', text: '프로젝트 작업 기간별 가로 바 렌더링', done: false },
        { id: 'chk-8', text: '오늘 날짜 기준 마커선 표시', done: false },
        { id: 'chk-9', text: '반응형 가로 스크롤 및 툴팁', done: false }
      ],
      memo: '프로젝트 세부 작업의 흐름을 한눈에 볼 수 있는 타임라인'
    },
    {
      id: 'task-1-4',
      projectId: 'proj-1',
      title: '로컬 데이터 백업 & JSON 복원 검증',
      startDate: '2026-11-02',
      dueDate: '2026-11-07',
      status: 'todo',
      priority: 'low',
      dependencyTaskIds: ['task-1-3'],
      checklist: [
        { id: 'chk-10', text: '전체 데이터 JSON 파일 다운로드', done: false },
        { id: 'chk-11', text: 'JSON 파일 업로드 유효성 검사 및 복원', done: false }
      ],
      memo: '안전한 데이터 백업 보장'
    },
    {
      id: 'task-2-1',
      projectId: 'proj-2',
      title: '다이어리 굿즈 디자인 시안 확정',
      startDate: '2026-10-25',
      dueDate: '2026-10-31',
      status: 'doing',
      priority: 'high',
      dependencyTaskIds: [],
      checklist: [
        { id: 'chk-12', text: '스티커팩 3종 제작', done: true },
        { id: 'chk-13', text: '아크릴 키링 샘플 발주', done: false }
      ],
      memo: '인쇄소 샘플 감리 일정 조율 필요'
    },
    {
      id: 'task-2-2',
      projectId: 'proj-2',
      title: '팝업 공간 대관 및 인테리어 무드보드',
      startDate: '2026-10-30',
      dueDate: '2026-11-10',
      status: 'todo',
      priority: 'medium',
      dependencyTaskIds: ['task-2-1'],
      checklist: [
        { id: 'chk-14', text: '갤러리 대관 계약', done: false },
        { id: 'chk-15', text: '포토존 소품 렌탈 견적 비교', done: false }
      ],
      memo: '미니멀 로즈핑크 콘셉트 유지'
    },
    {
      id: 'task-2-3',
      projectId: 'proj-2',
      title: '릴스 티저 영상 제작 및 사전 예약 오픈',
      startDate: '2026-11-08',
      dueDate: '2026-11-18',
      status: 'todo',
      priority: 'medium',
      dependencyTaskIds: ['task-2-2'],
      checklist: [
        { id: 'chk-16', text: '티저 영상 2편 촬영', done: false },
        { id: 'chk-17', text: '사전 예약 폼 오픈', done: false }
      ],
      memo: '방문자 선착순 한정판 엽서 증정'
    }
  ],
  presets: [
    {
      id: 'preset-1',
      type: 'title',
      usageCount: 0,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      text: '오전 데일리 스탠드업 & 플래닝',
      name: '모닝 루틴 & 데일리 스탠드업',
      icon: '',
      color: '#CF8FA8',
      defaultTitle: '오전 데일리 스탠드업 & 플래닝',
      defaultCategory: 'work',
      defaultStartTime: '09:30',
      defaultDuration: 30,
      recurrence: 'weekdays',
      checklistTemplates: [
        '어제 완료한 작업 리뷰',
        '오늘 최우선순위 3가지 선별',
        '팀원 공유 및 블로커 체크'
      ],
      memo: '하루를 맑은 정신으로 시작하는 30분 루틴',
      isFavorite: true
    },
    {
      id: 'preset-2',
      type: 'title',
      usageCount: 0,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      text: '집중 딥워크 블록',
      name: '집중 딥워크 세션',
      icon: '',
      color: '#875982',
      defaultTitle: '집중 딥워크 블록',
      defaultCategory: 'work',
      defaultStartTime: '14:00',
      defaultDuration: 120,
      recurrence: 'daily',
      checklistTemplates: [
        '알림 무음 설정 & 방해 금지',
        '핵심 태스크 몰입해서 완료하기',
        '진행 상황 메모 및 다음 단계 기록'
      ],
      memo: '방해받지 않고 핵심 마일스톤을 달성하는 시간',
      isFavorite: true
    },
    {
      id: 'preset-3',
      type: 'title',
      usageCount: 0,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
      text: '디저트 카페 & 주간 정리',
      name: '카페 리프레시 & 독서',
      icon: '',
      color: '#B8587C',
      defaultTitle: '디저트 카페 & 주간 정리',
      defaultCategory: 'personal',
      defaultStartTime: '16:00',
      defaultDuration: 60,
      recurrence: 'none',
      checklistTemplates: [
        '따뜻한 차 마시기',
        '이번 주 플래너 점검',
        '독서 및 아이디어 메모'
      ],
      memo: '바쁜 일상 속 나를 위한 리프레시',
      isFavorite: true
    }
  ],
  categories: [
    { id: 'work', name: '업무', color: '#D98DAA', isDefault: true },
    { id: 'personal', name: '개인', color: '#B08898', isDefault: true },
    { id: 'study', name: '공부/자기계발', color: '#8899B0', isDefault: false },
    { id: 'health', name: '운동/건강', color: '#88B098', isDefault: false },
  ],
  recurrenceRules: [],
  recurrenceExceptions: [],
  settings: {
    startDayOfWeek: 0,
    defaultCategory: 'personal',
    defaultView: 'month',
    showCompletedInCalendar: true,
    vibrateOnAction: true,
  },
};
