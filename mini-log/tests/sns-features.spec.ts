import { expect, test } from '@playwright/test';
import type { Post } from '../functions/_blog';

// 인기 SNS·블로그 관리 도구(Buffer·Later·Planoly·Canva·Metricool)에서 가져온 기능 중 규칙 부분

test('AI 요약 대비 점검: 첫 40자 핵심어·긴 문장·기준일·정리 줄·출처, 짧은 글은 보지 않는다', async () => {
  const { briefingCheck } = await import('../src/DraftCheck');
  expect(briefingCheck({ body: '짧은 글이에요.', postType: 'food' }, '소금빵')).toEqual([]);

  const longSentence = '이 가게는 골목 안쪽에 있어서 처음 가는 사람은 지도를 보고도 한참을 헤맬 수 있는데 저도 두 바퀴를 돌았어요.';
  const bad = briefingCheck({ body: `오늘은 날씨가 좋아서 산책을 나갔다가 우연히 들른 곳이에요.\n${longSentence.repeat(1)}\n${longSentence}\n${longSentence}\n${longSentence}\n소금빵 3,500원이고 맛있어요. ${'정말 맛있어요. '.repeat(100)}`, postType: 'food' }, '소금빵');
  const failed = Object.fromEntries(bad.filter(i => !i.ok).map(i => [i.label, i.hint]));
  expect(Object.keys(failed)).toEqual(["첫 40자에 핵심어 '소금빵'", '긴 문장(60자 넘음) 3개 이하', '가격·영업시간에 기준일', "정리 줄 3개 이상('항목: 값'·목록)"]);
  expect(failed['긴 문장(60자 넘음) 3개 이하']).toContain('4개');

  const good = briefingCheck({ body: `성수 소금빵 맛집, 버터 향이 진하고 웨이팅은 10분이었어요.\n위치: 성수역 3번 출구 5분\n가격: 소금빵 3,500원(2026년 11월 기준)\n영업시간: 8시~20시\n${'겉은 바삭하고 속은 촉촉해요. '.repeat(70)}`, postType: 'food' }, '소금빵');
  expect(good.map(i => i.label)).toContain("정리 줄 3개 이상('항목: 값'·목록)");
  expect(good.every(i => i.ok)).toBe(true);
  expect(briefingCheck({ body: `연말정산 간소화 자료는 1월 15일부터 볼 수 있어요. ${'신청 방법을 순서대로 알려 드릴게요. '.repeat(20)}`, postType: 'info' }, '연말정산').find(i => i.label === '정보 글 출처 표시')?.ok).toBe(false);
});

const post = (published_on: string, views: number | null): Post => ({
  post_key: published_on + views, blog_id: 'me', url: 'https://blog.naver.com/me/' + published_on, title: '글', published_on, summary: '', tags: [],
  views, likes: null, comments: null, stats_on: null, draft_id: null,
});

test('올리기 좋은 요일: 조회수 있는 글 6편 이상, 2편 이상 올린 요일끼리 비교', async () => {
  const { weekdayStats } = await import('../functions/_demand');
  const five = [post('2026-11-23', 100), post('2026-11-16', 300), post('2026-11-20', 500), post('2026-11-13', 700), post('2026-11-22', 1000), post('2026-11-25', null)];
  expect(weekdayStats(five).best).toBeNull(); // 조회수 있는 글이 5편뿐
  const six = weekdayStats([...five, post('2026-11-24', 50)]);
  expect(six.best).toMatchObject({ label: '금', posts: 2, avg: 600 }); // 일요일(1편 1000)은 비교에서 뺀다
  expect(six.days.find(d => d.label === '월')).toMatchObject({ posts: 2, avg: 200 });
  expect(six.days.find(d => d.label === '수')).toMatchObject({ posts: 0, avg: 0 }); // 조회수 없는 글은 세지 않는다
});
