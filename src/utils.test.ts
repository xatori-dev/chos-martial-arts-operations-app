import { describe, expect, it } from "vitest";
import { products } from "./data";
import {
  applyCoupon,
  createOrder,
  generateClassEvents,
  generateIcs,
  getInitialLaunchPhase,
  getLoginGateState,
  prototypeDeveloperLogin,
  prototypeManagerLogin,
  searchSite,
  validateLoginForm,
  validateContactForm
} from "./utils";

describe("cart and order utilities", () => {
  it("applies only the CHOS10 coupon", () => {
    expect(applyCoupon("CHOS10", 100)).toEqual({ code: "CHOS10", amount: 10, valid: true });
    expect(applyCoupon("bad-code", 100)).toEqual({ code: "BAD-CODE", amount: 0, valid: false });
  });

  it("creates incrementing mock order numbers and clears calculated totals", () => {
    const order = createOrder({
      existingOrdersCount: 4,
      customer: {
        firstName: "Alex",
        lastName: "Cho",
        email: "alex@example.com",
        phone: "2625550101",
        address: "N89W16863 Appleton Ave.",
        city: "Menomonee Falls",
        state: "WI",
        zip: "53051"
      },
      items: [{ id: "line-1", productSlug: "leadership-uniform", name: "Leadership uniform", unitPrice: 125, displayPrice: "$125.00", quantity: 2 }],
      coupon: { code: "CHOS10", amount: 25, valid: true },
      notes: "Pickup Saturday"
    });

    expect(order.orderNumber).toBe("CHOS-2026-0005");
    expect(order.total).toBe(236.25);
    expect(order.pickupOption).toContain("In-store pickup");
  });
});

describe("calendar and search utilities", () => {
  it("generates May and June 2026 recurring class events", () => {
    const events = generateClassEvents();
    expect(events.some((event) => event.title === "Youth Beginners Martial Training" && event.date === "2026-05-06")).toBe(true);
    expect(events.some((event) => event.title === "Little Dragons (4-6 years old)" && event.date === "2026-06-04")).toBe(true);
    expect(events.some((event) => event.title === "MMA Sparring" && event.date === "2026-05-29")).toBe(true);
  });

  it("generates a downloadable ICS payload", () => {
    const ics = generateIcs({
      title: "Private Lessons",
      date: "2026-05-11",
      startTime: "12:30 PM",
      endTime: "4:30 PM",
      description: "Appointment only"
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Private Lessons");
    expect(ics).toContain("DTSTART:20260511T173000Z");
  });

  it("uses Chicago daylight saving rules when generating winter ICS times", () => {
    const ics = generateIcs({
      title: "Winter Class",
      date: "2026-01-12",
      startTime: "4:30 PM",
      endTime: "5:15 PM",
      description: "Cold weather schedule"
    });

    expect(ics).toContain("DTSTART:20260112T223000Z");
    expect(ics).toContain("DTEND:20260112T231500Z");
  });

  it("indexes pages, products, classes, instructors, and terms", () => {
    const results = searchSite("starter");
    expect(results.some((result) => result.path === "/product/starter-program")).toBe(true);
    expect(searchSite("Major Artis").some((result) => result.path === "/about-us")).toBe(true);
    expect(searchSite("sales tax").some((result) => result.path === "/terms-and-conditions")).toBe(true);
    expect(searchSite(products[1].name).some((result) => result.path === "/product/leadership-uniform")).toBe(true);
  });

  it("indexes post-login app launcher topics", () => {
    expect(searchSite("my progress").some((result) => result.path === "/my-account?topic=progress" && result.type === "App Topic")).toBe(true);
    expect(searchSite("practice").some((result) => result.path === "/programs?section=practice" && result.type === "App Topic")).toBe(true);
    expect(searchSite("bookings").some((result) => result.path === "/my-account?topic=bookings" && result.type === "App Topic")).toBe(true);
  });
});

describe("form validation", () => {
  it("rejects missing contact fields and bot honeypot submissions", () => {
    expect(validateContactForm({ name: "", email: "", phone: "", message: "", captcha: false, url: "" })).toEqual({
      name: "Name is required.",
      email: "Valid email is required.",
      phone: "Phone number is required.",
      message: "Message is required.",
      captcha: "Please confirm you are not a robot."
    });

    expect(validateContactForm({ name: "Alex", email: "alex@example.com", phone: "2625550101", message: "Hello", captcha: true, url: "bot" })).toEqual({
      url: "Submission blocked."
    });
  });
});

describe("login landing utilities", () => {
  it("shows the login gate only when there is no saved session", () => {
    expect(getLoginGateState(undefined)).toBe("login");
    expect(getLoginGateState({ email: "student@example.com", remembered: true, createdAt: "2026-05-10T00:00:00.000Z" })).toBe("app");
  });

  it("validates login forms", () => {
    expect(validateLoginForm({ username: "", password: "" })).toEqual({
      username: "Username is required.",
      password: "Password is required."
    });

    expect(validateLoginForm({ username: "student", password: "blackbelt" })).toEqual({});
  });

  it("keeps local fallback credentials on the strong-password floor", () => {
    const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

    expect(prototypeManagerLogin.password).toMatch(strongPasswordPattern);
    expect(prototypeDeveloperLogin.password).toMatch(strongPasswordPattern);
  });

  it("selects the reduced-motion launch phase", () => {
    expect(getInitialLaunchPhase(false)).toBe("playing");
    expect(getInitialLaunchPhase(true)).toBe("final-logo");
  });
});
