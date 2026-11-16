/**
 * The "All classes" list in the parent and student portals: what a dancer can do
 * with a class they are not booked into. Kept free of database code.
 */

export interface BrowseSession {
  spotsLeft: number;
  /** Whether the class can be booked one date at a time (otherwise whole term only) */
  dropInEnabled: boolean;
  /** This account's dancers who already hold a place or a waitlist spot */
  booked: { studentId: string }[];
}

export interface BookingChoices {
  /** Already booked or waitlisted: nothing more to offer */
  alreadyBooked: boolean;
  /** Pay for this one date: takes a spot, or joins the waitlist when the class is full */
  single: "OPEN" | "WAITLIST" | null;
  /** Use a missed class here. Needs a free spot and a makeup to use. */
  makeup: boolean;
}

export function bookingChoices(
  session: BrowseSession,
  student: { id: string; makeupsAvailable: number }
): BookingChoices {
  if (session.booked.some((booking) => booking.studentId === student.id)) {
    return { alreadyBooked: true, single: null, makeup: false };
  }
  const hasSpot = session.spotsLeft > 0;
  return {
    alreadyBooked: false,
    single: session.dropInEnabled ? (hasSpot ? "OPEN" : "WAITLIST") : null,
    // A makeup is never waitlisted
    makeup: hasSpot && student.makeupsAvailable > 0,
  };
}

/** Can any of the account's dancers do anything with this class? */
export function canBookAny(
  session: BrowseSession,
  students: { id: string; makeupsAvailable: number }[]
): boolean {
  return students.some((student) => {
    const choices = bookingChoices(session, student);
    return choices.single !== null || choices.makeup;
  });
}
