import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { AppStateProvider } from "./state";

function stubMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

function stubResizeObserver(height = 360) {
  class ResizeObserverMock {
    private callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe = (target: Element) => {
      this.callback([
        {
          target,
          contentRect: { height } as DOMRectReadOnly
        } as ResizeObserverEntry
      ], this as unknown as ResizeObserver);
    };

    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverMock
  });
}

function renderLoggedInApp(path = "/", role: "staff" | "student" = "staff") {
  window.localStorage.setItem("chos.session.v1", JSON.stringify({ email: "manager123@chos.prototype", remembered: true, createdAt: "2026-05-10T00:00:00.000Z" }));
  window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "manager123@chos.prototype", role }]));

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>
  );
}

function renderLoggedOutApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>
  );
}

describe("login landing", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    window.scrollTo = vi.fn();
    stubMatchMedia();
  });

  it("renders the centered portrait blend image on the login screen", () => {
    const { container } = renderLoggedOutApp("/");

    const portrait = container.querySelector(".login-portrait-stage img");
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(portrait).toHaveAttribute("src", "/Perfect1.png");
    expect(portrait?.parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("signs the prototype manager credential directly into staff mode without post-login popups", async () => {
    const { container } = renderLoggedOutApp("/");

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "Manager123" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(container.querySelector(".authenticated-app-shell")).toHaveClass("is-login-transitioning");
    expect(await screen.findByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Account type" })).not.toBeInTheDocument();
    expect(screen.queryByText("Signed in to Cho's manager prototype.")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: "manager123@chos.prototype", remembered: true });
    expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toContainEqual({ email: "manager123@chos.prototype", role: "staff" });
  });

  it("returns refreshed guest sessions to the opening login animation", () => {
    window.localStorage.setItem("chos.session.v1", JSON.stringify({ email: "guest@chos.prototype", remembered: false, createdAt: "2026-05-16T00:00:00.000Z" }));
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "guest@chos.prototype", role: "staff" }]));

    const { container } = renderLoggedOutApp("/");

    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(container.querySelector(".launch-loader")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("chos.session.v1")).toBeNull();
  });

  it("keeps a refreshed Manager123 session on the Profile page", () => {
    window.localStorage.setItem("chos.session.v1", JSON.stringify({ email: "manager123@chos.prototype", remembered: true, createdAt: "2026-05-16T00:00:00.000Z" }));
    window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "manager123@chos.prototype", role: "staff" }]));

    renderLoggedOutApp("/");

    expect(screen.queryByTestId("auth-gate")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.session.v1") ?? "{}")).toMatchObject({ email: "manager123@chos.prototype", remembered: true });
  });

  it("keeps the portrait available on the reduced-motion login screen", () => {
    stubMatchMedia(true);
    const { container } = renderLoggedOutApp("/");

    expect(container.querySelector(".auth-logo")).toHaveClass("is-settled");
    expect(container.querySelector(".login-portrait-stage img")).toHaveAttribute("src", "/Perfect1.png");
  });

  it("keeps only the portrait visibility toggle on the login screen", () => {
    renderLoggedOutApp("/");

    expect(screen.getByRole("button", { name: "Hide portrait background" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Choose portrait background" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use Perfect1.png portrait background" })).not.toBeInTheDocument();
  });

  it("toggles the portrait blend image on and off from the login screen", () => {
    const { container } = renderLoggedOutApp("/");

    expect(container.querySelector(".login-portrait-stage img")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide portrait background" }));
    expect(container.querySelector(".login-portrait-stage img")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show portrait background" }));
    expect(container.querySelector(".login-portrait-stage img")).toBeInTheDocument();
  });

  it("keeps the portrait toggle above the launch handoff overlay", () => {
    const { container } = renderLoggedOutApp("/");

    expect(screen.getByRole("button", { name: "Hide portrait background" })).toBeInTheDocument();
    expect(container.querySelector(".launch-loader")).toBeInTheDocument();
    expect(container.querySelector(".login-portrait-toggle")).toHaveClass("is-above-launch");
  });
});

describe("app fullscreen behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    window.scrollTo = vi.fn();
    stubMatchMedia();
  });

  it("requests fullscreen on the first app interaction when supported", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });

    renderLoggedOutApp("/");
    fireEvent.pointerDown(document);

    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledTimes(1));
  });

  it("does not request fullscreen again while already fullscreen", () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.documentElement });

    renderLoggedOutApp("/");
    fireEvent.pointerDown(document);

    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it("signs guest users into the app without post-login popups", async () => {
    const { container } = renderLoggedOutApp("/");

    fireEvent.click(screen.getByRole("button", { name: "Sign in as Guest" }));

    expect(container.querySelector(".authenticated-app-shell")).toHaveClass("is-login-transitioning");
    expect(await screen.findByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Account type" })).not.toBeInTheDocument();
    expect(screen.queryByText("Signed in as guest.")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("chos.accountRoles.v1") ?? "[]")).toContainEqual({ email: "guest@chos.prototype", role: "staff" });
  });
});

