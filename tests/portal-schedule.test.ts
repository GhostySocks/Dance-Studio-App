import { describe, expect, it } from "vitest";

import { bookingChoices, canBookAny } from "@/lib/portal-schedule";

const open = { spotsLeft: 3, dropInEnabled: true, booked: [] };
const full = { ...open, spotsLeft: 0 };
const termOnly = { ...open, dropInEnabled: false };
const emma = { id: "emma", makeupsAvailable: 0 };
const emmaWithMakeup = { id: "emma", makeupsAvailable: 1 };

describe("bookingChoices", () => {
  it("offers a single class when the class has a spot and is bookable by the date", () => {
    expect(bookingChoices(open, emma)).toEqual({ alreadyBooked: false, single: "OPEN", makeup: false });
  });

  it("offers a makeup as well when the dancer has a missed class to make up", () => {
    expect(bookingChoices(open, emmaWithMakeup)).toEqual({ alreadyBooked: false, single: "OPEN", makeup: true });
  });

  it("offers only the waitlist when the class is full: a makeup is never waitlisted", () => {
    expect(bookingChoices(full, emmaWithMakeup)).toEqual({ alreadyBooked: false, single: "WAITLIST", makeup: false });
  });

  it("offers a term-only class as a makeup but not as a single class", () => {
    expect(bookingChoices(termOnly, emmaWithMakeup)).toEqual({ alreadyBooked: false, single: null, makeup: true });
    expect(bookingChoices(termOnly, emma)).toEqual({ alreadyBooked: false, single: null, makeup: false });
  });

  it("offers nothing to a dancer who is already booked or waitlisted", () => {
    const booked = { ...open, booked: [{ studentId: "emma" }] };
    expect(bookingChoices(booked, emmaWithMakeup)).toEqual({ alreadyBooked: true, single: null, makeup: false });
    expect(bookingChoices(booked, { id: "olivia", makeupsAvailable: 0 }).single).toBe("OPEN");
  });
});

describe("canBookAny", () => {
  it("is true while at least one dancer can still book", () => {
    const booked = { ...open, booked: [{ studentId: "emma" }] };
    expect(canBookAny(booked, [emma, { id: "olivia", makeupsAvailable: 0 }])).toBe(true);
    expect(canBookAny(booked, [emma])).toBe(false);
  });

  it("is false for a term-only class when nobody has a makeup, and with no dancers", () => {
    expect(canBookAny(termOnly, [emma])).toBe(false);
    expect(canBookAny(termOnly, [emmaWithMakeup])).toBe(true);
    expect(canBookAny(open, [])).toBe(false);
  });
});
