/**
 * A parent or student can message a teacher while one of their dancers has a class
 * with that teacher that is upcoming or took place within this many days.
 * Shared by the server check and the pages that show the button.
 */
export const TEACHER_CONTACT_DAYS = 30;

export function withinTeacherContactWindow(sessionStart: Date | string, now: Date = new Date()) {
  const earliest = now.getTime() - TEACHER_CONTACT_DAYS * 24 * 60 * 60 * 1000;
  return new Date(sessionStart).getTime() >= earliest;
}
