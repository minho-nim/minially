import test from 'node:test'; import assert from 'node:assert/strict';
import { cleanIcsUrl, parseIcs } from '../functions/_googleIcs.ts';
const T = '2026-11-27';
const ics = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-TIMEZONE:Asia/Seoul',
  'BEGIN:VEVENT', 'UID:a1@google.com', 'DTSTART:20261201T013000Z', 'DTEND:20261201T023000Z', 'SUMMARY:치과 정기 검진', 'LOCATION:강남역 3번 출구\\, 2층', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a2@google.com', 'DTSTART;TZID=Asia/Seoul:20261203T190000', 'DTEND;TZID=Asia/Seoul:20261203T210000', 'SUMMARY:송년회', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a3@google.com', 'DTSTART;VALUE=DATE:20261224', 'DTEND;VALUE=DATE:20261227', 'SUMMARY:제주 여행', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a4@google.com', 'DTSTART;TZID=Asia/Seoul:20261102T100000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH', 'SUMMARY:필라테스', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a5@google.com', 'DTSTART:20261110T010000Z', 'SUMMARY:지난 일정', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a6@google.com', 'DTSTART:20261205T010000Z', 'SUMMARY:취소된 일정', 'STATUS:CANCELLED', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a4@google.com', 'RECURRENCE-ID;TZID=Asia/Seoul:20261203T100000', 'DTSTART;TZID=Asia/Seoul:20261203T110000', 'SUMMARY:필라테스(바뀜)', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a7@google.com', 'DTSTART;TZID=America/New_York:20261210T090000', 'DTEND;TZID=America/New_York:20261210T100000', 'SUMMARY:뉴욕 화상 회의 ', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a8@google.com', 'DTSTART:20270601T010000Z', 'SUMMARY:90일 넘음', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a9@google.com', 'DTSTART;TZID=Asia/Seoul:20260101T090000', 'RRULE:FREQ=DAILY;UNTIL=20260301T000000Z', 'SUMMARY:끝난 반복', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n').replace('SUMMARY:송년회', 'SUMMARY:송년\r\n 회');
test('구글 캘린더 iCal: 한국 시간으로, 여러 날·반복·장소, 지난·취소·예외·90일 넘는 일정은 빼고, 줄이 접힌 글도 읽는다', () => {
  const got = parseIcs(ics, T);
  const by = t => got.find(e => e.title === t);
  assert.deepEqual(got.map(e => e.title), ['필라테스', '치과 정기 검진', '송년회', '뉴욕 화상 회의', '제주 여행']);
  assert.deepEqual([by('치과 정기 검진').date, by('치과 정기 검진').start, by('치과 정기 검진').end], ['2026-12-01', '10:30', '11:30']);
  assert.equal(by('치과 정기 검진').location, '강남역 3번 출구, 2층');
  assert.deepEqual([by('송년회').start, by('송년회').end], ['19:00', '21:00']);
  assert.deepEqual([by('제주 여행').start, by('제주 여행').until], [null, '2026-12-26']);
  assert.deepEqual(by('필라테스').repeat, { frequency: 'weekly', interval: 2, weekdays: [2, 4], label: '격주 화·목' });
  assert.deepEqual([by('뉴욕 화상 회의').date, by('뉴욕 화상 회의').start], ['2026-12-10', '23:00']); // 뉴욕 오전 9시(동부 표준시) = 한국 밤 11시
  assert.ok(got.every(e => e.source === '구글 캘린더' && e.uncertain === false));
});
test('구글 캘린더 주소: calendar.google.com의 iCal 주소만', () => {
  assert.ok(cleanIcsUrl('https://calendar.google.com/calendar/ical/abc%40gmail.com/private-0123abcd/basic.ics'));
  assert.ok(cleanIcsUrl('https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics'));
  for (const bad of ['http://calendar.google.com/calendar/ical/a/private-0a/basic.ics', 'https://evil.example/calendar/ical/a/private-0a/basic.ics', 'https://calendar.google.com/calendar/u/0/r', 'https://calendar.google.com.evil.example/calendar/ical/a/public/basic.ics', 'https://calendar.google.com:8443/calendar/ical/a/public/basic.ics', 'javascript:alert(1)', 42])
    assert.equal(cleanIcsUrl(bad), null, String(bad));
  assert.ok(cleanIcsUrl('http://127.0.0.1:8897/ics/basic.ics', 'http://127.0.0.1:8897'));
  assert.equal(cleanIcsUrl('http://127.0.0.1:9999/ics/basic.ics', 'http://127.0.0.1:8897'), null);
});
