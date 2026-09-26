'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeStreaks, computeStreakCard, contributionsInYear, mergeDays } = require('../src/data');

const day = (date, contributionCount) => ({ date, contributionCount });

test('empty calendar yields zero streaks', () => {
  const s = computeStreaks([], '2026-09-26');
  assert.deepEqual(s.current, { length: 0, start: null, end: null });
  assert.deepEqual(s.longest, { length: 0, start: null, end: null });
  assert.equal(contributionsInYear([], 2026), 0);
});

test('calendar with only zero days has no streak', () => {
  const s = computeStreaks([day('2026-09-25', 0), day('2026-09-26', 0)], '2026-09-26');
  assert.equal(s.current.length, 0);
  assert.equal(s.longest.length, 0);
});

test('streak crossing a year boundary is continuous', () => {
  const days = [day('2025-12-30', 1), day('2025-12-31', 2), day('2026-01-01', 1), day('2026-01-02', 4)];
  const s = computeStreaks(days, '2026-01-02');
  assert.deepEqual(s.current, { length: 4, start: '2025-12-30', end: '2026-01-02' });
  assert.deepEqual(s.longest, { length: 4, start: '2025-12-30', end: '2026-01-02' });
});

test('today with no contribution yet does not break the current streak', () => {
  const days = [day('2026-09-23', 1), day('2026-09-24', 3), day('2026-09-25', 2), day('2026-09-26', 0)];
  const s = computeStreaks(days, '2026-09-26');
  assert.deepEqual(s.current, { length: 3, start: '2026-09-23', end: '2026-09-25' });
});

test('today missing from the calendar also does not break the streak', () => {
  const days = [day('2026-09-24', 3), day('2026-09-25', 2)];
  assert.equal(computeStreaks(days, '2026-09-26').current.length, 2);
});

test('today counts when it already has contributions', () => {
  const days = [day('2026-09-25', 2), day('2026-09-26', 1)];
  assert.deepEqual(computeStreaks(days, '2026-09-26').current, { length: 2, start: '2026-09-25', end: '2026-09-26' });
});

test('a missed yesterday ends the current streak', () => {
  const days = [day('2026-09-20', 5), day('2026-09-21', 5), day('2026-09-24', 1)];
  const s = computeStreaks(days, '2026-09-26');
  assert.equal(s.current.length, 0);
  assert.deepEqual(s.longest, { length: 2, start: '2026-09-20', end: '2026-09-21' });
});

test('dates missing from the input count as gaps', () => {
  const days = [day('2026-01-01', 1), day('2026-01-02', 1), day('2026-01-04', 1)];
  assert.equal(computeStreaks(days, '2026-01-04').longest.length, 2);
  assert.equal(computeStreaks(days, '2026-01-04').current.length, 1);
});

test('longest streak keeps the earliest run on ties', () => {
  const days = [day('2026-02-01', 1), day('2026-02-02', 1), day('2026-02-04', 1), day('2026-02-05', 1)];
  assert.deepEqual(computeStreaks(days, '2026-02-10').longest, { length: 2, start: '2026-02-01', end: '2026-02-02' });
});

test('mergeDays de-duplicates overlapping windows and sorts', () => {
  const merged = mergeDays([[day('2026-01-02', 1), day('2026-01-01', 2)], [day('2026-01-02', 3)]]);
  assert.deepEqual(merged, [day('2026-01-01', 2), day('2026-01-02', 3)]);
});

test('computeStreakCard totals only the current calendar year', () => {
  const years = [
    { year: 2025, days: [day('2025-12-31', 10)] },
    { year: 2026, days: [day('2026-01-01', 2), day('2026-01-02', 3)] },
  ];
  const card = computeStreakCard(years, new Date('2026-01-03T08:00:00Z'));
  assert.equal(card.year, 2026);
  assert.equal(card.today, '2026-01-03');
  assert.equal(card.totalThisYear, 5);
  assert.deepEqual(card.current, { length: 3, start: '2025-12-31', end: '2026-01-02' });
});
