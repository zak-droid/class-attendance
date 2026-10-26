import test from 'node:test';
import assert from 'node:assert/strict';
import {validDate, weeklyMeetings, parseScheduleText, mergeMeetings, scheduleErrors, meetingOn} from '../app/schedule.ts';
import {calculateStudentAttendanceStats} from '../app/export-utils.ts';
test('future and cancelled attendance is preserved but excluded from percentages', () => {
  const student={id:'s',courseId:'c',name:'Test',active:true};
  const logs=[{id:'1',studentId:'s',courseId:'c',date:'2026-10-20',status:'Present'},{id:'2',studentId:'s',courseId:'c',date:'2026-10-21',status:'Absent'},{id:'3',studentId:'s',courseId:'c',date:'2026-11-01',status:'Absent'}];
  const course={id:'c',name:'C',active:true,schedule:{meetings:[{date:'2026-10-21',status:'cancelled'}]}};
  const stats=calculateStudentAttendanceStats(student,logs,course,'2026-10-27');
  assert.equal(stats.totalSessions,1); assert.equal(stats.attendancePercentage,100); assert.equal(stats.history.length,3);
});
test('date validation, two-digit years, leap days and ranges', () => {
  assert.equal(validDate('2027-02-29'),false);
  assert.equal(validDate('2028-02-29'),true);
  assert.throws(() => parseScheduleText('31/11/26'));
  const rows=parseScheduleText('3-4/12/26 מסע\n27/10/2026 יום בחירות\n2027-04-13 ערב');
  assert.deepEqual(rows.map(r=>r.date),['2026-10-27','2026-12-03','2026-12-04','2027-04-13']);
  assert.equal(rows[0].status,'cancelled');
  assert.equal(rows[1].groupId,rows[2].groupId);
  assert.equal(meetingOn(rows,'2026-10-27'),undefined);
});
test('weekly dates survive year rollover and DST; duplicate merges preserve identity', () => {
  const rows=weeklyMeetings('2026-12-30',3,3);
  assert.deepEqual(rows.map(r=>r.date),['2026-12-30','2027-01-06','2027-01-13']);
  assert.deepEqual(weeklyMeetings('2027-03-24',3,3).map(r=>r.date),['2027-03-24','2027-03-31','2027-04-07']);
  assert.equal(mergeMeetings(rows,parseScheduleText('30/12/2026 updated'))[0].id,rows[0].id);
  assert.ok(scheduleErrors([...rows,rows[0]]).length);
});