describe("post-login operations app", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    window.scrollTo = vi.fn();
    stubMatchMedia();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the manager home page first after login", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T12:00:00-05:00"));
    renderLoggedInApp("/");

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    const profileTitleHeader = screen.getByLabelText("Profile page header");
    expect(profileTitleHeader.querySelector(".manager-home-profile-title-frame")).toBeInTheDocument();
    expect(profileTitleHeader.querySelectorAll("svg.manager-home-title-rule-art")).toHaveLength(2);
    expect(profileTitleHeader.querySelector(".manager-home-title-ornament")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manager's Page" })).not.toBeInTheDocument();
    const managerPanelLink = within(profileTitleHeader).getByRole("link", { name: "Manager's Panel" });
    expect(managerPanelLink).toHaveAttribute("href", "/manager");
    expect(managerPanelLink.querySelector("img.manager-home-panel-icon")).toHaveAttribute("src", expect.stringContaining("ManagerPage.webp"));
    expect(within(managerPanelLink).getByText("Manager's Panel")).toBeInTheDocument();
    const homeLogoutButton = within(profileTitleHeader).getByRole("button", { name: "Log Out" });
    expect(homeLogoutButton.querySelector("img.manager-home-logout-icon")).toHaveAttribute("src", expect.stringContaining("ManagerLogoutProfessional.png"));
    expect(within(homeLogoutButton).getByText("Log Out")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Manager's Page" })).not.toBeInTheDocument();
    const homeOverview = screen.getByLabelText("Manager home overview");
    const profileOverview = within(homeOverview).getByLabelText("Manager profile overview");
    const weeklySchedule = within(homeOverview).getByLabelText("Weekly manager schedule");
    expect(profileOverview.compareDocumentPosition(weeklySchedule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(weeklySchedule.compareDocumentPosition(screen.getByLabelText("Messages and event notifications")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(profileOverview).getByRole("img", { name: "Cho's Manager profile portrait" })).toHaveAttribute("src", expect.stringContaining("assets/CheetahProfilePic/Cheetah.png"));
    expect(within(profileOverview).getByRole("heading", { name: "Cho's Manager" })).toBeInTheDocument();
    expect(within(profileOverview).getByText("Head Coach & Manager")).toBeInTheDocument();
    expect(within(profileOverview).getByText("Team: Summer Champions")).toBeInTheDocument();
    expect(within(profileOverview).getByText("Member Since: May 2026")).toBeInTheDocument();
    expect(within(profileOverview).getByText("Team Size: 9 Members")).toBeInTheDocument();
    expect(within(weeklySchedule).getByRole("heading", { name: "May 17 - 23, 2026" })).toBeInTheDocument();
    expect(within(weeklySchedule).getByRole("button", { name: "Select Monday, May 18, 2026" })).toHaveAttribute("aria-pressed", "true");
    expect(within(weeklySchedule).getByText("Monday, May 18, 2026")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("Youth Beginners")).toBeInTheDocument();
    fireEvent.click(within(weeklySchedule).getByRole("button", { name: "Next week" }));
    expect(within(weeklySchedule).getByRole("heading", { name: "May 24 - 30, 2026" })).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("Color Belt Testing")).toBeInTheDocument();
    const feedPanel = screen.getByLabelText("Messages and event notifications");
    const overviewHandle = screen.getByRole("button", { name: "Collapse manager overview" });
    expect(homeOverview.compareDocumentPosition(overviewHandle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overviewHandle.compareDocumentPosition(feedPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overviewHandle).toHaveAttribute("aria-expanded", "true");
    expect(feedPanel).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Messages & Event Notifications" })).not.toBeInTheDocument();
    expect(screen.queryByText("One clean Home Page feed for every message and event notification.")).not.toBeInTheDocument();
    expect(screen.getByText("4 Messages")).toBeInTheDocument();
    expect(screen.getByText("2 Event Notifications")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Search messages and event notifications" })).not.toBeInTheDocument();
    const searchTrigger = screen.getByRole("button", { name: "Open search messages and event notifications" });
    expect(searchTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(searchTrigger);
    const feedSearchBox = screen.getByRole("searchbox", { name: "Search messages and event notifications" });
    expect(feedSearchBox).toHaveAttribute("placeholder", "Search messages and event notifications...");
    expect(screen.getByRole("button", { name: "Close search messages and event notifications" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Messages and event notifications from May 15, 2026" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Messages and event notifications from May 14, 2026" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Messages and event notifications from May 13, 2026" })).toBeInTheDocument();
    expect(screen.getByText("10:30 AM")).toBeInTheDocument();
    expect(screen.queryByText("Sent May 15, 2026 at 10:30 AM")).not.toBeInTheDocument();
    ["System Admin", "Head Coach", "John Doe", "Merch Store", "Event Team"].forEach((sender) => {
      expect(screen.getAllByText(sender).length).toBeGreaterThan(0);
    });
    const summerEventRow = screen.getByRole("button", { name: /System Admin.*Event Update: Summer Championship/i });
    expect(summerEventRow.closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--event");
    expect(screen.getByRole("button", { name: /Head Coach.*Practice Session Reminder/i }).closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--message");
    expect(screen.getByRole("button", { name: /Event Team.*Upcoming Event: Parent Meeting/i }).closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--event");
    expect(screen.queryByLabelText("Selected feed item detail")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Event Update: Summer Championship details")).not.toBeInTheDocument();
    fireEvent.click(summerEventRow);

    expect(summerEventRow).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Event Update: Summer Championship" })).toBeInTheDocument();
    expect(screen.getAllByText("Sent May 15, 2026 at 10:30 AM").length).toBeGreaterThan(0);
    expect(screen.getByText("Event Details")).toBeInTheDocument();
    expect(screen.getByText("Date: July 25 - July 27, 2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Manager app launcher")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Direct message center")).not.toBeInTheDocument();

    const attendanceRow = screen.getByRole("button", { name: /John Doe.*Attendance Confirmation/i });
    fireEvent.click(attendanceRow);

    expect(attendanceRow).toHaveAttribute("aria-expanded", "true");
    expect(attendanceRow.closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--message", "is-selected");
    expect(screen.getByLabelText("Attendance Confirmation details")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attendance Confirmation" })).toBeInTheDocument();
    expect(screen.getAllByText("Sent May 15, 2026 at 8:45 AM").length).toBeGreaterThan(0);

    fireEvent.click(attendanceRow);

    expect(attendanceRow).toHaveAttribute("aria-expanded", "false");
    expect(attendanceRow.closest(".manager-home-feed-item")).not.toHaveClass("is-selected");
    expect(screen.queryByLabelText("Attendance Confirmation details")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Message Settings" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Manager app launcher")).not.toBeInTheDocument();
  });

  it("opens the manager panel from the manager home icon button", () => {
    renderLoggedInApp("/");

    fireEvent.click(screen.getByRole("link", { name: "Manager's Panel" }));

    expect(screen.getByLabelText("Manager app launcher")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MANAGER PANEL" })).toBeInTheDocument();
  });

  it("filters the Home feed by message and event notification count controls", () => {
    renderLoggedInApp("/");

    const messageFilter = screen.getByRole("button", { name: "4 Messages" });
    const eventFilter = screen.getByRole("button", { name: "2 Event Notifications" });

    expect(messageFilter).toHaveAttribute("aria-pressed", "false");
    expect(eventFilter).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Head Coach.*Practice Session Reminder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /System Admin.*Event Update: Summer Championship/i })).toBeInTheDocument();

    fireEvent.click(messageFilter);

    expect(messageFilter).toHaveAttribute("aria-pressed", "true");
    expect(eventFilter).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Head Coach.*Practice Session Reminder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /John Doe.*Attendance Confirmation/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /System Admin.*Event Update: Summer Championship/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Event Team.*Upcoming Event: Parent Meeting/i })).not.toBeInTheDocument();

    fireEvent.click(eventFilter);

    expect(messageFilter).toHaveAttribute("aria-pressed", "false");
    expect(eventFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /Head Coach.*Practice Session Reminder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /John Doe.*Attendance Confirmation/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /System Admin.*Event Update: Summer Championship/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Event Team.*Upcoming Event: Parent Meeting/i })).toBeInTheDocument();

    fireEvent.click(eventFilter);

    expect(messageFilter).toHaveAttribute("aria-pressed", "false");
    expect(eventFilter).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Head Coach.*Practice Session Reminder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /System Admin.*Event Update: Summer Championship/i })).toBeInTheDocument();
  });

  it("lets managers compose messages and event notifications from the Home feed header", () => {
    renderLoggedInApp("/");

    const feedPanel = screen.getByLabelText("Messages and event notifications");
    const composeButton = within(feedPanel).getByRole("button", { name: "Compose" });

    expect(composeButton.closest(".manager-home-feed-counts")).toBeInTheDocument();

    fireEvent.click(composeButton);

    const dialog = screen.getByRole("dialog", { name: "Compose" });
    expect(within(dialog).getByRole("radio", { name: "Contact Message" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "Event Notification" })).toBeInTheDocument();
    expect(dialog.querySelector(".manager-compose-all-users")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Recipients")).toBeInTheDocument();
    expect(within(dialog).getByText("0 selected")).toBeInTheDocument();
    const selectedPanel = within(dialog).getByLabelText("Selected compose recipients");
    expect(within(selectedPanel).getByText("No contacts selected yet.")).toBeInTheDocument();
    const quickActions = within(dialog).getByLabelText("Quick recipient actions");
    expect(within(quickActions).getByText("Quick Audience")).toBeInTheDocument();
    expect(within(quickActions).getByText("Tap an active preset again to clear.")).toBeInTheDocument();
    const allUsersQuickAction = within(quickActions).getByRole("checkbox", { name: "All Users" });
    const allStaffQuickAction = within(quickActions).getByRole("checkbox", { name: "All Staff" });
    const allStudentsQuickAction = within(quickActions).getByRole("checkbox", { name: "All Students" });
    expect(allUsersQuickAction).not.toBeChecked();
    expect(allStaffQuickAction).not.toBeChecked();
    expect(allStudentsQuickAction).not.toBeChecked();
    fireEvent.click(allStaffQuickAction);
    expect(allStaffQuickAction).toBeChecked();
    expect(within(dialog).getByText("1 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("All Staff")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("1 contact")).toBeInTheDocument();
    fireEvent.click(allStaffQuickAction);
    expect(allStaffQuickAction).not.toBeChecked();
    expect(within(dialog).getByText("0 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("No contacts selected yet.")).toBeInTheDocument();
    fireEvent.click(allStudentsQuickAction);
    expect(allStudentsQuickAction).toBeChecked();
    expect(within(dialog).getByText("20 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("All Students")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("20 contacts")).toBeInTheDocument();
    expect(within(selectedPanel).queryByText("All Staff")).not.toBeInTheDocument();
    fireEvent.click(allStudentsQuickAction);
    expect(allStudentsQuickAction).not.toBeChecked();
    expect(within(dialog).getByText("0 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("No contacts selected yet.")).toBeInTheDocument();
    fireEvent.click(allUsersQuickAction);
    expect(allUsersQuickAction).toBeChecked();
    expect(within(selectedPanel).getByText("All Users")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("41 contacts")).toBeInTheDocument();
    fireEvent.click(allUsersQuickAction);
    expect(allUsersQuickAction).not.toBeChecked();
    expect(within(dialog).getByText("0 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("No contacts selected yet.")).toBeInTheDocument();
    const contactsButton = within(dialog).getByRole("button", { name: "Contacts" });
    expect(contactsButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "Contacts" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox", { name: /Talia Brooks/i })).not.toBeInTheDocument();

    fireEvent.click(contactsButton);

    expect(contactsButton).toHaveAttribute("aria-expanded", "true");
    const contactsDialog = screen.getByRole("dialog", { name: "Contacts" });
    expect(within(contactsDialog).getByText("41 visible · 0 selected")).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("heading", { name: "Staff" })).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("heading", { name: "Students" })).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("heading", { name: "Parents" })).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("checkbox", { name: /Instructor Team/i })).toBeInTheDocument();
    expect(within(contactsDialog).getByRole("checkbox", { name: /Talia Brooks/i })).not.toBeChecked();
    expect(within(contactsDialog).getByRole("checkbox", { name: /Monica Brooks/i })).not.toBeChecked();
    const studentsContacts = within(contactsDialog).getByRole("group", { name: "Students contacts" });
    const parentsContacts = within(contactsDialog).getByRole("group", { name: "Parents contacts" });
    const collapseStudentsButton = within(studentsContacts).getByRole("button", { name: "Collapse Students" });
    fireEvent.click(collapseStudentsButton);
    expect(within(studentsContacts).getByRole("button", { name: "Expand Students" })).toHaveAttribute("aria-expanded", "false");
    expect(within(studentsContacts).queryByRole("checkbox", { name: /Talia Brooks/i })).not.toBeInTheDocument();
    fireEvent.click(within(studentsContacts).getByRole("button", { name: "Expand Students" }));
    expect(within(studentsContacts).getByRole("button", { name: "Collapse Students" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(studentsContacts).getByRole("button", { name: "Select all Students" }));
    expect(allUsersQuickAction).not.toBeChecked();
    expect(within(dialog).getByText("20 selected")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("All Students")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("20 contacts")).toBeInTheDocument();
    expect(within(selectedPanel).queryByText("Talia Brooks")).not.toBeInTheDocument();
    expect(within(contactsDialog).getByText("41 visible · 20 selected")).toBeInTheDocument();
    expect(within(studentsContacts).getByRole("checkbox", { name: /Talia Brooks/i })).toBeChecked();
    expect(within(parentsContacts).getByRole("checkbox", { name: /Monica Brooks/i })).not.toBeChecked();
    fireEvent.click(within(contactsDialog).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Contacts" })).not.toBeInTheDocument();
    fireEvent.click(allUsersQuickAction);
    expect(within(selectedPanel).getByText("All Users")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("41 contacts")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: "Event Notification" }));
    fireEvent.change(within(dialog).getByLabelText("Subject"), { target: { value: "Weather Closure" } });
    fireEvent.change(within(dialog).getByLabelText("Message body"), {
      target: { value: "The studio is closed tonight because of severe weather." }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send Compose" }));

    expect(screen.queryByRole("dialog", { name: "Compose" })).not.toBeInTheDocument();
    expect(screen.getByText("3 Event Notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cho's Manager.*Weather Closure/i })).toBeInTheDocument();
    expect(screen.getByText("Compose sent to all users.")).toBeInTheDocument();
  });

  it("logs out from the manager home icon button", () => {
    renderLoggedInApp("/");

    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
  });

  it("collapses, expands, and drag-adjusts the manager overview from the Home handle", () => {
    stubResizeObserver(360);
    renderLoggedInApp("/");

    const homeOverview = screen.getByLabelText("Manager home overview");
    const overviewStage = homeOverview.closest(".manager-home-overview-stage");
    const feedPanel = screen.getByLabelText("Messages and event notifications");
    expect(overviewStage).toHaveAttribute("data-overview-state", "expanded");

    fireEvent.click(screen.getByRole("button", { name: "Collapse manager overview" }));

    expect(overviewStage).toHaveAttribute("data-overview-state", "collapsed");
    const expandHandle = screen.getByRole("button", { name: "Expand manager overview" });
    expect(expandHandle).toHaveAttribute("aria-expanded", "false");
    expect(feedPanel).toBeInTheDocument();

    fireEvent.click(expandHandle);

    const collapseHandle = screen.getByRole("button", { name: "Collapse manager overview" });
    expect(overviewStage).toHaveAttribute("data-overview-state", "expanded");
    expect(collapseHandle).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(collapseHandle, { pointerId: 1, clientY: 300 });
    fireEvent.pointerMove(collapseHandle, { pointerId: 1, clientY: 192 });
    fireEvent.pointerUp(collapseHandle, { pointerId: 1, clientY: 192 });

    expect(overviewStage).toHaveAttribute("data-overview-state", "partial");
    expect(Number(overviewStage?.getAttribute("data-overview-progress"))).toBeLessThan(1);
    expect(feedPanel).toBeInTheDocument();
  });

  it("lets managers update the Home profile picture in real time", async () => {
    renderLoggedInApp("/");

    const profileOverview = within(screen.getByLabelText("Manager home overview")).getByLabelText("Manager profile overview");
    const profileImage = within(profileOverview).getByRole("img", { name: "Cho's Manager profile portrait" });
    const photoUpload = within(profileOverview).getByLabelText("Upload manager profile picture") as HTMLInputElement;

    expect(profileImage).toHaveAttribute("src", expect.stringContaining("assets/CheetahProfilePic/Cheetah.png"));
    expect(photoUpload).toHaveAttribute("type", "file");
    expect(photoUpload.closest(".manager-home-profile-frame")).toBeInTheDocument();

    fireEvent.change(photoUpload, {
      target: {
        files: [new File(["manager profile"], "manager-profile.png", { type: "image/png" })]
      }
    });

    await waitFor(() => {
      expect(profileImage).toHaveAttribute("src", expect.stringContaining("data:image/png;base64,"));
    });

    const savedProfile = JSON.parse(window.localStorage.getItem("chos.profile.v1") ?? "{}") as { photoDataUrl?: string };
    expect(savedProfile.photoDataUrl).toContain("data:image/png;base64,");
  });

  it("opens profile settings from the Home profile card icon", async () => {
    renderLoggedInApp("/");

    const profileOverview = within(screen.getByLabelText("Manager home overview")).getByLabelText("Manager profile overview");
    const profileSettingsLink = within(profileOverview).getByRole("link", { name: "Profile Settings" });

    expect(profileSettingsLink).toHaveAttribute("href", "/manager?profile=settings");
    expect(profileSettingsLink.querySelector("img.manager-home-profile-settings-icon")).toHaveAttribute("src", expect.stringContaining("ManagerProfileSettings.png"));

    fireEvent.click(profileSettingsLink);

    expect(await screen.findByRole("dialog", { name: "Manager profile settings" })).toBeInTheDocument();
  });

  it("toggles light and dark mode from the Home profile card without a toast", () => {
    renderLoggedInApp("/");

    const profileOverview = within(screen.getByLabelText("Manager home overview")).getByLabelText("Manager profile overview");
    const themeSwitch = within(profileOverview).getByRole("switch", { name: "Switch to light mode" });

    expect(themeSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.click(themeSwitch);

    const savedProfile = JSON.parse(window.localStorage.getItem("chos.profile.v1") || "{}");
    expect(savedProfile.theme).toBe("light");
    expect(window.localStorage.getItem("chos.theme.v1")).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(within(profileOverview).getByRole("switch", { name: "Switch to dark mode" })).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("Light mode enabled.")).not.toBeInTheDocument();
    expect(screen.queryByText("Dark mode enabled.")).not.toBeInTheDocument();
  });

  it("keeps the Home weekly agenda rows compact on busy recurring class days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T12:00:00-05:00"));
    renderLoggedInApp("/");

    const weeklySchedule = within(screen.getByLabelText("Manager home overview")).getByLabelText("Weekly manager schedule");
    fireEvent.click(within(weeklySchedule).getByRole("button", { name: "Select Tuesday, May 19, 2026" }));

    expect(within(weeklySchedule).getByText("Tuesday, May 19, 2026")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("Private Intro Lesson")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("Youth Foundations")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("Family Training")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("12:30 PM")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("5:00 PM")).toBeInTheDocument();
    expect(within(weeklySchedule).getByText("6:00 PM")).toBeInTheDocument();
    expect(within(weeklySchedule).queryByText("5:00 PM - 5:45 PM")).not.toBeInTheDocument();
    expect(within(weeklySchedule).queryByText("6:00 PM - 6:50 PM")).not.toBeInTheDocument();
  });

  it("lets managers select multiple home feed items and delete them together", () => {
    renderLoggedInApp("/");

    expect(screen.queryByRole("button", { name: "Delete selected" })).not.toBeInTheDocument();

    const attendanceCheckbox = screen.getByRole("checkbox", { name: "Select Attendance Confirmation" });
    const eventCheckbox = screen.getByRole("checkbox", { name: "Select Event Update: Summer Championship" });

    fireEvent.click(attendanceCheckbox);
    fireEvent.click(eventCheckbox);

    expect(attendanceCheckbox).toBeChecked();
    expect(eventCheckbox).toBeChecked();
    expect(screen.queryByLabelText("Attendance Confirmation details")).not.toBeInTheDocument();
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

    expect(screen.queryByText("Attendance Confirmation")).not.toBeInTheDocument();
    expect(screen.queryByText("Event Update: Summer Championship")).not.toBeInTheDocument();
    expect(screen.getByText("3 Messages")).toBeInTheDocument();
    expect(screen.getByText("1 Event Notification")).toBeInTheDocument();
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete selected" })).not.toBeInTheDocument();
  });

  it("logs out from the manager launcher icon button", () => {
    renderLoggedInApp("/manager");

    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
  });

  it("opens the manager landing launcher with the approved icon order", () => {
    renderLoggedInApp("/manager");

    const managerHeader = screen.getByLabelText("Manager panel page header");
    expect(within(managerHeader).getByRole("heading", { name: "MANAGER PANEL" })).toBeInTheDocument();
    expect(within(managerHeader).queryByRole("button", { name: "Profile Settings" })).not.toBeInTheDocument();
    expect(within(managerHeader).queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(managerHeader.querySelectorAll(".manager-home-title-rule")).toHaveLength(2);
    expect(managerHeader.querySelector(".manager-launcher-title-icon")).not.toBeInTheDocument();
    const managerProfileLink = within(managerHeader).getByRole("link", { name: "Profile" });
    expect(managerProfileLink).toHaveAttribute("href", "/");
    expect(managerProfileLink.querySelector("img.manager-home-profile-action-photo")).toHaveAttribute("src", expect.stringContaining("assets/CheetahProfilePic/Cheetah.png"));
    expect(within(managerProfileLink).getByText("Profile")).toBeInTheDocument();
    expect(managerHeader.querySelector(".manager-home-top-actions")).toBeInTheDocument();
    const launcherLogoutButton = within(managerHeader).getByRole("button", { name: "Log Out" });
    expect(launcherLogoutButton).toHaveTextContent("Log Out");
    expect(launcherLogoutButton.querySelector("img.manager-home-logout-icon")).toHaveAttribute("src", expect.stringContaining("ManagerLogoutProfessional.png"));
    expect(screen.queryByText("Tools and settings are organized below so you can jump into each manager page quickly.")).not.toBeInTheDocument();
    expect(screen.queryByText("Use the icons to open messages, students, classes, scheduling, events, merchandise, and future reports.")).not.toBeInTheDocument();

    const launcher = screen.getByLabelText("Manager app launcher");
    expect(launcher).toHaveClass("manager-launcher-sidebar");
    expect(launcher).toHaveAttribute("data-orientation", "vertical");
    expect(launcher.parentElement).toHaveClass("manager-launcher-body");
    const launcherLinks = within(launcher).getAllByRole("link");

    const approvedIconOrder = [
      "Dashboard",
      "Messages",
      "Students",
      "Classes",
      "Events",
      "Scheduling",
      "Merchandise",
      "Reports"
    ];
    expect(launcherLinks.map((link) => link.textContent?.trim())).toEqual(approvedIconOrder);
    expect(launcherLinks.map((link) => link.getAttribute("title"))).toEqual(approvedIconOrder);
    expect(launcherLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/manager?tool=dashboard",
      "/manager?tool=messages",
      "/manager?tool=students",
      "/manager?tool=classes",
      "/manager?tool=events",
      "/manager?tool=scheduling",
      "/manager?tool=merchandise",
      "/manager?tool=reports"
    ]);
    expect(within(launcher).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    const launcherImages = launcher.querySelectorAll("img.manager-launcher-image");
    const launcherLabels = launcher.querySelectorAll(".manager-launcher-label");
    expect(launcherImages).toHaveLength(8);
    expect(launcherLabels).toHaveLength(8);
    expect(Array.from(launcherLabels).map((label) => label.textContent?.trim())).toEqual(approvedIconOrder);
    launcherImages.forEach((image) => {
      expect(image).toHaveAttribute("src", expect.stringContaining(".webp"));
      expect(image).not.toHaveAttribute("width");
      expect(image).not.toHaveAttribute("height");
      expect(image).toHaveAttribute("draggable", "false");
      expect(image.parentElement).toHaveClass("manager-launcher-graphic");
    });

    const studentsIcon = within(launcher).getByRole("link", { name: "Students" }).querySelector("img.manager-students-emblem");
    expect(studentsIcon).not.toBeNull();
    expect(studentsIcon).toHaveAttribute("src", expect.stringContaining("Students.webp"));
    expect(screen.getByLabelText("Dashboard workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Live studio calendar")).toBeInTheDocument();
    fireEvent.click(within(launcher).getByRole("link", { name: "Students" }));
    expect(screen.getByLabelText("Students workspace")).toBeInTheDocument();
    expect(within(launcher).getByRole("link", { name: "Students" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("20 students listed by belt. Select a name to open student info.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Awakening Dojo" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Manager navigation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Manager quick actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Student Management & Communication" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Quick Stats" })).not.toBeInTheDocument();
  });

  it("collapses and expands the manager launcher sidebar from the glowing rail", () => {
    renderLoggedInApp("/manager");

    const launcherBody = screen.getByLabelText("Manager launcher workspace frame");
    const launcher = screen.getByLabelText("Manager app launcher");
    const collapseRail = screen.getByRole("button", { name: "Collapse manager app launcher" });

    expect(collapseRail).toHaveAttribute("aria-controls", "manager-launcher-sidebar");
    expect(collapseRail).toHaveAttribute("aria-expanded", "true");
    expect(collapseRail.querySelector(".manager-launcher-rail-toggle-bar")).toBeInTheDocument();
    expect(launcherBody).not.toHaveClass("is-sidebar-collapsed");
    expect(launcher).not.toHaveAttribute("hidden");
    expect(within(launcher).getByRole("link", { name: "Dashboard" })).toBeInTheDocument();

    fireEvent.click(collapseRail);

    const expandRail = screen.getByRole("button", { name: "Expand manager app launcher" });
    expect(expandRail).toHaveAttribute("aria-expanded", "false");
    expect(launcherBody).toHaveClass("is-sidebar-collapsed");
    expect(launcher).toHaveAttribute("hidden");
    expect(screen.getByLabelText("Dashboard workspace")).toBeInTheDocument();

    fireEvent.click(expandRail);

    expect(screen.getByRole("button", { name: "Collapse manager app launcher" })).toHaveAttribute("aria-expanded", "true");
    expect(launcherBody).not.toHaveClass("is-sidebar-collapsed");
    expect(launcher).not.toHaveAttribute("hidden");
    expect(within(launcher).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the Manager's Page Messages route focused on message tools", () => {
    renderLoggedInApp("/messages");

    expect(screen.getByRole("heading", { name: "Message Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Messenger Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Follow-Up Automation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marketing Tool" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Text Log" })).toBeInTheDocument();
    const homeMessengerLink = screen.getByRole("link", { name: "Open Home Page Messages" });
    expect(homeMessengerLink).toHaveAttribute("href", "/");
    expect(screen.queryByLabelText("Direct message center")).not.toBeInTheDocument();

    fireEvent.click(homeMessengerLink);

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Messages and event notifications")).toBeInTheDocument();
    expect(screen.queryByLabelText("Direct message center")).not.toBeInTheDocument();
  });

  it("opens the month calendar from the Dashboard icon destination", () => {
    renderLoggedInApp("/dashboard");

    expect(screen.getByLabelText("Manager workspace")).toHaveClass("manager-full-page-shell");
    expect(screen.getByRole("link", { name: "Back to Manager Page" })).toHaveAttribute("href", "/manager");
    expect(screen.getByRole("img", { name: "Cho's Martial Arts" })).toBeInTheDocument();
    const dashboardLogoutButton = screen.getByRole("button", { name: "Log Out" });
    expect(dashboardLogoutButton).toHaveTextContent("");
    expect(dashboardLogoutButton.querySelector("img.manager-logout-icon")).toHaveAttribute("src", expect.stringContaining("ManagerLogoutProfessional.png"));
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Manager app launcher")).not.toBeInTheDocument();
    const liveCalendar = screen.getByLabelText("Live studio calendar");
    const calendarViewControls = within(liveCalendar).getByRole("group", { name: "Calendar view" });
    expect(within(calendarViewControls).getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
    expect(within(liveCalendar).getByRole("grid", { name: /Cho's studio calendar/i })).toHaveClass("manager-calendar-grid--month");
    expect(within(liveCalendar).getByRole("link", { name: "Manage Schedule" })).toHaveAttribute("href", "/schedule");
  });

  it("keeps the manager launcher frame even when a saved account is student mode", () => {
    renderLoggedInApp("/manager", "student");

    expect(screen.getByLabelText("Manager app launcher")).toBeInTheDocument();
    expect(screen.queryByLabelText("Manager navigation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cho's Operations home")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Operations navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cho's Operations" })).not.toBeInTheDocument();
  });

  it("lets the manager edit their own profile settings", () => {
    renderLoggedInApp("/manager?profile=settings");

    const dialog = screen.getByRole("dialog", { name: "Manager profile settings" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Master Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Username"), { target: { value: "master-cho" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "manager@chos.test" } });
    fireEvent.change(within(dialog).getByLabelText("Phone"), { target: { value: "(262) 555-0199" } });
    fireEvent.change(within(dialog).getByLabelText("New Password"), { target: { value: "dojo-pass-2026" } });
    fireEvent.change(within(dialog).getByLabelText("Confirm Password"), { target: { value: "dojo-pass-2026" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Light" }));
    fireEvent.click(within(dialog).getByLabelText("Receive manager updates and reminders"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Profile Settings" }));

    expect(screen.queryByRole("dialog", { name: "Manager profile settings" })).not.toBeInTheDocument();
    expect(screen.getByText("Manager profile settings saved.")).toBeInTheDocument();
    const savedProfile = JSON.parse(window.localStorage.getItem("chos.profile.v1") || "{}");
    expect(savedProfile).toEqual(expect.objectContaining({
      name: "Master Cho",
      username: "master-cho",
      email: "manager@chos.test",
      phone: "(262) 555-0199",
      updates: false,
      theme: "light",
      passwordUpdatedAt: expect.any(String)
    }));
    expect(savedProfile).not.toHaveProperty("password");
    expect(window.localStorage.getItem("chos.theme.v1")).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("returns managers to the Profile page when closing profile settings", () => {
    renderLoggedInApp("/manager?profile=settings");

    const dialog = screen.getByRole("dialog", { name: "Manager profile settings" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close manager profile settings" }));

    expect(screen.queryByRole("dialog", { name: "Manager profile settings" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Profile page header")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "MANAGER PANEL" })).not.toBeInTheDocument();
  });

  it("opens a polished future reports page from the manager launcher", () => {
    renderLoggedInApp("/reports");

    expect(screen.getByRole("link", { name: "Back to Manager Page" })).toHaveAttribute("href", "/manager");
    expect(screen.getByRole("img", { name: "Cho's Martial Arts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("lets staff add a new student and creates a welcome text log", () => {
    renderLoggedInApp("/students");

    expect(screen.queryByRole("dialog", { name: "Create New Student" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create New Student" }));
    const dialog = screen.getByRole("dialog", { name: "Create New Student" });

    ["Student Information", "Parent/Guardian Information", "Emergency Contact Information", "Enrollment Details"].forEach((heading) => {
      expect(within(dialog).getByRole("heading", { name: heading })).toBeInTheDocument();
    });

    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Ava Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Date of Birth"), { target: { value: "2016-08-12" } });
    fireEvent.change(within(dialog).getByLabelText("Gender"), { target: { value: "Female" } });
    fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "ava@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Name"), { target: { value: "Jamie Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0199" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Email Address"), { target: { value: "jamie@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Contact Name"), { target: { value: "Taylor Kim" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Relationship"), { target: { value: "Aunt" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Phone Number"), { target: { value: "(262) 555-0120" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Email Address"), { target: { value: "taylor@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Enrollment Date"), { target: { value: "2026-05-14" } });
    fireEvent.change(within(dialog).getByLabelText("Program"), { target: { value: "Youth Foundations" } });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "Active" } });
    fireEvent.change(within(dialog).getByLabelText("Belt rank"), { target: { value: "White" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Student" }));

    expect(screen.getByText("Ava Cho")).toBeInTheDocument();
    const whiteGroup = within(screen.getByLabelText("Student directory by belt")).getByRole("group", { name: "White belt students" });
    expect(within(whiteGroup).getByRole("button", { name: "Open Ava Cho student info" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create New Student" })).not.toBeInTheDocument();
    expect(screen.getByText(/Welcome Ava to Cho's/i)).toBeInTheDocument();
    expect(screen.getByText(/facebook.com\/chosmenomoneefalls/i)).toBeInTheDocument();
  });

  it("keeps prototype state usable when localStorage writes fail", () => {
    renderLoggedInApp("/students");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage quota exceeded.", "QuotaExceededError");
    });

    try {
      fireEvent.click(screen.getByRole("button", { name: "Create New Student" }));
      const dialog = screen.getByRole("dialog", { name: "Create New Student" });
      fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Nora Kim" } });
      fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "nora@example.com" } });
      fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0177" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Create Student" }));

      expect(screen.getByText("Nora Kim")).toBeInTheDocument();
      expect(screen.getByText(/Welcome Nora to Cho's/i)).toBeInTheDocument();
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("shows compact belt blocks and opens student info from a name", () => {
    renderLoggedInApp("/students");

    expect(screen.getByRole("link", { name: "Back to Manager Page" })).toHaveAttribute("href", "/manager");
    expect(screen.getByRole("img", { name: "Cho's Martial Arts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Manager navigation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Operations navigation")).not.toBeInTheDocument();
    const studentsHeader = screen.getByRole("heading", { name: "Students" }).closest(".operations-page-head");
    expect(studentsHeader).not.toBeNull();
    expect(studentsHeader?.closest(".operations-page")).toHaveClass("operations-page--students");
    const headerCreateButton = within(studentsHeader as HTMLElement).getByRole("button", { name: "Create New Student" });
    expect(headerCreateButton).toHaveClass("student-header-add");
    expect(headerCreateButton.closest(".operations-page-action")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Student Directory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create New Student" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create New Student" })).not.toBeInTheDocument();

    const directory = screen.getByLabelText("Student directory by belt");
    expect(directory.closest(".student-directory-panel")).toHaveClass("student-directory-panel--compact");
    expect(screen.queryByRole("table", { name: "Student directory" })).not.toBeInTheDocument();
    expect(screen.getByText("20 students listed by belt. Select a name to open student info.")).toBeInTheDocument();
    expect(within(directory).getAllByTestId("student-name-list-button")).toHaveLength(20);
    expect(within(directory).queryByText("talia.brooks@example.com")).not.toBeInTheDocument();
    expect(within(directory).queryByRole("img", { name: "Talia Brooks profile photo" })).not.toBeInTheDocument();

    const names = () =>
      within(directory)
        .getAllByTestId("student-name-list-button")
        .map((item) => item.querySelector(".student-name-list-name")?.textContent);
    expect(names()).toEqual([
      "Marcus Reid",
      "Talia Brooks",
      "Evan Ramirez",
      "Priya Shah",
      "Elena Torres",
      "Gia Patel",
      "Jacob Ellis",
      "Noah Bennett",
      "Iris Morgan",
      "Natalie Brooks",
      "Caleb Nguyen",
      "Victor Lane",
      "Hannah Kim",
      "Lila Thompson",
      "Derek Miles",
      "Owen Carter",
      "Maya Robinson",
      "Serena Park",
      "Andre Coleman",
      "Sophie Jensen"
    ]);

    fireEvent.click(within(directory).getByRole("button", { name: "Open Maya Robinson student info" }));

    expect(screen.getByRole("dialog", { name: "Maya Robinson Student Info" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maya Robinson Student Info" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Student" })).toBeInTheDocument();
    expect(screen.getByLabelText("Full Name")).toHaveValue("Maya Robinson");
    expect(screen.getByLabelText("Belt rank")).toHaveValue("Dark Brown");
    expect(screen.getByRole("option", { name: "Dark Brown" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Belt rank"), { target: { value: "Blue" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Student Changes" }));

    const blueGroup = within(directory).getByRole("group", { name: "Blue belt students" });
    expect(within(blueGroup).getByRole("button", { name: "Open Maya Robinson student info" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Maya Robinson Student Info" })).not.toBeInTheDocument();
  });

  it("groups the student directory into belt category blocks", () => {
    renderLoggedInApp("/students");

    const directory = screen.getByLabelText("Student directory by belt");
    const expectedGroups: Array<[string, Array<{ age: string; gender: string; name: string }>]> = [
      [
        "White",
        [
          { name: "Marcus Reid", gender: "Male", age: "22" },
          { name: "Talia Brooks", gender: "Female", age: "6" }
        ]
      ],
      [
        "Yellow",
        [
          { name: "Evan Ramirez", gender: "Male", age: "7" },
          { name: "Priya Shah", gender: "Female", age: "25" }
        ]
      ],
      [
        "Orange",
        [
          { name: "Elena Torres", gender: "Female", age: "28" },
          { name: "Gia Patel", gender: "Female", age: "8" }
        ]
      ],
      [
        "Green",
        [
          { name: "Jacob Ellis", gender: "Male", age: "31" },
          { name: "Noah Bennett", gender: "Male", age: "9" }
        ]
      ],
      [
        "Blue",
        [
          { name: "Iris Morgan", gender: "Female", age: "10" },
          { name: "Natalie Brooks", gender: "Female", age: "34" }
        ]
      ],
      [
        "Purple",
        [
          { name: "Caleb Nguyen", gender: "Male", age: "11" },
          { name: "Victor Lane", gender: "Male", age: "38" }
        ]
      ],
      [
        "Brown",
        [
          { name: "Hannah Kim", gender: "Female", age: "42" },
          { name: "Lila Thompson", gender: "Female", age: "12" }
        ]
      ],
      [
        "Red",
        [
          { name: "Derek Miles", gender: "Male", age: "46" },
          { name: "Owen Carter", gender: "Male", age: "14" }
        ]
      ],
      [
        "Dark Brown",
        [
          { name: "Maya Robinson", gender: "Female", age: "16" },
          { name: "Serena Park", gender: "Female", age: "50" }
        ]
      ],
      [
        "Black",
        [
          { name: "Andre Coleman", gender: "Male", age: "18" },
          { name: "Sophie Jensen", gender: "Female", age: "20" }
        ]
      ]
    ];

    expectedGroups.forEach(([belt, studentRows]) => {
      const group = within(directory).getByRole("group", { name: `${belt} belt students` });

      expect(within(group).getByRole("heading", { name: `${belt} Belt` })).toBeInTheDocument();
      expect(within(group).getByText(`${studentRows.length} students`)).toBeInTheDocument();
      expect(within(group).getByText("Name")).toHaveClass("student-name-list-column-label");
      expect(within(group).getByText("Gender")).toHaveClass("student-name-list-column-label");
      expect(within(group).getByText("Age")).toHaveClass("student-name-list-column-label");
      studentRows.forEach(({ age, gender, name }) => {
        const nameButton = within(group).getByRole("button", { name: `Open ${name} student info` });
        expect(nameButton).toBeInTheDocument();
        expect(within(nameButton).getByText(name)).toHaveClass("student-name-list-name");
        expect(within(nameButton).getByText(gender)).toHaveClass("student-name-list-cell");
        expect(within(nameButton).getByText(age)).toHaveClass("student-name-list-cell--age");
        expect(nameButton.querySelector(".student-name-list-icon")).toBeInTheDocument();
      });
      expect(within(group).queryByText(/@example\.com/)).not.toBeInTheDocument();
    });
  });

  it("lets managers create a new student from the restored students page", () => {
    renderLoggedInApp("/students", "student");

    expect(screen.getByRole("link", { name: "Back to Manager Page" })).toHaveAttribute("href", "/manager");
    expect(screen.queryByLabelText("Manager navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Students" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Student Directory" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Student Check-In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create New Student" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create New Student" }));
    const dialog = screen.getByRole("dialog", { name: "Create New Student" });
    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Leo Park" } });
    fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "leo@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0188" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Student" }));

    expect(screen.getByText("Leo Park")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Leo Park student info" })).toBeInTheDocument();
  });

  it("lets managers delete a selected student from the restored students page", () => {
    renderLoggedInApp("/students");

    expect(screen.getByText("Talia Brooks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Talia Brooks student info" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Student" }));

    expect(screen.queryByText("Talia Brooks")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Talia Brooks Student Info" })).not.toBeInTheDocument();
  });

  it("uses full-page manager chrome instead of a sidebar on tool pages", () => {
    renderLoggedInApp("/students");

    expect(screen.getByLabelText("Manager workspace")).toHaveClass("manager-full-page-shell");
    expect(screen.getByRole("link", { name: "Back to Manager Page" })).toHaveAttribute("href", "/manager");
    expect(screen.getByRole("img", { name: "Cho's Martial Arts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle manager sidebar" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Manager navigation")).not.toBeInTheDocument();
  });

  it("lets staff create schedule items and studio events", () => {
    const { unmount } = renderLoggedInApp("/schedule");

    expect(screen.queryByRole("dialog", { name: "Add Schedule Event" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const scheduleDialog = screen.getByRole("dialog", { name: "Add Schedule Event" });

    fireEvent.change(within(scheduleDialog).getByLabelText("Event title"), { target: { value: "Youth Testing Prep" } });
    fireEvent.change(within(scheduleDialog).getByLabelText("Schedule date"), { target: { value: "2026-05-22" } });
    fireEvent.change(within(scheduleDialog).getByLabelText("Schedule time"), { target: { value: "5:30 PM" } });
    fireEvent.click(within(scheduleDialog).getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Youth Testing Prep")).toBeInTheDocument();
    expect(screen.getByText("2026-05-22 at 5:30 PM")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add Schedule Event" })).not.toBeInTheDocument();

    unmount();
    renderLoggedInApp("/events");

    expect(screen.queryByRole("dialog", { name: "Add Event" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Event" }));
    const eventDialog = screen.getByRole("dialog", { name: "Add Event" });

    fireEvent.change(within(eventDialog).getByLabelText("Event title"), { target: { value: "Black Belt Testing" } });
    fireEvent.change(within(eventDialog).getByLabelText("Event date"), { target: { value: "2026-06-01" } });
    fireEvent.change(within(eventDialog).getByLabelText("Event time"), { target: { value: "6:00 PM" } });
    fireEvent.change(within(eventDialog).getByLabelText("Event details"), { target: { value: "Testing date for eligible students." } });
    fireEvent.click(within(eventDialog).getByRole("button", { name: "Add Event" }));

    expect(screen.getByText("Black Belt Testing")).toBeInTheDocument();
    expect(screen.getByText(/Testing date for eligible students/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add Event" })).not.toBeInTheDocument();
  });

  it("lets staff make a schedule item recurring from the existing Scheduling page", () => {
    renderLoggedInApp("/schedule");

    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const dialog = screen.getByRole("dialog", { name: "Add Schedule Event" });
    fireEvent.change(within(dialog).getByLabelText("Event title"), { target: { value: "Friday Demo Class" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule date"), { target: { value: "2026-05-15" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule time"), { target: { value: "6:15 PM" } });
    fireEvent.click(within(dialog).getByLabelText("Recurring"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Repeats weekly")).toBeInTheDocument();
    expect(screen.getByText("Friday Demo Class")).toBeInTheDocument();
    expect(screen.getByText("2026-05-15 at 6:15 PM")).toBeInTheDocument();
  });

  it("lets staff set a custom title color for schedule items", () => {
    renderLoggedInApp("/schedule");

    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const dialog = screen.getByRole("dialog", { name: "Add Schedule Event" });
    fireEvent.change(within(dialog).getByLabelText("Event title"), { target: { value: "Blue Team Class" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule date"), { target: { value: "2026-05-29" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule time"), { target: { value: "7:00 PM" } });
    fireEvent.change(within(dialog).getByLabelText("Title color"), { target: { value: "#7dd3fc" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Blue Team Class")).toHaveStyle({ color: "#7dd3fc" });
  });

  it("lets staff create a custom schedule type and reuse it from the dropdown", () => {
    renderLoggedInApp("/schedule");

    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const dialog = screen.getByRole("dialog", { name: "Add Schedule Event" });
    fireEvent.change(within(dialog).getByLabelText("Event title"), { target: { value: "Demo Team Practice" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule date"), { target: { value: "2026-05-24" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule time"), { target: { value: "4:15 PM" } });
    fireEvent.change(within(dialog).getByLabelText("Schedule type"), { target: { value: "custom" } });
    const customTypeDialog = screen.getByRole("dialog", { name: "Create schedule type" });
    expect(within(customTypeDialog).getByText("Name the new schedule type.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Custom schedule type")).not.toBeInTheDocument();

    fireEvent.change(within(customTypeDialog).getByLabelText("New schedule type name"), { target: { value: "Demo Team" } });
    fireEvent.click(within(customTypeDialog).getByRole("button", { name: "Submit" }));

    const scheduleType = within(dialog).getByLabelText("Schedule type");
    expect(scheduleType).toHaveValue("Demo Team");
    expect(within(scheduleType).getByRole("option", { name: "Demo Team" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Demo Team Practice")).toBeInTheDocument();
    expect(screen.getAllByText("Demo Team").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));
    const secondDialog = screen.getByRole("dialog", { name: "Add Schedule Event" });
    const secondScheduleType = within(secondDialog).getByLabelText("Schedule type");
    fireEvent.change(secondScheduleType, { target: { value: "Demo Team" } });
    expect(secondScheduleType).toHaveValue("Demo Team");
  });

  it("lets managers create, edit, and remove recurring classes", () => {
    renderLoggedInApp("/classes");

    expect(screen.getByRole("heading", { name: "Classes" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create Class" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New Class" }));
    const createDialog = screen.getByRole("dialog", { name: "Create Class" });
    fireEvent.change(within(createDialog).getByLabelText("Class name"), { target: { value: "Youth Sparring" } });
    fireEvent.click(within(createDialog).getByLabelText("Monday"));
    fireEvent.click(within(createDialog).getByLabelText("Wednesday"));
    fireEvent.change(within(createDialog).getByLabelText("Start time"), { target: { value: "17:15" } });
    fireEvent.change(within(createDialog).getByLabelText("End time"), { target: { value: "18:00" } });
    fireEvent.change(within(createDialog).getByLabelText("Class notes"), { target: { value: "Pads, footwork, and controlled sparring." } });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create Class" }));

    expect(screen.getByText("Youth Sparring")).toBeInTheDocument();
    expect(screen.getByText("Monday, Wednesday")).toBeInTheDocument();
    expect(screen.getByText("5:15 PM - 6:00 PM")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create Class" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Edit Youth Sparring/i }));
    const editDialog = screen.getByRole("dialog", { name: "Edit Youth Sparring" });
    expect(within(editDialog).getByRole("heading", { name: "Edit Youth Sparring" })).toBeInTheDocument();
    fireEvent.change(within(editDialog).getByLabelText("Class name"), { target: { value: "Advanced Sparring" } });
    fireEvent.change(within(editDialog).getByLabelText("End time"), { target: { value: "18:30" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Save Class Changes" }));

    expect(screen.getByText("Advanced Sparring")).toBeInTheDocument();
    expect(screen.getByText("5:15 PM - 6:30 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Edit Advanced Sparring/i }));
    const deleteDialog = screen.getByRole("dialog", { name: "Edit Advanced Sparring" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Remove Class" }));

    expect(screen.queryByText("Advanced Sparring")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit Advanced Sparring" })).not.toBeInTheDocument();
  });

  it("keeps recurring classes visible on the existing Classes page", () => {
    renderLoggedInApp("/classes");

    const todayWeekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
    fireEvent.click(screen.getByRole("button", { name: "New Class" }));
    const dialog = screen.getByRole("dialog", { name: "Create Class" });
    fireEvent.change(within(dialog).getByLabelText("Class name"), { target: { value: "Tiny Tigers" } });
    fireEvent.click(within(dialog).getByLabelText(todayWeekday));
    fireEvent.change(within(dialog).getByLabelText("Start time"), { target: { value: "16:00" } });
    fireEvent.change(within(dialog).getByLabelText("End time"), { target: { value: "16:45" } });
    expect(within(dialog).getByLabelText("Recurring")).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Class" }));

    expect(screen.getByText("Tiny Tigers")).toBeInTheDocument();
    expect(screen.getByText(/4:00 PM - 4:45 PM/)).toBeInTheDocument();
  });

  it("lets managers choose class title color and disable class calendar recurrence", () => {
    renderLoggedInApp("/classes");

    const todayWeekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
    fireEvent.click(screen.getByRole("button", { name: "New Class" }));
    const dialog = screen.getByRole("dialog", { name: "Create Class" });
    fireEvent.change(within(dialog).getByLabelText("Class name"), { target: { value: "Drop In Clinic" } });
    fireEvent.click(within(dialog).getByLabelText(todayWeekday));
    fireEvent.change(within(dialog).getByLabelText("Start time"), { target: { value: "15:00" } });
    fireEvent.change(within(dialog).getByLabelText("End time"), { target: { value: "15:45" } });
    fireEvent.change(within(dialog).getByLabelText("Title color"), { target: { value: "#f9a8d4" } });
    fireEvent.click(within(dialog).getByLabelText("Recurring"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Class" }));

    expect(screen.getByText("Drop In Clinic")).toHaveStyle({ color: "#f9a8d4" });
    expect(screen.getByText("Not recurring on calendar")).toBeInTheDocument();
  });

  it("keeps manager workflow pages in compact directory-first layouts", () => {
    const { unmount } = renderLoggedInApp("/classes");

    const classesHeader = screen.getByRole("heading", { name: "Classes" }).closest(".operations-page-head");
    expect(classesHeader?.closest(".operations-page")).toHaveClass("operations-page--workflow");
    expect(within(classesHeader as HTMLElement).getByRole("button", { name: "New Class" }).closest(".operations-page-action")).toBeInTheDocument();
    expect(screen.getByLabelText("Class directory")).toHaveClass("workflow-directory-grid");
    expect(screen.queryByRole("dialog", { name: "Create Class" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create Class" })).not.toBeInTheDocument();
    const classDirectory = screen.getByLabelText("Class directory");
    expect(within(classDirectory).getByText("Class")).toHaveClass("workflow-directory-column-label");
    expect(within(classDirectory).getByText("Days")).toHaveClass("workflow-directory-column-label");
    expect(within(classDirectory).getByText("Time")).toHaveClass("workflow-directory-column-label");
    expect(within(classDirectory).getByRole("button", { name: "Edit Youth Foundations" })).toBeInTheDocument();

    unmount();
    const scheduleRender = renderLoggedInApp("/schedule");
    const scheduleHeader = screen.getByRole("heading", { name: "Schedule" }).closest(".operations-page-head");
    expect(scheduleHeader?.closest(".operations-page")).toHaveClass("operations-page--workflow");
    expect(within(scheduleHeader as HTMLElement).getByRole("button", { name: "Add Schedule Event" }).closest(".operations-page-action")).toBeInTheDocument();
    const scheduleDirectory = screen.getByLabelText("Schedule directory");
    expect(scheduleDirectory).toHaveClass("workflow-directory-grid");
    expect(screen.queryByRole("dialog", { name: "Add Schedule Event" })).not.toBeInTheDocument();
    expect(within(scheduleDirectory).getByRole("group", { name: "Class schedule items" })).toBeInTheDocument();
    expect(within(scheduleDirectory).getByRole("group", { name: "Private lesson schedule items" })).toBeInTheDocument();
    expect(within(scheduleDirectory).getAllByText("Title")[0]).toHaveClass("workflow-directory-column-label");
    expect(within(scheduleDirectory).getAllByText("Date")[0]).toHaveClass("workflow-directory-column-label");
    expect(within(scheduleDirectory).getAllByText("Time")[0]).toHaveClass("workflow-directory-column-label");

    scheduleRender.unmount();
    const eventsRender = renderLoggedInApp("/events");
    const eventsHeader = screen.getByRole("heading", { name: "Events" }).closest(".operations-page-head");
    expect(eventsHeader?.closest(".operations-page")).toHaveClass("operations-page--workflow");
    expect(within(eventsHeader as HTMLElement).getByRole("button", { name: "Add Event" }).closest(".operations-page-action")).toBeInTheDocument();
    const eventDirectory = screen.getByLabelText("Event directory");
    expect(eventDirectory).toHaveClass("workflow-directory-grid");
    expect(screen.queryByRole("dialog", { name: "Add Event" })).not.toBeInTheDocument();
    expect(within(eventDirectory).getByRole("group", { name: "Students events" })).toBeInTheDocument();
    expect(within(eventDirectory).getByRole("group", { name: "Families events" })).toBeInTheDocument();

    eventsRender.unmount();
    renderLoggedInApp("/merchandise");
    const merchandiseHeader = screen.getByRole("heading", { name: "Merchandise" }).closest(".operations-page-head");
    expect(merchandiseHeader?.closest(".operations-page")).toHaveClass("operations-page--workflow");
    expect(within(merchandiseHeader as HTMLElement).getByRole("button", { name: "Add New Merchandise" }).closest(".operations-page-action")).toBeInTheDocument();
    const productDirectory = screen.getByLabelText("Product directory");
    expect(productDirectory).toHaveClass("workflow-directory-grid");
    expect(within(productDirectory).getByRole("group", { name: "Gloves merchandise" })).toBeInTheDocument();
    expect(within(productDirectory).getByRole("group", { name: "Uniforms merchandise" })).toBeInTheDocument();
    expect(within(productDirectory).getByRole("button", { name: "Edit Youth Boxing Gloves" })).toBeInTheDocument();
  });

  it("lets students check in and see rank progress", () => {
    renderLoggedInApp("/check-ins", "student");

    expect(screen.getByRole("heading", { name: "Student Check-In" })).toBeInTheDocument();
    expect(screen.getByText(/Current rank/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check In Today" }));

    expect(screen.getByText(/Checked in today/i)).toBeInTheDocument();
    expect(screen.getByText(/Classes attended/i)).toBeInTheDocument();
  });

  it("queues missed-class follow-up texts for students who missed three classes", () => {
    renderLoggedInApp("/messages");

    fireEvent.click(screen.getByRole("button", { name: "Send Missed-Class Follow-Ups" }));

    expect(screen.getAllByText(/missed you in class/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/missed 3 classes/i).length).toBeGreaterThan(0);
  });

  it("sends a marketing blast for discounts and monthly specials", () => {
    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "May special: 10% off gloves this month." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Marketing Blast" }));

    expect(screen.getAllByText(/May special: 10% off gloves this month/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Marketing blast/i).length).toBeGreaterThan(0);
  });

  it("expands selected messages inside the single Home feed panel", () => {
    renderLoggedInApp("/");

    const attendanceRow = screen.getByRole("button", { name: /John Doe.*Attendance Confirmation/i });
    expect(attendanceRow.closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--message");

    fireEvent.click(attendanceRow);

    expect(attendanceRow).toHaveAttribute("aria-expanded", "true");
    expect(attendanceRow.closest(".manager-home-feed-item")).toHaveClass("is-selected");
    expect(screen.getByLabelText("Attendance Confirmation details")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attendance Confirmation" })).toBeInTheDocument();
    expect(screen.getAllByText("Message").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Write a reply"), { target: { value: "Thanks, confirmed." } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(screen.getByText("Reply queued for the selected message.")).toBeInTheDocument();
    expect(screen.getByLabelText("Write a reply")).toHaveValue("");

    fireEvent.click(attendanceRow);

    expect(attendanceRow).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Attendance Confirmation details")).not.toBeInTheDocument();
  });

  it("marks Home feed messages and event notifications as read when opened", () => {
    renderLoggedInApp("/");

    const summerEventRow = screen.getByRole("button", { name: /System Admin.*Event Update: Summer Championship/i });
    const summerEventItem = summerEventRow.closest(".manager-home-feed-item") as HTMLElement;

    expect(summerEventItem).toHaveClass("is-unread");
    expect(within(summerEventItem).getByText("Unread")).toBeInTheDocument();

    fireEvent.click(summerEventRow);

    expect(summerEventRow).toHaveAttribute("aria-expanded", "true");
    expect(summerEventItem).toHaveClass("is-read");
    expect(summerEventItem).not.toHaveClass("is-unread");
    expect(within(summerEventItem).getByText("Read")).toBeInTheDocument();
  });

  it("filters messages and event notifications in the single Home feed panel", () => {
    renderLoggedInApp("/");

    fireEvent.click(screen.getByRole("button", { name: "Open search messages and event notifications" }));
    const feedSearch = screen.getByRole("searchbox", { name: "Search messages and event notifications" });
    fireEvent.change(feedSearch, { target: { value: "parent" } });

    const parentEvent = screen.getByRole("button", { name: /Event Team.*Upcoming Event: Parent Meeting/i });
    expect(parentEvent.closest(".manager-home-feed-item")).toHaveClass("manager-home-feed-item--event");
    expect(screen.queryByRole("button", { name: /John Doe.*Attendance Confirmation/i })).not.toBeInTheDocument();

    fireEvent.change(feedSearch, { target: { value: "zzzz" } });

    expect(screen.getByText("No messages or event notifications match your search.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close search messages and event notifications" }));

    expect(screen.queryByRole("searchbox", { name: "Search messages and event notifications" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /John Doe.*Attendance Confirmation/i })).toBeInTheDocument();
  });

  it("lets staff add, edit, upload an image, and delete merchandise", async () => {
    renderLoggedInApp("/merchandise");

    expect(screen.queryByRole("dialog", { name: "Add New Merchandise" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add New Merchandise" }));
    const addDialog = screen.getByRole("dialog", { name: "Add New Merchandise" });

    fireEvent.change(within(addDialog).getByLabelText("Product name"), { target: { value: "Red Sparring Gloves" } });
    fireEvent.change(within(addDialog).getByLabelText("Category"), { target: { value: "Gloves" } });
    fireEvent.change(within(addDialog).getByLabelText("Price"), { target: { value: "49" } });
    fireEvent.change(within(addDialog).getByLabelText("Stock"), { target: { value: "8" } });
    fireEvent.change(within(addDialog).getByLabelText("Description"), { target: { value: "Competition gloves for sparring days." } });
    fireEvent.change(within(addDialog).getByLabelText("Product image"), {
      target: { files: [new File(["glove-image"], "gloves.png", { type: "image/png" })] }
    });
    await waitFor(() => expect(within(addDialog).getByAltText("Uploaded merchandise preview")).toHaveAttribute("src", expect.stringContaining("data:image/png")));
    fireEvent.click(within(addDialog).getByRole("button", { name: "Create Merchandise" }));

    expect(screen.getByText("Red Sparring Gloves")).toBeInTheDocument();
    expect(screen.getByText("$49.00")).toBeInTheDocument();
    expect(screen.getByText("8 in stock")).toBeInTheDocument();
    expect(screen.getByAltText("Red Sparring Gloves")).toHaveAttribute("src", expect.stringContaining("data:image/png"));

    fireEvent.click(screen.getByRole("button", { name: "Edit Red Sparring Gloves" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit Red Sparring Gloves" });
    fireEvent.change(within(editDialog).getByLabelText("Stock"), { target: { value: "12" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Save Merchandise Changes" }));

    expect(screen.getByText("12 in stock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Red Sparring Gloves" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Merchandise" }));

    expect(screen.queryByText("Red Sparring Gloves")).not.toBeInTheDocument();
  });
});
