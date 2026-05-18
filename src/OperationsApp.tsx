import {
  Archive,
  Award,
  BarChart3,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Moon,
  MoreHorizontal,
  Package,
  Plus,
  ShoppingCart,
  Search,
  Send,
  Sun,
  Target,
  Trash2,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent as ReactChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import classesLauncherIcon from "./assets/manager-icons/Classes.webp";
import dashboardLauncherIcon from "./assets/manager-icons/Dashboard.webp";
import eventsLauncherIcon from "./assets/manager-icons/Events.webp";
import managerLogoutIcon from "./assets/manager-icons/ManagerLogoutProfessional.png";
import managerPageIcon from "./assets/manager-icons/ManagerPage.webp";
import managerProfileSettingsIcon from "./assets/manager-icons/ManagerProfileSettings.png";
import merchandiseLauncherIcon from "./assets/manager-icons/Merchandise.webp";
import messagesLauncherIcon from "./assets/manager-icons/Messages.webp";
import reportsLauncherIcon from "./assets/manager-icons/Reports.webp";
import schedulingLauncherIcon from "./assets/manager-icons/Scheduling.webp";
import studentsLauncherIcon from "./assets/manager-icons/Students.webp";
import { useAppState } from "./state";
import { applyAppTheme, readStoredAppTheme, writeStoredAppTheme, type AppThemeMode } from "./theme";
import type { ClassWeekday, DirectMessage, MerchandiseItem, MessageLog, ScheduledClass, StudioClass, StudentRecord, StudioEvent } from "./types";
import { formatMoney, validateEmail } from "./utils";

const beltOptions = ["White", "Yellow", "Orange", "Green", "Blue", "Purple", "Brown", "Red", "Dark Brown", "Black"];
const weekdayOptions: { value: ClassWeekday; label: string; short: string }[] = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" }
];
const defaultScheduleTypeOptions = [
  { value: "class", label: "Class" },
  { value: "private-lesson", label: "Private lesson" },
  { value: "testing-prep", label: "Testing prep" }
];

type ManagerLauncherIconKind = "dashboard" | "messages" | "students" | "classes" | "events" | "scheduling" | "merchandise" | "reports";

type ManagerLauncherItem = {
  path: string;
  label: string;
  icon: ManagerLauncherIconKind;
  future?: boolean;
};

const managerLauncherItems: ManagerLauncherItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { path: "/messages", label: "Messages", icon: "messages" },
  { path: "/students", label: "Students", icon: "students" },
  { path: "/classes", label: "Classes", icon: "classes" },
  { path: "/events", label: "Events", icon: "events" },
  { path: "/schedule", label: "Scheduling", icon: "scheduling" },
  { path: "/merchandise", label: "Merchandise", icon: "merchandise" },
  { path: "/reports", label: "Reports", icon: "reports", future: true }
];

const managerLauncherIconImages: Record<ManagerLauncherIconKind, string> = {
  dashboard: dashboardLauncherIcon,
  messages: messagesLauncherIcon,
  students: studentsLauncherIcon,
  classes: classesLauncherIcon,
  events: eventsLauncherIcon,
  scheduling: schedulingLauncherIcon,
  merchandise: merchandiseLauncherIcon,
  reports: reportsLauncherIcon
};

type ManagerProfileSettings = {
  name: string;
  username: string;
  email: string;
  phone: string;
  updates: boolean;
  theme: AppThemeMode;
  photoDataUrl?: string;
  passwordUpdatedAt?: string;
};

const managerProfileStorageKey = "chos.profile.v1";

function fallbackManagerProfile(sessionEmail?: string): ManagerProfileSettings {
  const email = sessionEmail ?? "team@chos.prototype";
  const username = email.split("@")[0]?.replace(/[^a-z0-9._-]/gi, "") || "chos-manager";
  return {
    name: "Cho's Manager",
    username,
    email,
    phone: "(262) 555-0100",
    updates: true,
    theme: readStoredAppTheme()
  };
}

function readManagerProfile(sessionEmail?: string): ManagerProfileSettings {
  const fallback = fallbackManagerProfile(sessionEmail);
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem(managerProfileStorageKey);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Partial<ManagerProfileSettings>;
    const photoDataUrl = typeof parsed.photoDataUrl === "string" && parsed.photoDataUrl.startsWith("data:image/") ? parsed.photoDataUrl : undefined;
    return {
      name: parsed.name?.trim() || fallback.name,
      username: parsed.username?.trim() || fallback.username,
      email: parsed.email?.trim() || fallback.email,
      phone: parsed.phone?.trim() || fallback.phone,
      updates: parsed.updates ?? fallback.updates,
      theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : fallback.theme,
      photoDataUrl,
      passwordUpdatedAt: parsed.passwordUpdatedAt
    };
  } catch {
    return fallback;
  }
}

function writeManagerProfile(profile: ManagerProfileSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(managerProfileStorageKey, JSON.stringify(profile));
  } catch {
    // Profile changes still update local React state when storage is blocked.
  }
}

function publicAsset(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

function fullName(student: StudentRecord) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function formatClockTime(time: string) {
  const [hours = "0", minutes = "00"] = time.split(":");
  const date = new Date(2026, 0, 1, Number(hours), Number(minutes));
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatClassTimeRange(studioClass: Pick<StudioClass, "startTime" | "endTime">) {
  return `${formatClockTime(studioClass.startTime)} - ${formatClockTime(studioClass.endTime)}`;
}

function formatClassDays(daysOfWeek: ClassWeekday[]) {
  return daysOfWeek
    .map((day) => weekdayOptions.find((option) => option.value === day)?.label)
    .filter(Boolean)
    .join(", ");
}

function scheduleTypeLabel(type: string) {
  return defaultScheduleTypeOptions.find((option) => option.value === type)?.label ?? type;
}

function messageKindLabel(kind: MessageLog["kind"]) {
  if (kind === "follow-up") return "Missed-class follow-up";
  if (kind === "marketing") return "Marketing blast";
  if (kind === "welcome") return "Welcome text";
  return "Class reminder";
}

function OperationsShell({ children }: { children: ReactNode }) {
  const { session, logout } = useAppState();
  const location = useLocation();

  return (
    <StaffOperationsShell sessionEmail={session?.email} logout={logout} path={location.pathname}>
      {children}
    </StaffOperationsShell>
  );
}

function StaffOperationsShell({
  children,
  sessionEmail,
  logout,
  path
}: {
  children: ReactNode;
  sessionEmail?: string;
  logout: () => void;
  path: string;
}) {
  if (path === "/" || path === "/manager") {
    return <div className="manager-shell">{children}</div>;
  }

  return (
    <div className="manager-shell">
      <section className="manager-full-page-shell" aria-label="Manager workspace">
        <header className="manager-full-topbar" aria-label="Manager page controls">
          <Link className="manager-back-link" to="/manager" aria-label="Back to Manager Page">
            <ChevronLeft size={24} />
            <span>Back to Manager Page</span>
          </Link>
          <Link className="manager-full-logo" to="/" aria-label="Cho's Martial Arts manager home">
            <img src={publicAsset("682e95109aa21_chos-logo.png")} alt="Cho's Martial Arts" />
          </Link>
          <button className="manager-logout-button" type="button" aria-label="Log Out" onClick={logout}>
            <img className="manager-logout-icon" src={managerLogoutIcon} alt="" draggable="false" />
          </button>
        </header>
        <main className="manager-main manager-subpage-main">
          <span className="manager-session-email">{sessionEmail ?? "team@chos.prototype"}</span>
          {children}
        </main>
      </section>
    </div>
  );
}

function OperationsPage({ title, text, action, children, className }: { title: string; text: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`operations-page${className ? ` ${className}` : ""}`}>
      <div className="operations-page-head">
        <div className="operations-page-title-copy">
          <ManagerPageTitleFrame title={title} className="operations-page-title-frame" />
          <p>{text}</p>
        </div>
        {action && <div className="operations-page-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <article className="operation-stat-card">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

type ManagerCalendarEntry = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: "class" | "event";
  meta: string;
  path: string;
  titleColor?: string;
};

type ManagerCalendarView = "day" | "week" | "month";

const managerCalendarViewOptions: { value: ManagerCalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" }
];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseCalendarDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function weekDaysForDate(date: Date) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });
}

function shiftCalendarMonth(date: Date, direction: number) {
  const dayOfMonth = date.getDate();
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + direction);
  const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return next;
}

function shiftCalendarPeriod(date: Date, view: ManagerCalendarView, direction: number) {
  if (view === "month") return shiftCalendarMonth(date, direction);
  const next = new Date(date);
  next.setDate(date.getDate() + direction * (view === "week" ? 7 : 1));
  return next;
}

function formatWeekRange(weekDays: Date[]) {
  const [firstDay] = weekDays;
  const lastDay = weekDays[weekDays.length - 1];
  const sameMonth = firstDay.getMonth() === lastDay.getMonth() && firstDay.getFullYear() === lastDay.getFullYear();
  const sameYear = firstDay.getFullYear() === lastDay.getFullYear();
  if (sameMonth) {
    return `${firstDay.toLocaleDateString("en-US", { month: "long" })} ${firstDay.getDate()} - ${lastDay.getDate()}, ${lastDay.getFullYear()}`;
  }
  if (sameYear) {
    return `${firstDay.toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${lastDay.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${lastDay.getFullYear()}`;
  }
  return `${firstDay.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} - ${lastDay.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
}

function compareCalendarEntries(a: ManagerCalendarEntry, b: ManagerCalendarEntry) {
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
}

function scheduledClassCalendarEntries(item: ScheduledClass, calendarDays: Date[]): ManagerCalendarEntry[] {
  const label = scheduleTypeLabel(item.type);
  const createEntry = (date: string, id = item.id, meta = label): ManagerCalendarEntry => ({
    id,
    title: item.title,
    date,
    time: item.time,
    kind: "class",
    meta,
    path: "/schedule",
    titleColor: item.titleColor
  });

  if (!item.recurring) {
    return [createEntry(item.date)];
  }

  const startDate = parseCalendarDate(item.date);
  const startDateKey = toDateKey(startDate);
  const startWeekday = startDate.getDay();
  return calendarDays
    .filter((day) => day.getDay() === startWeekday && toDateKey(day) >= startDateKey)
    .map((day) => {
      const dateKey = toDateKey(day);
      return createEntry(dateKey, `${item.id}-${dateKey}`, `${label} · recurring`);
    });
}

function useLiveCalendarDate() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

function ManagerLiveCalendar({ scheduledClasses, studioClasses, studioEvents }: { scheduledClasses: ScheduledClass[]; studioClasses: StudioClass[]; studioEvents: StudioEvent[] }) {
  const now = useLiveCalendarDate();
  const todayKey = toDateKey(now);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [calendarView, setCalendarView] = useState<ManagerCalendarView>("month");
  const [visibleMonthDate, setVisibleMonthDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const currentYear = visibleMonthDate.getFullYear();
  const currentMonth = visibleMonthDate.getMonth();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const calendarDays = useMemo(() => {
    const gridStart = new Date(currentYear, currentMonth, 1 - monthStart.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [currentMonth, currentYear, monthStart]);
  const entries = useMemo<ManagerCalendarEntry[]>(
    () => [
      ...studioClasses.flatMap((studioClass) =>
        studioClass.recurring === false
          ? []
          : calendarDays
              .filter((day) => studioClass.daysOfWeek.includes(day.getDay() as ClassWeekday))
              .map((day) => ({
                id: `${studioClass.id}-${toDateKey(day)}`,
                title: studioClass.name,
                date: toDateKey(day),
                time: formatClassTimeRange(studioClass),
                kind: "class" as const,
                meta: "recurring class",
                path: "/classes",
                titleColor: studioClass.titleColor
              }))
      ),
      ...scheduledClasses.flatMap((item) => scheduledClassCalendarEntries(item, calendarDays)),
      ...studioEvents.map((event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        kind: "event" as const,
        meta: event.audience,
        path: "/events"
      }))
    ].sort(compareCalendarEntries),
    [calendarDays, scheduledClasses, studioClasses, studioEvents]
  );
  const entriesByDate = useMemo(
    () => entries.reduce<Record<string, ManagerCalendarEntry[]>>((groups, entry) => {
      groups[entry.date] = [...(groups[entry.date] ?? []), entry];
      return groups;
    }, {}),
    [entries]
  );
  const selectedEntries = entriesByDate[selectedDateKey] ?? [];
  const selectedDate = parseCalendarDate(selectedDateKey);
  const selectedWeekDays = useMemo(() => weekDaysForDate(selectedDate), [selectedDateKey]);
  const visibleCalendarDays = calendarView === "month" ? calendarDays : calendarView === "week" ? selectedWeekDays : [selectedDate];
  const visibleWeekdayLabels = calendarView === "day" ? [selectedDate.toLocaleDateString("en-US", { weekday: "short" })] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const calendarViewLabel =
    calendarView === "month"
      ? monthLabel
      : calendarView === "week"
        ? `Week of ${selectedWeekDays[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
        : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const periodLabel =
    calendarView === "month"
      ? monthLabel
      : calendarView === "week"
        ? formatWeekRange(selectedWeekDays)
        : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const selectCalendarDate = (date: Date) => {
    setSelectedDateKey(toDateKey(date));
    setVisibleMonthDate(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const shiftVisiblePeriod = (direction: number) => {
    selectCalendarDate(shiftCalendarPeriod(selectedDate, calendarView, direction));
  };

  useEffect(() => {
    const todayDate = parseCalendarDate(todayKey);
    setSelectedDateKey(todayKey);
    setVisibleMonthDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  }, [todayKey]);

  return (
    <section className="manager-calendar-panel" aria-label="Live studio calendar">
      <header className="manager-calendar-head">
        <div>
          <CalendarDays size={34} />
          <div>
            <h2>{monthLabel}</h2>
            <p>Live studio calendar · updates from today&apos;s date</p>
          </div>
        </div>
        <div className="manager-calendar-view-switch" role="group" aria-label="Calendar view">
          {managerCalendarViewOptions.map((option) => (
            <button
              aria-pressed={calendarView === option.value}
              key={option.value}
              onClick={() => setCalendarView(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <Link to="/schedule">Manage Schedule</Link>
      </header>
      <div className="manager-calendar-body">
        <div className="manager-calendar-period-nav" role="group" aria-label="Calendar period navigation">
          <button aria-label={`Previous ${calendarView}`} onClick={() => shiftVisiblePeriod(-1)} type="button">
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <strong>{periodLabel}</strong>
          <button aria-label={`Next ${calendarView}`} onClick={() => shiftVisiblePeriod(1)} type="button">
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
        <div className={`manager-calendar-grid manager-calendar-grid--${calendarView}`} role="grid" aria-label={`${calendarViewLabel} Cho's studio calendar`}>
          {visibleWeekdayLabels.map((dayName) => (
            <span className="manager-calendar-weekday" key={dayName}>{dayName}</span>
          ))}
          {visibleCalendarDays.map((day) => {
            const dateKey = toDateKey(day);
            const dayEntries = entriesByDate[dateKey] ?? [];
            const isToday = dateKey === todayKey;
            const isOutsideMonth = day.getMonth() !== currentMonth;
            const isSelected = dateKey === selectedDateKey;
            return (
              <button
                type="button"
                className={`manager-calendar-day${isToday ? " is-today is-glowing-today is-transparent-today" : ""}${isOutsideMonth ? " is-muted" : ""}${isSelected ? " is-selected is-pulsing-selected" : ""}${dayEntries.length ? " has-items" : ""}`}
                key={dateKey}
                onClick={() => selectCalendarDate(day)}
                aria-pressed={isSelected}
                aria-label={`Select ${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}${dayEntries.length ? `, ${dayEntries.length} calendar item${dayEntries.length === 1 ? "" : "s"}` : ", no calendar items"}`}
              >
                <span>{day.getDate()}</span>
                <div>
                  {dayEntries.slice(0, 3).map((entry) => (
                    <span className={`manager-calendar-entry ${entry.kind}`} key={entry.id} style={entry.titleColor ? { color: entry.titleColor } : undefined}>
                      {entry.title}
                    </span>
                  ))}
                  {dayEntries.length > 3 && <small>+{dayEntries.length - 3} more</small>}
                </div>
              </button>
            );
          })}
        </div>
        <section className="manager-calendar-selected-panel" aria-label="Selected date events" aria-live="polite">
          <header>
            <div>
              <h3>{selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h3>
              <p>{selectedDateKey === todayKey ? "Today" : "Selected date"}</p>
            </div>
            <span>{selectedEntries.length} item{selectedEntries.length === 1 ? "" : "s"}</span>
          </header>
          {selectedEntries.length ? (
            <div>
              {selectedEntries.map((entry) => (
                <Link className="manager-calendar-selected-item" key={entry.id} to={entry.path}>
                  <span>{entry.kind}</span>
                  <div>
                    <strong style={entry.titleColor ? { color: entry.titleColor } : undefined}>{entry.title}</strong>
                    <small>{entry.time} · {entry.meta}</small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p>No classes or events scheduled for this date.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function ManagerLauncherIcon({ icon }: { icon: ManagerLauncherIconKind }) {
  const frameClassName = `manager-launcher-graphic manager-launcher-graphic--${icon}`;
  const imageClassName = `manager-launcher-image manager-launcher-image--${icon}${icon === "students" ? " manager-students-emblem" : ""}`;
  const launcherIconImage = managerLauncherIconImages[icon];

  return (
    <span className={frameClassName} aria-hidden="true">
      <img
        className={imageClassName}
        src={launcherIconImage}
        alt=""
        draggable="false"
      />
    </span>
  );
}

function managerLauncherPath(item: ManagerLauncherItem) {
  return `/manager?tool=${item.icon}`;
}

function getSelectedManagerLauncherItem(search: string) {
  const requestedTool = new URLSearchParams(search).get("tool");
  return managerLauncherItems.find((item) => item.icon === requestedTool) ?? managerLauncherItems[0];
}

function ManagerLauncherWorkspace({ tool }: { tool: ManagerLauncherIconKind }) {
  switch (tool) {
    case "dashboard":
      return <DashboardPage />;
    case "messages":
      return <MessagesPage />;
    case "students":
      return <StudentsPage />;
    case "classes":
      return <ClassesPage />;
    case "events":
      return <EventsPage />;
    case "scheduling":
      return <SchedulePage />;
    case "merchandise":
      return <MerchandisePage />;
    case "reports":
      return <ReportsPage />;
    default:
      return <DashboardPage />;
  }
}

type ManagerHomeThread = {
  id: string;
  kind: "message" | "event";
  sender: string;
  title: string;
  preview: string;
  sentDate: string;
  sentTime: string;
  sentDateTime: string;
  avatar: string;
  accent: string;
  unread?: boolean;
};

type ManagerHomeFeedFilter = "all" | ManagerHomeThread["kind"];

type ManagerHomeAgendaItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: "scheduled" | "class" | "event";
  meta: string;
  priority: number;
};

const managerHomeThreads: ManagerHomeThread[] = [
  {
    id: "summer-championship",
    kind: "event",
    sender: "System Admin",
    title: "Event Update: Summer Championship",
    preview: "The schedule for the Summer Championship...",
    sentDate: "May 15, 2026",
    sentTime: "10:30 AM",
    sentDateTime: "2026-05-15T10:30:00-05:00",
    avatar: studentsLauncherIcon,
    accent: "#67d8ff",
    unread: true
  },
  {
    id: "practice-reminder",
    kind: "message",
    sender: "Head Coach",
    title: "Practice Session Reminder",
    preview: "Don't forget about tomorrow's training...",
    sentDate: "May 15, 2026",
    sentTime: "9:15 AM",
    sentDateTime: "2026-05-15T09:15:00-05:00",
    avatar: classesLauncherIcon,
    accent: "#7be4ff",
    unread: true
  },
  {
    id: "attendance",
    kind: "message",
    sender: "John Doe",
    title: "Attendance Confirmation",
    preview: "Please confirm your attendance for the...",
    sentDate: "May 15, 2026",
    sentTime: "8:45 AM",
    sentDateTime: "2026-05-15T08:45:00-05:00",
    avatar: studentsLauncherIcon,
    accent: "#8a78ff"
  },
  {
    id: "merch",
    kind: "message",
    sender: "Merch Store",
    title: "New Arrivals Just Dropped!",
    preview: "Check out the latest merchandise available...",
    sentDate: "May 14, 2026",
    sentTime: "4:20 PM",
    sentDateTime: "2026-05-14T16:20:00-05:00",
    avatar: merchandiseLauncherIcon,
    accent: "#7bdcff"
  },
  {
    id: "security",
    kind: "message",
    sender: "System Admin",
    title: "Account Security Update",
    preview: "We've updated our security policy to...",
    sentDate: "May 14, 2026",
    sentTime: "11:05 AM",
    sentDateTime: "2026-05-14T11:05:00-05:00",
    avatar: studentsLauncherIcon,
    accent: "#67d8ff"
  },
  {
    id: "event-team",
    kind: "event",
    sender: "Event Team",
    title: "Upcoming Event: Parent Meeting",
    preview: "We will be hosting a parent meeting next...",
    sentDate: "May 13, 2026",
    sentTime: "2:45 PM",
    sentDateTime: "2026-05-13T14:45:00-05:00",
    avatar: schedulingLauncherIcon,
    accent: "#8d70ff"
  }
];

const HOME_OVERVIEW_DRAG_THRESHOLD = 6;
const HOME_OVERVIEW_KEYBOARD_STEP = 0.12;
const HOME_OVERVIEW_STAGE_VISUAL_BUFFER = 6;

function clampHomeOverviewProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

function formatMonthYear(value?: string) {
  if (!value) return "May 2026";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "May 2026";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatHomeScheduleDay(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function scheduleItemOccursOnDate(item: ScheduledClass, day: Date) {
  const dateKey = toDateKey(day);
  if (!item.recurring) return item.date === dateKey;
  const startDate = parseCalendarDate(item.date);
  return toDateKey(startDate) <= dateKey && startDate.getDay() === day.getDay();
}

function hasRecurringStudioClass(day: Date, studioClasses: StudioClass[]) {
  return studioClasses.some((studioClass) => studioClass.recurring !== false && studioClass.daysOfWeek.includes(day.getDay() as ClassWeekday));
}

function hasExplicitHomeAgendaItem(day: Date, scheduledClasses: ScheduledClass[], studioEvents: StudioEvent[]) {
  const dateKey = toDateKey(day);
  return scheduledClasses.some((item) => scheduleItemOccursOnDate(item, day)) || studioEvents.some((event) => event.date === dateKey);
}

function findBestHomeAgendaDateInWeek(weekDays: Date[], scheduledClasses: ScheduledClass[], studioClasses: StudioClass[], studioEvents: StudioEvent[]) {
  const explicitDay = weekDays.find((day) => hasExplicitHomeAgendaItem(day, scheduledClasses, studioEvents));
  if (explicitDay) return toDateKey(explicitDay);
  const recurringDay = weekDays.find((day) => hasRecurringStudioClass(day, studioClasses));
  return toDateKey(recurringDay ?? weekDays[0]);
}

function findInitialHomeAgendaDate(today: Date, scheduledClasses: ScheduledClass[], studioClasses: StudioClass[], studioEvents: StudioEvent[]) {
  for (let offset = 0; offset < 70; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    if (hasExplicitHomeAgendaItem(day, scheduledClasses, studioEvents)) return toDateKey(day);
  }

  for (let offset = 0; offset < 70; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    if (hasRecurringStudioClass(day, studioClasses)) return toDateKey(day);
  }

  return toDateKey(today);
}

function agendaSortMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 9999;
  const hour = Number(match[1]);
  const minutes = Number(match[2]);
  const meridian = match[3]?.toUpperCase();
  const normalizedHour = meridian === "PM" && hour < 12 ? hour + 12 : meridian === "AM" && hour === 12 ? 0 : hour;
  return normalizedHour * 60 + minutes;
}

function compareHomeAgendaItems(a: ManagerHomeAgendaItem, b: ManagerHomeAgendaItem) {
  return a.date.localeCompare(b.date) || a.priority - b.priority || agendaSortMinutes(a.time) - agendaSortMinutes(b.time);
}

function buildHomeAgendaItems(weekDays: Date[], scheduledClasses: ScheduledClass[], studioClasses: StudioClass[], studioEvents: StudioEvent[]) {
  return weekDays
    .flatMap<ManagerHomeAgendaItem>((day) => {
      const dateKey = toDateKey(day);
      const scheduledItems = scheduledClasses
        .filter((item) => scheduleItemOccursOnDate(item, day))
        .map((item) => ({
          id: `scheduled-${item.id}-${dateKey}`,
          title: item.title,
          date: dateKey,
          time: item.time,
          kind: "scheduled" as const,
          meta: scheduleTypeLabel(item.type),
          priority: 1
        }));
      const eventItems = studioEvents
        .filter((event) => event.date === dateKey)
        .map((event) => ({
          id: `event-${event.id}-${dateKey}`,
          title: event.title,
          date: dateKey,
          time: event.time,
          kind: "event" as const,
          meta: event.audience,
          priority: 2
        }));
      const recurringClassItems = studioClasses
        .filter((studioClass) => studioClass.recurring !== false && studioClass.daysOfWeek.includes(day.getDay() as ClassWeekday))
        .map((studioClass) => ({
          id: `class-${studioClass.id}-${dateKey}`,
          title: studioClass.name,
          date: dateKey,
          time: formatClockTime(studioClass.startTime),
          kind: "class" as const,
          meta: "Recurring class",
          priority: 3
        }));

      return [...scheduledItems, ...eventItems, ...recurringClassItems];
    })
    .sort(compareHomeAgendaItems);
}

function ProfileTitleRule({ variant }: { variant: "top" | "bottom" }) {
  return (
    <svg className={`manager-home-title-rule-art manager-home-title-rule-art--${variant}`} viewBox="0 0 360 54" aria-hidden="true" focusable="false">
      <path className="manager-home-title-rule-main" d="M2 27 H154" />
      <path className="manager-home-title-rule-main" d="M206 27 H358" />
      <path className="manager-home-title-rule-flourish" d="M154 27 C164 27 170 21 176 21 C179 21 180 25 180 27 C180 25 181 21 184 21 C190 21 196 27 206 27" />
      <path className="manager-home-title-rule-flourish" d="M164 30 C171 34 176 33 180 27 C184 33 189 34 196 30" />
      <path className="manager-home-title-rule-accent" d="M180 16 L188 27 L180 38 L172 27 Z" />
      <circle className="manager-home-title-rule-dot" cx="145" cy="27" r="1.45" />
      <circle className="manager-home-title-rule-dot" cx="215" cy="27" r="1.45" />
      <circle className="manager-home-title-rule-dot" cx="180" cy="27" r="1.2" />
    </svg>
  );
}

function ManagerPageTitleFrame({ title, className = "" }: { title: string; className?: string }) {
  const classNames = ["manager-page-title-frame", className].filter(Boolean).join(" ");

  return (
    <div className={classNames}>
      <span className="manager-home-title-rule manager-home-title-rule--top" aria-hidden="true">
        <ProfileTitleRule variant="top" />
      </span>
      <h1>{title}</h1>
      <span className="manager-home-title-rule manager-home-title-rule--bottom" aria-hidden="true">
        <ProfileTitleRule variant="bottom" />
      </span>
    </div>
  );
}

function ManagerHomePage() {
  const { logout, scheduledClasses, session, showToast, studioClasses, studioEvents, students } = useAppState();
  const today = useLiveCalendarDate();
  const [managerProfile, setManagerProfile] = useState(() => readManagerProfile(session?.email));
  const activeStudentCount = students.filter((student) => (student.status ?? "Active").toLowerCase() === "active").length;
  const memberSinceLabel = formatMonthYear(session?.createdAt);
  const defaultHomeScheduleDateKey = useMemo(
    () => findInitialHomeAgendaDate(today, scheduledClasses, studioClasses, studioEvents),
    [today, scheduledClasses, studioClasses, studioEvents]
  );
  const [homeScheduleWeekStartKey, setHomeScheduleWeekStartKey] = useState(() => toDateKey(weekDaysForDate(parseCalendarDate(defaultHomeScheduleDateKey))[0]));
  const [selectedHomeScheduleDateKey, setSelectedHomeScheduleDateKey] = useState(defaultHomeScheduleDateKey);
  const [feedThreads, setFeedThreads] = useState(() => managerHomeThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedFeedThreadIds, setSelectedFeedThreadIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isFeedSearchOpen, setIsFeedSearchOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<ManagerHomeFeedFilter>("all");
  const [replyText, setReplyText] = useState("");
  const [overviewProgress, setOverviewProgress] = useState(1);
  const [overviewHeight, setOverviewHeight] = useState(0);
  const [isOverviewDragging, setIsOverviewDragging] = useState(false);
  const feedSearchInputRef = useRef<HTMLInputElement>(null);
  const overviewContentRef = useRef<HTMLElement>(null);
  const overviewHandleRef = useRef<HTMLButtonElement>(null);
  const overviewDragRef = useRef({
    hasMoved: false,
    ignoreClick: false,
    pointerId: null as number | null,
    startProgress: 1,
    startY: 0
  });
  const messageCount = feedThreads.filter((thread) => thread.kind === "message").length;
  const eventCount = feedThreads.filter((thread) => thread.kind === "event").length;
  const selectedFeedCount = selectedFeedThreadIds.size;
  const visibleThreads = feedThreads.filter((thread) => {
    if (feedFilter !== "all" && thread.kind !== feedFilter) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${thread.kind} ${thread.sender} ${thread.title} ${thread.preview}`.toLowerCase().includes(query);
  });
  const visibleFeedSections = visibleThreads.reduce<{ date: string; threads: ManagerHomeThread[] }[]>((sections, thread) => {
    const currentSection = sections[sections.length - 1];
    if (currentSection?.date === thread.sentDate) {
      currentSection.threads.push(thread);
      return sections;
    }
    sections.push({ date: thread.sentDate, threads: [thread] });
    return sections;
  }, []);
  const homeScheduleWeekDays = useMemo(() => weekDaysForDate(parseCalendarDate(homeScheduleWeekStartKey)), [homeScheduleWeekStartKey]);
  const homeAgendaItems = useMemo(
    () => buildHomeAgendaItems(homeScheduleWeekDays, scheduledClasses, studioClasses, studioEvents),
    [homeScheduleWeekDays, scheduledClasses, studioClasses, studioEvents]
  );
  const homeAgendaItemsByDate = useMemo(
    () => homeAgendaItems.reduce<Record<string, ManagerHomeAgendaItem[]>>((groups, item) => {
      groups[item.date] = [...(groups[item.date] ?? []), item];
      return groups;
    }, {}),
    [homeAgendaItems]
  );
  const selectedHomeScheduleDate = parseCalendarDate(selectedHomeScheduleDateKey);
  const selectedHomeAgendaItems = homeAgendaItemsByDate[selectedHomeScheduleDateKey] ?? [];
  const isOverviewCollapsed = overviewProgress <= 0.01;
  const overviewStageState = isOverviewCollapsed ? "collapsed" : overviewProgress >= 0.99 ? "expanded" : "partial";
  const overviewStageStyle = {
    "--manager-home-overview-height": overviewHeight > 0 ? `${Math.round(overviewHeight * overviewProgress)}px` : "auto",
    "--manager-home-overview-progress": overviewProgress.toFixed(3)
  } as CSSProperties;

  useEffect(() => {
    const defaultWeekStart = weekDaysForDate(parseCalendarDate(defaultHomeScheduleDateKey))[0];
    setHomeScheduleWeekStartKey(toDateKey(defaultWeekStart));
    setSelectedHomeScheduleDateKey(defaultHomeScheduleDateKey);
  }, [defaultHomeScheduleDateKey]);

  useEffect(() => {
    const node = overviewContentRef.current;
    if (!node) return;

    const updateOverviewHeight = (entry?: ResizeObserverEntry) => {
      const borderBoxHeight = entry?.borderBoxSize?.[0]?.blockSize ?? 0;
      const measuredHeight =
        node.getBoundingClientRect().height ||
        borderBoxHeight ||
        node.offsetHeight ||
        node.scrollHeight ||
        entry?.contentRect.height ||
        0;
      setOverviewHeight(Math.ceil(measuredHeight + HOME_OVERVIEW_STAGE_VISUAL_BUFFER));
    };

    updateOverviewHeight();

    if (typeof ResizeObserver === "undefined") {
      const updateOverviewHeightFromWindow = () => updateOverviewHeight();
      window.addEventListener("resize", updateOverviewHeightFromWindow);
      return () => window.removeEventListener("resize", updateOverviewHeightFromWindow);
    }

    const observer = new ResizeObserver((entries) => updateOverviewHeight(entries[0]));

    observer.observe(node, { box: "border-box" });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setManagerProfile(readManagerProfile(session?.email));
  }, [session?.email]);

  useEffect(() => {
    if (isFeedSearchOpen) feedSearchInputRef.current?.focus();
  }, [isFeedSearchOpen]);

  useEffect(() => {
    if (!isOverviewCollapsed) return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && overviewContentRef.current?.contains(activeElement)) {
      overviewHandleRef.current?.focus();
    }
  }, [isOverviewCollapsed]);

  const updateOverviewProgress = (nextProgress: number) => {
    setOverviewProgress(clampHomeOverviewProgress(nextProgress));
  };

  const toggleHomeOverview = () => {
    updateOverviewProgress(overviewProgress > 0.5 ? 0 : 1);
  };

  const handleOverviewHandleClick = () => {
    if (overviewDragRef.current.ignoreClick) {
      overviewDragRef.current.ignoreClick = false;
      return;
    }

    toggleHomeOverview();
  };

  const handleOverviewHandleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateOverviewProgress(overviewProgress - HOME_OVERVIEW_KEYBOARD_STEP);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateOverviewProgress(overviewProgress + HOME_OVERVIEW_KEYBOARD_STEP);
    }
  };

  const handleOverviewHandlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    overviewDragRef.current.hasMoved = false;
    overviewDragRef.current.ignoreClick = false;
    overviewDragRef.current.pointerId = event.pointerId;
    overviewDragRef.current.startProgress = overviewProgress;
    overviewDragRef.current.startY = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleOverviewHandlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = overviewDragRef.current;
    if (dragState.pointerId !== event.pointerId || overviewHeight <= 0) return;

    const deltaY = event.clientY - dragState.startY;
    if (Math.abs(deltaY) >= HOME_OVERVIEW_DRAG_THRESHOLD) {
      dragState.hasMoved = true;
    }

    if (!dragState.hasMoved) return;

    setIsOverviewDragging(true);
    updateOverviewProgress(dragState.startProgress + deltaY / overviewHeight);
  };

  const finishOverviewHandlePointer = (event: ReactPointerEvent<HTMLButtonElement>, shouldToggleOnTap: boolean) => {
    const dragState = overviewDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragState.pointerId = null;
    dragState.ignoreClick = true;
    setIsOverviewDragging(false);

    if (shouldToggleOnTap && !dragState.hasMoved) {
      toggleHomeOverview();
    }
  };

  const changeManagerProfilePhoto = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file for the manager profile picture.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        showToast("Could not read that profile image.");
        return;
      }

      setManagerProfile((currentProfile) => {
        const nextProfile = { ...currentProfile, photoDataUrl: result };
        writeManagerProfile(nextProfile);
        return nextProfile;
      });
      showToast("Manager profile picture updated.");
    };
    reader.onerror = () => showToast("Could not read that profile image.");
    reader.readAsDataURL(file);
  };

  const shiftHomeScheduleWeek = (direction: number) => {
    const nextWeekStart = parseCalendarDate(homeScheduleWeekStartKey);
    nextWeekStart.setDate(nextWeekStart.getDate() + direction * 7);
    const nextWeekDays = weekDaysForDate(nextWeekStart);
    setHomeScheduleWeekStartKey(toDateKey(nextWeekDays[0]));
    setSelectedHomeScheduleDateKey(findBestHomeAgendaDateInWeek(nextWeekDays, scheduledClasses, studioClasses, studioEvents));
  };

  const toggleFeedThreadSelection = (threadId: string) => {
    setSelectedFeedThreadIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(threadId)) {
        nextIds.delete(threadId);
      } else {
        nextIds.add(threadId);
      }
      return nextIds;
    });
  };

  const changeFeedFilter = (nextFilter: ManagerHomeThread["kind"]) => {
    const resolvedFilter: ManagerHomeFeedFilter = feedFilter === nextFilter ? "all" : nextFilter;
    setFeedFilter(resolvedFilter);
    setSelectedFeedThreadIds(new Set<string>());
    setSelectedThreadId((currentThreadId) => {
      if (!currentThreadId || resolvedFilter === "all") return currentThreadId;
      const currentThread = feedThreads.find((thread) => thread.id === currentThreadId);
      return currentThread?.kind === resolvedFilter ? currentThreadId : null;
    });
  };

  const openFeedThread = (threadId: string) => {
    setSelectedThreadId((currentThreadId) => currentThreadId === threadId ? null : threadId);
    setFeedThreads((currentThreads) =>
      currentThreads.map((thread) => thread.id === threadId && thread.unread ? { ...thread, unread: false } : thread)
    );
  };

  const deleteSelectedFeedThreads = () => {
    if (!selectedFeedCount) return;
    const idsToDelete = selectedFeedThreadIds;
    setFeedThreads((currentThreads) => currentThreads.filter((thread) => !idsToDelete.has(thread.id)));
    setSelectedThreadId((currentThreadId) => currentThreadId && idsToDelete.has(currentThreadId) ? null : currentThreadId);
    setSelectedFeedThreadIds(new Set());
    showToast(`${selectedFeedCount} ${selectedFeedCount === 1 ? "item" : "items"} deleted from the Home Page feed.`);
  };

  const closeFeedSearch = () => {
    setSearchQuery("");
    setIsFeedSearchOpen(false);
  };

  const handleFeedSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      closeFeedSearch();
    }
  };

  const toggleManagerHomeTheme = () => {
    const nextTheme: AppThemeMode = managerProfile.theme === "dark" ? "light" : "dark";
    setManagerProfile((currentProfile) => {
      const nextProfile = { ...currentProfile, theme: nextTheme };
      writeManagerProfile(nextProfile);
      return nextProfile;
    });
    writeStoredAppTheme(nextTheme);
  };

  const sendReply = () => {
    if (!replyText.trim()) {
      showToast("Write a reply before sending.");
      return;
    }
    showToast("Reply queued for the selected message.");
    setReplyText("");
  };

  return (
    <section className="manager-home-page" aria-label="Manager home page">
      <header className="manager-home-profile-title manager-page-title-bar" aria-label="Profile page header">
        <ManagerPageTitleFrame title="Profile" className="manager-home-profile-title-frame" />
        <nav className="manager-home-top-actions" aria-label="Profile quick actions">
          <Link className="manager-home-top-action manager-home-panel-link" to="/manager" aria-label="Manager's Panel">
            <img className="manager-home-panel-icon" src={managerPageIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">Manager&apos;s Panel</span>
          </Link>
          <button className="manager-home-top-action manager-home-logout-button" type="button" aria-label="Log Out" onClick={logout}>
            <img className="manager-home-logout-icon" src={managerLogoutIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">Log Out</span>
          </button>
        </nav>
      </header>
      <main className="manager-home-shell">
        <div
          aria-hidden={isOverviewCollapsed}
          className={`manager-home-overview-stage${isOverviewCollapsed ? " is-collapsed" : ""}${isOverviewDragging ? " is-dragging" : ""}`}
          data-overview-progress={overviewProgress.toFixed(2)}
          data-overview-state={overviewStageState}
          style={overviewStageStyle}
        >
          <section className="manager-home-overview" aria-label="Manager home overview" ref={overviewContentRef}>
            <article className="manager-home-profile-card" aria-label="Manager profile overview">
            <Link className="manager-home-profile-settings-link" to="/manager?profile=settings" aria-label="Profile Settings">
              <img className="manager-home-profile-settings-icon" src={managerProfileSettingsIcon} alt="" draggable="false" />
            </Link>
            <button
              aria-checked={managerProfile.theme === "dark"}
              aria-label={managerProfile.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className={`manager-home-profile-theme-toggle manager-home-profile-theme-toggle--${managerProfile.theme}`}
              onClick={toggleManagerHomeTheme}
              role="switch"
              type="button"
            >
              <span className="manager-home-profile-theme-icons" aria-hidden="true">
                <Sun size={15} />
                <Moon size={15} />
              </span>
              <span className="manager-home-profile-theme-thumb" aria-hidden="true">
                {managerProfile.theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
              </span>
            </button>
            <label className="manager-home-profile-frame manager-home-profile-upload">
                <span className="sr-only">Upload manager profile picture</span>
                <input type="file" accept="image/*" aria-label="Upload manager profile picture" onChange={changeManagerProfilePhoto} />
                <img src={managerProfile.photoDataUrl ?? publicAsset("assets/CheetahProfilePic/Cheetah.png")} alt={`${managerProfile.name} profile portrait`} draggable="false" />
                <span className="manager-home-profile-change-badge" aria-hidden="true">
                  <Camera size={15} />
                </span>
              </label>
              <div className="manager-home-profile-copy">
                <h2>{managerProfile.name}</h2>
                <p>Head Coach &amp; Manager</p>
              </div>
              <dl className="manager-home-profile-facts">
                <div>
                  <dt><Award size={20} /></dt>
                  <dd>Team: Summer Champions</dd>
                </div>
                <div>
                  <dt><Target size={20} /></dt>
                  <dd>Member Since: {memberSinceLabel}</dd>
                </div>
                <div>
                  <dt><Users size={20} /></dt>
                  <dd>Team Size: {activeStudentCount} Member{activeStudentCount === 1 ? "" : "s"}</dd>
                </div>
              </dl>
            </article>
            <section className="manager-home-week-card" aria-label="Weekly manager schedule">
              <header className="manager-home-week-nav">
                <button type="button" aria-label="Previous week" onClick={() => shiftHomeScheduleWeek(-1)}>
                  <ChevronLeft size={20} />
                </button>
                <h2>{formatWeekRange(homeScheduleWeekDays)}</h2>
                <button type="button" aria-label="Next week" onClick={() => shiftHomeScheduleWeek(1)}>
                  <ChevronRight size={20} />
                </button>
              </header>
              <div className="manager-home-week-days" aria-label="Week days">
                {homeScheduleWeekDays.map((day) => {
                  const dateKey = toDateKey(day);
                  const isSelected = dateKey === selectedHomeScheduleDateKey;
                  return (
                    <button
                      aria-label={`Select ${formatHomeScheduleDay(day)}`}
                      aria-pressed={isSelected}
                      className={isSelected ? "is-selected" : undefined}
                      key={dateKey}
                      onClick={() => setSelectedHomeScheduleDateKey(dateKey)}
                      type="button"
                    >
                      <span>{day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
                      <strong>{day.getDate()}</strong>
                    </button>
                  );
                })}
              </div>
              <section className="manager-home-agenda-card" aria-live="polite" aria-label="Selected day agenda">
                <h3>{formatHomeScheduleDay(selectedHomeScheduleDate)}</h3>
                <div className="manager-home-agenda-list">
                  {selectedHomeAgendaItems.length ? (
                    selectedHomeAgendaItems.slice(0, 5).map((item) => (
                      <article className={`manager-home-agenda-item manager-home-agenda-item--${item.kind}`} key={item.id}>
                        <time>{item.time}</time>
                        <span aria-hidden="true">
                          {item.kind === "event" ? <CalendarDays size={20} /> : item.kind === "class" ? <Users size={20} /> : <MessagesSquare size={20} />}
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.meta}</small>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>No classes or events scheduled for this date.</p>
                  )}
                </div>
              </section>
            </section>
          </section>
        </div>
        <button
          aria-expanded={!isOverviewCollapsed}
          aria-label={isOverviewCollapsed ? "Expand manager overview" : "Collapse manager overview"}
          className={`manager-home-overview-handle${isOverviewCollapsed ? " is-collapsed" : ""}${isOverviewDragging ? " is-dragging" : ""}`}
          onClick={handleOverviewHandleClick}
          onKeyDown={handleOverviewHandleKeyDown}
          onPointerCancel={(event) => finishOverviewHandlePointer(event, false)}
          onPointerDown={handleOverviewHandlePointerDown}
          onPointerMove={handleOverviewHandlePointerMove}
          onPointerUp={(event) => finishOverviewHandlePointer(event, true)}
          ref={overviewHandleRef}
          type="button"
        >
          <span className="manager-home-overview-handle-bar" aria-hidden="true" />
        </button>
        <section className="manager-home-feed-panel" aria-label="Messages and event notifications">
          <div className="manager-home-feed-head">
            <div className="manager-home-feed-counts" aria-label="Feed totals">
              <button
                className={`manager-home-count manager-home-count--message${feedFilter === "message" ? " is-active" : ""}`}
                type="button"
                aria-pressed={feedFilter === "message"}
                aria-controls="manager-home-unified-feed"
                onClick={() => changeFeedFilter("message")}
              >
                {messageCount} {messageCount === 1 ? "Message" : "Messages"}
              </button>
              <button
                className={`manager-home-count manager-home-count--event${feedFilter === "event" ? " is-active" : ""}`}
                type="button"
                aria-pressed={feedFilter === "event"}
                aria-controls="manager-home-unified-feed"
                onClick={() => changeFeedFilter("event")}
              >
                {eventCount} Event {eventCount === 1 ? "Notification" : "Notifications"}
              </button>
              {selectedFeedCount > 0 && (
                <span className="manager-home-bulk-actions" aria-live="polite">
                  <strong>{selectedFeedCount} selected</strong>
                  <button type="button" aria-label="Delete selected" onClick={deleteSelectedFeedThreads}>
                    <Trash2 size={17} />
                    <span>Delete</span>
                  </button>
                </span>
              )}
            </div>
          </div>
          <div className={`manager-home-search-shell${isFeedSearchOpen ? " is-open" : ""}`}>
            {isFeedSearchOpen ? (
              <div className="manager-home-search" role="search">
                <Search size={22} aria-hidden="true" />
                <label className="sr-only" htmlFor="manager-home-feed-search">Search messages and event notifications</label>
                <input
                  aria-label="Search messages and event notifications"
                  id="manager-home-feed-search"
                  ref={feedSearchInputRef}
                  type="search"
                  placeholder="Search messages and event notifications..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={handleFeedSearchKeyDown}
                />
                <button className="manager-home-search-close" type="button" aria-label="Close search messages and event notifications" onClick={closeFeedSearch}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                className="manager-home-search-trigger"
                type="button"
                aria-label="Open search messages and event notifications"
                aria-controls="manager-home-feed-search"
                aria-expanded="false"
                onClick={() => setIsFeedSearchOpen(true)}
              >
                <Search size={24} />
              </button>
            )}
          </div>
          <div className="manager-home-unified-feed" id="manager-home-unified-feed" aria-label="Home message and notification feed">
            {visibleFeedSections.length ? (
              visibleFeedSections.map((section) => (
                <section className="manager-home-date-section" key={section.date} aria-label={`Messages and event notifications from ${section.date}`}>
                  <div className="manager-home-date-divider" role="separator" aria-label={`Messages and event notifications from ${section.date}`}>
                    <span>{section.date}</span>
                  </div>
                  {section.threads.map((thread) => {
                    const isSelected = thread.id === selectedThreadId;
                    const isBulkSelected = selectedFeedThreadIds.has(thread.id);
                    const isUnread = Boolean(thread.unread);
                    const kindLabel = thread.kind === "event" ? "Event Notification" : "Message";
                    const readStatusLabel = isUnread ? "Unread" : "Read";

                    return (
                      <article className={`manager-home-feed-item manager-home-feed-item--${thread.kind}${isUnread ? " is-unread" : " is-read"}${isSelected ? " is-selected" : ""}${isBulkSelected ? " is-bulk-selected" : ""}`} key={thread.id}>
                        <div className="manager-home-feed-row">
                          <button
                            className="manager-home-feed-button"
                            type="button"
                            aria-expanded={isSelected}
                            aria-controls={`manager-home-feed-detail-${thread.id}`}
                            onClick={() => openFeedThread(thread.id)}
                          >
                            <span className="manager-home-thread-avatar">
                              <img src={thread.avatar} alt="" draggable="false" />
                            </span>
                            <span className="manager-home-feed-copy">
                              <strong>{thread.sender}</strong>
                              <span className={`manager-home-read-status ${isUnread ? "is-unread" : "is-read"}`} aria-label={`${readStatusLabel} ${kindLabel.toLowerCase()}`}>
                                <span aria-hidden="true" />
                                <span>{readStatusLabel}</span>
                              </span>
                              <em>{kindLabel}</em>
                              <b>{thread.title}</b>
                              <small>{thread.preview}</small>
                              <time className="manager-home-inline-sent" dateTime={thread.sentDateTime} aria-label={`${thread.title} sent at ${thread.sentTime}`}>
                                {thread.sentTime}
                              </time>
                            </span>
                          </button>
                          <label className="manager-home-feed-check">
                            <span className="sr-only">Select {thread.title}</span>
                            <input
                              aria-label={`Select ${thread.title}`}
                              type="checkbox"
                              checked={isBulkSelected}
                              onChange={() => toggleFeedThreadSelection(thread.id)}
                            />
                            <span aria-hidden="true" />
                          </label>
                        </div>
                        {isSelected && (
                          <div className="manager-home-feed-detail" id={`manager-home-feed-detail-${thread.id}`} aria-label={`${thread.title} details`}>
                            <div className="manager-home-detail-title-row">
                              <span>{kindLabel}</span>
                              <time dateTime={thread.sentDateTime}>Sent {thread.sentDate} at {thread.sentTime}</time>
                            </div>
                            <h2>{thread.title}</h2>
                            <header>
                              <span className="manager-home-thread-avatar">
                                <img src={thread.avatar} alt="" draggable="false" />
                              </span>
                              <div>
                                <strong>{thread.sender}</strong>
                                <p>{thread.kind === "event" ? "event notice to All Students, Coaches" : "message to All Students, Coaches"}</p>
                              </div>
                              <button type="button" aria-label="More message actions">
                                <MoreHorizontal size={20} />
                              </button>
                            </header>
                            <div className="manager-home-message-copy">
                              <p>Hello everyone,</p>
                              <p>{thread.preview.replace("...", ".")} Please read the details carefully and reach out if you have any questions.</p>
                            </div>
                            {thread.kind === "event" && (
                              <section className="manager-home-event-card" aria-label="Event details">
                                <h3>Event Details</h3>
                                <p><CalendarDays size={18} /> <span>Date: July 25 - July 27, 2025</span></p>
                                <p><MapPin size={18} /> <span>Location: Grand Sports Arena, New York</span></p>
                                <p><Users size={18} /> <span>Participants: All registered students</span></p>
                                <p><CheckCircle2 size={18} /> <span>Check-in Time: 8:00 AM on July 25</span></p>
                              </section>
                            )}
                            <p>{thread.kind === "event" ? "Make sure to arrive on time and bring all required gear. Let's make this a great event!" : "This message is ready for staff follow-up from the Home Page feed."}</p>
                            <p>Best regards,<br />{thread.sender}</p>
                            <div className="manager-home-reply">
                              <input
                                aria-label="Write a reply"
                                placeholder="Write a reply..."
                                value={replyText}
                                onChange={(event) => setReplyText(event.target.value)}
                              />
                              <button type="button" onClick={sendReply}>
                                <Send size={20} /> Reply
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              ))
            ) : (
              <p className="manager-home-empty">No messages or event notifications match your search.</p>
            )}
          </div>
        </section>
      </main>
    </section>
  );
}

function ManagerLauncherPage() {
  const { logout, session, showToast } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSettings, setProfileSettings] = useState(() => readManagerProfile(session?.email));
  const [profilePassword, setProfilePassword] = useState({ newPassword: "", confirmPassword: "" });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const selectedLauncherItem = getSelectedManagerLauncherItem(location.search);
  const sidebarToggleLabel = isSidebarCollapsed ? "Expand manager app launcher" : "Collapse manager app launcher";

  useEffect(() => {
    if (new URLSearchParams(location.search).get("profile") !== "settings") return;
    setProfileSettings(readManagerProfile(session?.email));
    setProfilePassword({ newPassword: "", confirmPassword: "" });
    setProfileOpen(true);
    navigate("/manager", { replace: true });
  }, [location.search, navigate, session?.email]);

  const selectProfileTheme = (theme: AppThemeMode) => {
    setProfileSettings((current) => ({ ...current, theme }));
    writeManagerProfile({ ...readManagerProfile(session?.email), theme });
    writeStoredAppTheme(theme);
  };

  const closeProfileSettings = () => {
    setProfileOpen(false);
    navigate("/", { replace: true });
  };

  const saveProfileSettings = (event: FormEvent) => {
    event.preventDefault();
    const newPassword = profilePassword.newPassword.trim();
    const confirmPassword = profilePassword.confirmPassword.trim();
    const nextProfile: ManagerProfileSettings = {
      name: profileSettings.name.trim(),
      username: profileSettings.username.trim(),
      email: profileSettings.email.trim(),
      phone: profileSettings.phone.trim(),
      updates: profileSettings.updates,
      theme: profileSettings.theme,
      photoDataUrl: profileSettings.photoDataUrl,
      passwordUpdatedAt: profileSettings.passwordUpdatedAt
    };

    if (!nextProfile.name) {
      showToast("Enter a manager profile name.");
      return;
    }

    if (!nextProfile.username) {
      showToast("Enter a manager username.");
      return;
    }

    if (!validateEmail(nextProfile.email)) {
      showToast("Enter a valid manager profile email.");
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        showToast("Enter a password with at least 8 characters.");
        return;
      }

      if (newPassword !== confirmPassword) {
        showToast("The manager passwords do not match.");
        return;
      }

      nextProfile.passwordUpdatedAt = new Date().toISOString();
    }

    applyAppTheme(nextProfile.theme);
    writeStoredAppTheme(nextProfile.theme);
    writeManagerProfile(nextProfile);
    setProfileSettings(nextProfile);
    setProfilePassword({ newPassword: "", confirmPassword: "" });
    setProfileOpen(false);
    navigate("/", { replace: true });
    showToast("Manager profile settings saved.");
  };

  return (
    <section className="manager-launcher-page" aria-label="Manager dashboard">
      <main className="manager-launcher-main">
        <header className="manager-launcher-topbar manager-page-title-bar" aria-label="Manager panel page header">
          <ManagerPageTitleFrame title="MANAGER PANEL" className="manager-page-title-frame--manager-panel" />
          <nav className="manager-home-top-actions" aria-label="Manager panel quick actions">
            <Link className="manager-home-top-action manager-launcher-profile-link" to="/" aria-label="Profile">
              <img
                className="manager-home-profile-action-photo"
                src={profileSettings.photoDataUrl ?? publicAsset("assets/CheetahProfilePic/Cheetah.png")}
                alt=""
                draggable="false"
              />
              <span className="manager-home-top-action-label">Profile</span>
            </Link>
            <button className="manager-home-top-action manager-home-logout-button" type="button" aria-label="Log Out" onClick={logout}>
              <img className="manager-home-logout-icon" src={managerLogoutIcon} alt="" draggable="false" />
              <span className="manager-home-top-action-label">Log Out</span>
            </button>
          </nav>
        </header>
        <div className={`manager-launcher-body${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}`} role="group" aria-label="Manager launcher workspace frame">
          <nav
            className="manager-launcher-grid manager-launcher-sidebar"
            id="manager-launcher-sidebar"
            aria-label="Manager app launcher"
            data-orientation="vertical"
            hidden={isSidebarCollapsed}
          >
            {managerLauncherItems.map((item) => {
              const isSelected = item.icon === selectedLauncherItem.icon;
              return (
                <Link
                  className={`manager-launcher-item${isSelected ? " is-selected" : ""}`}
                  key={item.label}
                  to={managerLauncherPath(item)}
                  title={item.label}
                  aria-current={isSelected ? "page" : undefined}
                  data-future={item.future ? "true" : undefined}
                >
                  <ManagerLauncherIcon icon={item.icon} />
                  <span className="manager-launcher-label">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <button
            className="manager-launcher-rail-toggle"
            type="button"
            aria-label={sidebarToggleLabel}
            aria-controls="manager-launcher-sidebar"
            aria-expanded={!isSidebarCollapsed}
            title={sidebarToggleLabel}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            <span className="manager-launcher-rail-toggle-bar" aria-hidden="true" />
          </button>
          <section className="manager-launcher-workspace" aria-label={`${selectedLauncherItem.label} workspace`}>
            <ManagerLauncherWorkspace tool={selectedLauncherItem.icon} />
          </section>
        </div>
      </main>
      {profileOpen && (
        <div className="modal-backdrop manager-profile-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeProfileSettings()}>
          <form className="modal-card manager-profile-modal" role="dialog" aria-modal="true" aria-label="Manager profile settings" onSubmit={saveProfileSettings}>
            <header className="student-modal-head">
              <div>
                <h2>Profile Settings</h2>
                <p>Edit manager access, contact settings, and app theme.</p>
              </div>
              <button className="student-modal-close" type="button" aria-label="Close manager profile settings" onClick={closeProfileSettings}>
                <X size={20} />
              </button>
            </header>
            <section className="student-form-section manager-profile-form-section">
              <label className="field-label">
                Name
                <input
                  className="input"
                  value={profileSettings.name}
                  onChange={(event) => setProfileSettings({ ...profileSettings, name: event.target.value })}
                  placeholder="Cho's Manager"
                />
              </label>
              <label className="field-label">
                Username
                <input
                  className="input"
                  value={profileSettings.username}
                  onChange={(event) => setProfileSettings({ ...profileSettings, username: event.target.value })}
                  autoComplete="username"
                  placeholder="chos-manager"
                />
              </label>
              <label className="field-label">
                Email
                <input
                  className="input"
                  value={profileSettings.email}
                  onChange={(event) => setProfileSettings({ ...profileSettings, email: event.target.value })}
                  placeholder="manager@chos.prototype"
                />
              </label>
              <label className="field-label">
                Phone
                <input
                  className="input"
                  value={profileSettings.phone}
                  onChange={(event) => setProfileSettings({ ...profileSettings, phone: event.target.value })}
                  placeholder="(262) 555-0100"
                />
              </label>
              <label className="field-label">
                New Password
                <input
                  className="input"
                  type="password"
                  value={profilePassword.newPassword}
                  onChange={(event) => setProfilePassword({ ...profilePassword, newPassword: event.target.value })}
                  autoComplete="new-password"
                  placeholder="Enter new password"
                />
              </label>
              <label className="field-label">
                Confirm Password
                <input
                  className="input"
                  type="password"
                  value={profilePassword.confirmPassword}
                  onChange={(event) => setProfilePassword({ ...profilePassword, confirmPassword: event.target.value })}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                />
              </label>
              <div className="manager-profile-preferences">
                <div className="manager-theme-setting" role="group" aria-label="App theme">
                  <span>App Theme</span>
                  <div className="manager-theme-options">
                    <button
                      type="button"
                      className={`manager-theme-option${profileSettings.theme === "light" ? " is-active" : ""}`}
                      aria-pressed={profileSettings.theme === "light"}
                      onClick={() => selectProfileTheme("light")}
                    >
                      <Sun size={16} /> Light
                    </button>
                    <button
                      type="button"
                      className={`manager-theme-option${profileSettings.theme === "dark" ? " is-active" : ""}`}
                      aria-pressed={profileSettings.theme === "dark"}
                      onClick={() => selectProfileTheme("dark")}
                    >
                      <Moon size={16} /> Dark
                    </button>
                  </div>
                </div>
                <label className="manager-profile-check">
                  <input
                    type="checkbox"
                    checked={profileSettings.updates}
                    onChange={(event) => setProfileSettings({ ...profileSettings, updates: event.target.checked })}
                  />
                  <span>Receive manager updates and reminders</span>
                </label>
              </div>
            </section>
            <div className="student-editor-actions manager-profile-actions">
              <button type="submit">
                <CheckCircle2 size={18} /> Save Profile Settings
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function DashboardPage() {
  const { scheduledClasses, studioClasses, studioEvents } = useAppState();

  return (
    <OperationsPage title="Dashboard" text="Review the live studio month calendar and jump into schedule management.">
      <div className="manager-dashboard-calendar-page manager-launcher-calendar">
        <ManagerLiveCalendar scheduledClasses={scheduledClasses} studioClasses={studioClasses} studioEvents={studioEvents} />
      </div>
    </OperationsPage>
  );
}

function ReportsPage() {
  return (
    <section className="manager-future-page" aria-label="Manager reports">
      <div className="manager-future-panel">
        <BarChart3 size={72} strokeWidth={1.6} aria-hidden="true" />
        <p>Coming soon</p>
        <h1>Reports</h1>
      </div>
    </section>
  );
}

const genderOptions = ["Not specified", "Female", "Male", "Nonbinary", "Prefer not to say"];
const statusOptions = ["Active", "Trial", "Paused", "Inactive"];

function makeBlankStudentForm() {
  return {
    fullName: "",
    dateOfBirth: "",
    gender: "Not specified",
    studentEmail: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    emergencyContactEmail: "",
    enrollmentDate: new Date().toISOString().slice(0, 10),
    program: "Youth Foundations",
    status: "Active",
    beltRank: "White",
    notes: ""
  };
}

function studentToForm(student: StudentRecord) {
  return {
    fullName: fullName(student),
    dateOfBirth: student.dateOfBirth ?? "",
    gender: student.gender ?? "Not specified",
    studentEmail: student.email,
    guardianName: student.guardianName ?? "",
    guardianPhone: student.guardianPhone ?? student.phone,
    guardianEmail: student.guardianEmail ?? "",
    emergencyContactName: student.emergencyContactName ?? "",
    emergencyContactRelationship: student.emergencyContactRelationship ?? "",
    emergencyContactPhone: student.emergencyContactPhone ?? "",
    emergencyContactEmail: student.emergencyContactEmail ?? "",
    enrollmentDate: student.enrollmentDate ?? student.joinedAt,
    program: student.program ?? "Youth Foundations",
    status: student.status ?? "Active",
    beltRank: student.beltRank,
    notes: student.notes ?? ""
  };
}

function slugClassName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function beltClassName(rank: string) {
  return slugClassName(rank);
}

function audienceLabel(value: StudioEvent["audience"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const studentDirectoryAgeReferenceDate = new Date("2026-05-17T00:00:00");

function parseStudentBirthDate(value?: string) {
  if (!value) return undefined;
  const birthDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(birthDate.getTime()) ? undefined : birthDate;
}

function studentDirectoryAge(student: StudentRecord) {
  const birthDate = parseStudentBirthDate(student.dateOfBirth);
  if (!birthDate) return "Not set";

  let age = studentDirectoryAgeReferenceDate.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    studentDirectoryAgeReferenceDate.getMonth() > birthDate.getMonth() ||
    (studentDirectoryAgeReferenceDate.getMonth() === birthDate.getMonth() && studentDirectoryAgeReferenceDate.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;

  return age.toString();
}

function StudentsPage() {
  const { students, messageLogs, addOperationsStudent, updateOperationsStudent, deleteOperationsStudent, showToast } = useAppState();
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const [form, setForm] = useState(makeBlankStudentForm);
  const [studentModalMode, setStudentModalMode] = useState<"create" | "edit" | null>(null);
  const welcomeLogs = messageLogs.filter((message) => message.kind === "welcome");

  const studentsByBelt = useMemo(() => {
    const knownBelts = beltOptions.map((belt) => belt.toLowerCase());
    const studentsByName = [...students].sort((left, right) => fullName(left).localeCompare(fullName(right), undefined, { sensitivity: "base" }));
    const configuredGroups = beltOptions
      .map((belt) => ({
        belt,
        students: studentsByName.filter((student) => student.beltRank.toLowerCase() === belt.toLowerCase())
      }))
      .filter((group) => group.students.length > 0);
    const customGroups = Array.from(new Set(studentsByName.map((student) => student.beltRank).filter((rank) => !knownBelts.includes(rank.toLowerCase()))))
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .map((belt) => ({
        belt,
        students: studentsByName.filter((student) => student.beltRank === belt)
      }));

    return [...configuredGroups, ...customGroups];
  }, [students]);

  const selectStudent = (student: StudentRecord) => {
    setSelectedStudentId(student.id);
    setForm(studentToForm(student));
    setStudentModalMode("edit");
  };

  const openCreateStudent = () => {
    setSelectedStudentId("");
    setForm(makeBlankStudentForm());
    setStudentModalMode("create");
  };

  const closeStudentModal = () => {
    setStudentModalMode(null);
    setSelectedStudentId("");
    setForm(makeBlankStudentForm());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (selectedStudent) {
      const updated = updateOperationsStudent(selectedStudent.id, form);
      if (!updated) {
        showToast("Enter student name, phone, and email.");
        return;
      }
      setForm(studentToForm(updated));
      setStudentModalMode(null);
      showToast(`${fullName(updated)} updated.`);
      return;
    }

    const created = addOperationsStudent(form);
    if (!created) {
      showToast("Enter student name, phone, and email.");
      return;
    }
    closeStudentModal();
    showToast(`${fullName(created)} added with welcome text queued.`);
  };

  const deleteSelectedStudent = () => {
    if (!selectedStudent) return;
    const deleted = deleteOperationsStudent(selectedStudent.id);
    if (!deleted) {
      showToast("Select a student to delete.");
      return;
    }
    closeStudentModal();
    showToast(`${fullName(deleted)} deleted from the student list.`);
  };

  const renderStudentNameButton = (student: StudentRecord) => {
    const studentName = fullName(student);
    const genderLabel = student.gender?.trim() || "Not set";

    return (
      <button key={student.id} type="button" className="student-name-list-button" data-testid="student-name-list-button" aria-label={`Open ${studentName} student info`} onClick={() => selectStudent(student)}>
        <span className="student-name-list-icon" aria-hidden="true" />
        <span className="student-name-list-name">{studentName}</span>
        <span className="student-name-list-cell student-name-list-cell--gender">{genderLabel}</span>
        <span className="student-name-list-cell student-name-list-cell--age">{studentDirectoryAge(student)}</span>
      </button>
    );
  };

  const headerAction = (
    <button type="button" className="operations-action student-header-add" onClick={openCreateStudent}>
      <Plus size={18} /> Create New Student
    </button>
  );
  const modalTitle = selectedStudent ? `${fullName(selectedStudent)} Student Info` : "Create New Student";

  return (
    <OperationsPage className="operations-page--students" title="Students" text="Review each belt group as a compact student list, then select a student name to open their full info." action={headerAction}>
      <div className="students-workspace students-workspace--directory">
        <section className="operations-panel student-roster-panel student-directory-panel student-directory-panel--compact">
          <div className="student-roster-head">
            <div>
              <h2>Student Directory</h2>
              <p>{students.length} student{students.length === 1 ? "" : "s"} listed by belt. Select a name to open student info.</p>
            </div>
          </div>
          <div className="student-directory-scroll student-belt-directory-grid" aria-label="Student directory by belt">
            {studentsByBelt.map(({ belt, students: beltStudents }) => (
              <section key={belt} className={`student-belt-group student-belt-group--card student-belt-group--${beltClassName(belt)}`} role="group" aria-label={`${belt} belt students`}>
                <div className="student-belt-group-head">
                  <div>
                    <span className="student-belt-group-swatch" aria-hidden="true" />
                    <h3>{belt} Belt</h3>
                  </div>
                  <span>{beltStudents.length} student{beltStudents.length === 1 ? "" : "s"}</span>
                </div>
                <div className="student-name-list">
                  <div className="student-name-list-head" aria-hidden="true">
                    <span aria-hidden="true" />
                    <span className="student-name-list-column-label">Name</span>
                    <span className="student-name-list-column-label">Gender</span>
                    <span className="student-name-list-column-label">Age</span>
                  </div>
                  {beltStudents.map(renderStudentNameButton)}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="operations-panel student-welcome-panel">
          <h2>Welcome Text Queue</h2>
          {welcomeLogs.length ? welcomeLogs.map((message) => <MessagePreview key={message.id} message={message} />) : <p>No welcome texts queued yet.</p>}
        </section>
      </div>

      {studentModalMode && (
        <div className="modal-backdrop student-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeStudentModal()}>
          <form
            aria-labelledby="student-modal-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel student-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="student-modal-title">{modalTitle}</h2>
                <p>{selectedStudent ? "Review or update student records, contacts, enrollment, belt rank, and notes." : "Enter the full student profile before adding them to the directory."}</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close student form" onClick={closeStudentModal}>
                <X size={18} />
              </button>
            </div>

            <section className="student-form-section">
              <h3>Student Information</h3>
              <div className="student-form-grid">
                <label>
                  Full Name
                  <input autoFocus value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
                </label>
                <label>
                  Date of Birth
                  <input type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
                </label>
                <label>
                  Gender
                  <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
                    {genderOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Student Email
                  <input inputMode="email" value={form.studentEmail} onChange={(event) => setForm({ ...form, studentEmail: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="student-form-section">
              <h3>Parent/Guardian Information</h3>
              <div className="student-form-grid">
                <label>
                  Parent/Guardian Name
                  <input value={form.guardianName} onChange={(event) => setForm({ ...form, guardianName: event.target.value })} />
                </label>
                <label>
                  Phone Number
                  <input aria-label="Parent/Guardian Phone Number" value={form.guardianPhone} onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })} />
                </label>
                <label>
                  Email Address
                  <input aria-label="Parent/Guardian Email Address" inputMode="email" value={form.guardianEmail} onChange={(event) => setForm({ ...form, guardianEmail: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="student-form-section">
              <h3>Emergency Contact Information</h3>
              <div className="student-form-grid">
                <label>
                  Contact Name
                  <input aria-label="Emergency Contact Name" value={form.emergencyContactName} onChange={(event) => setForm({ ...form, emergencyContactName: event.target.value })} />
                </label>
                <label>
                  Relationship
                  <input aria-label="Emergency Relationship" value={form.emergencyContactRelationship} onChange={(event) => setForm({ ...form, emergencyContactRelationship: event.target.value })} />
                </label>
                <label>
                  Phone Number
                  <input aria-label="Emergency Phone Number" value={form.emergencyContactPhone} onChange={(event) => setForm({ ...form, emergencyContactPhone: event.target.value })} />
                </label>
                <label>
                  Email Address
                  <input aria-label="Emergency Email Address" inputMode="email" value={form.emergencyContactEmail} onChange={(event) => setForm({ ...form, emergencyContactEmail: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="student-form-section">
              <h3>Enrollment Details</h3>
              <div className="student-form-grid">
                <label>
                  Enrollment Date
                  <input type="date" value={form.enrollmentDate} onChange={(event) => setForm({ ...form, enrollmentDate: event.target.value })} />
                </label>
                <label>
                  Program
                  <input value={form.program} onChange={(event) => setForm({ ...form, program: event.target.value })} />
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Belt rank
                  <select value={form.beltRank} onChange={(event) => setForm({ ...form, beltRank: event.target.value })}>
                    {beltOptions.map((rank) => (
                      <option key={rank} value={rank}>{rank}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Notes
                <textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>
            </section>

            <div className="student-editor-actions">
              <button type="submit">
                <Plus size={18} /> {selectedStudent ? "Save Student Changes" : "Create Student"}
              </button>
              {selectedStudent && (
                <button type="button" className="student-delete-action" onClick={deleteSelectedStudent}>
                  <Trash2 size={18} /> Delete Student
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

const blankClassForm = {
  name: "",
  daysOfWeek: [] as ClassWeekday[],
  startTime: "17:00",
  endTime: "17:45",
  recurring: true,
  titleColor: "#b8f5e2",
  notes: ""
};

function studioClassToForm(studioClass: StudioClass) {
  return {
    name: studioClass.name,
    daysOfWeek: studioClass.daysOfWeek,
    startTime: studioClass.startTime,
    endTime: studioClass.endTime,
    recurring: studioClass.recurring ?? true,
    titleColor: studioClass.titleColor ?? "#b8f5e2",
    notes: studioClass.notes ?? ""
  };
}

function ClassCard({ studioClass, onSelect }: { studioClass: StudioClass; onSelect: (studioClass: StudioClass) => void }) {
  const className = studioClass.name;

  return (
    <button type="button" className="workflow-directory-row workflow-directory-row--button workflow-directory-row--class" aria-label={`Edit ${className}`} onClick={() => onSelect(studioClass)}>
      <span className="workflow-directory-icon workflow-directory-icon--class" style={studioClass.titleColor ? { "--workflow-accent": studioClass.titleColor } as CSSProperties : undefined} aria-hidden="true" />
      <span className="workflow-directory-name" style={studioClass.titleColor ? { color: studioClass.titleColor } : undefined}>{className}</span>
      <span className="workflow-directory-cell">{formatClassDays(studioClass.daysOfWeek)}</span>
      <span className="workflow-directory-cell">{formatClassTimeRange(studioClass)}</span>
      <span className="workflow-directory-cell">{studioClass.recurring === false ? "Not recurring on calendar" : "Repeats weekly on calendar"}</span>
    </button>
  );
}

function ClassesPage() {
  const { studioClasses, addStudioClass, updateStudioClass, deleteStudioClass, showToast } = useAppState();
  const [selectedClassId, setSelectedClassId] = useState("");
  const selectedClass = studioClasses.find((studioClass) => studioClass.id === selectedClassId);
  const [form, setForm] = useState(blankClassForm);
  const [classModalOpen, setClassModalOpen] = useState(false);
  const classGroups = useMemo(
    () => [
      { label: "Recurring Classes", items: studioClasses.filter((studioClass) => studioClass.recurring !== false) },
      { label: "Calendar Off", items: studioClasses.filter((studioClass) => studioClass.recurring === false) }
    ].filter((group) => group.items.length > 0),
    [studioClasses]
  );

  const resetForm = () => {
    setSelectedClassId("");
    setForm(blankClassForm);
  };

  const openCreateClass = () => {
    resetForm();
    setClassModalOpen(true);
  };

  const closeClassModal = () => {
    setClassModalOpen(false);
    resetForm();
  };

  const selectClass = (studioClass: StudioClass) => {
    setSelectedClassId(studioClass.id);
    setForm(studioClassToForm(studioClass));
    setClassModalOpen(true);
  };

  const toggleDay = (day: ClassWeekday) => {
    setForm((current) => ({
      ...current,
      daysOfWeek: current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((item) => item !== day)
        : [...current.daysOfWeek, day].sort((left, right) => left - right) as ClassWeekday[]
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const savedClass = selectedClass
      ? updateStudioClass(selectedClass.id, form)
      : addStudioClass(form);
    if (!savedClass) {
      showToast("Enter a class name, at least one day, and a valid start/end time.");
      return;
    }
    setSelectedClassId(savedClass.id);
    setForm(studioClassToForm(savedClass));
    setClassModalOpen(false);
    showToast(`${savedClass.name} saved to Classes and added to the calendar.`);
  };

  const removeSelectedClass = () => {
    if (!selectedClass) return;
    const removed = deleteStudioClass(selectedClass.id);
    if (!removed) return;
    closeClassModal();
    showToast(`${removed.name} removed from Classes and calendar.`);
  };
  const modalTitle = selectedClass ? `Edit ${selectedClass.name}` : "Create Class";

  return (
    <OperationsPage
      className="operations-page--workflow"
      title="Classes"
      text="Create recurring weekly classes, edit class days, and set start/end times that flow into the main calendar."
      action={
        <button type="button" className="student-header-add" onClick={openCreateClass}>
          <Plus size={18} /> New Class
        </button>
      }
    >
      <section className="operations-panel workflow-directory-panel">
        <div className="student-roster-head">
          <div>
            <h2>Class Directory</h2>
            <p>{studioClasses.length} class{studioClasses.length === 1 ? "" : "es"} organized by calendar status. Select a class row to edit details.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Class directory">
          {classGroups.map((group) => (
            <section key={group.label} className={`workflow-directory-group workflow-directory-group--${slugClassName(group.label)}`} role="group" aria-label={`${group.label} class items`}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{group.label}</h3>
                </div>
                <span>{group.items.length} class{group.items.length === 1 ? "" : "es"}</span>
              </div>
              <div className="workflow-directory-list workflow-directory-list--classes">
                <div className="workflow-directory-list-head" aria-hidden="true">
                  <span aria-hidden="true" />
                  <span className="workflow-directory-column-label">Class</span>
                  <span className="workflow-directory-column-label">Days</span>
                  <span className="workflow-directory-column-label">Time</span>
                  <span className="workflow-directory-column-label">Calendar</span>
                </div>
                {group.items.map((studioClass) => (
                  <ClassCard key={studioClass.id} studioClass={studioClass} onSelect={selectClass} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      {classModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeClassModal()}>
          <form
            aria-labelledby="class-modal-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel student-modal-card workflow-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="class-modal-title">{modalTitle}</h2>
                <p>Manage class days, times, calendar recurrence, and display color.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close class editor" onClick={closeClassModal}>
                <X size={18} />
              </button>
            </div>
            <label>
              Class name
              <input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <fieldset className="class-day-picker">
              <legend>Class days</legend>
              {weekdayOptions.map((day) => (
                <label key={day.value}>
                  <input type="checkbox" checked={form.daysOfWeek.includes(day.value)} onChange={() => toggleDay(day.value)} />
                  <span>{day.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="class-time-grid">
              <label>
                Start time
                <input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
              </label>
              <label>
                End time
                <input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
              </label>
            </div>
            <label>
              Title color
              <input type="color" value={form.titleColor} onChange={(event) => setForm({ ...form, titleColor: event.target.value })} />
            </label>
            <label className="operations-checkbox-row">
              <input
                type="checkbox"
                checked={form.recurring}
                onChange={(event) => setForm({ ...form, recurring: event.target.checked })}
              />
              Recurring
            </label>
            <label>
              Class notes
              <textarea value={form.notes} rows={3} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
            <div className="student-editor-actions">
              <button type="submit">
                <CheckCircle2 size={18} /> {selectedClass ? "Save Class Changes" : "Create Class"}
              </button>
              {selectedClass && (
                <button type="button" className="student-delete-action" onClick={removeSelectedClass}>
                  <Trash2 size={18} /> Remove Class
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

function ScheduleCard({ item, students }: { item: ScheduledClass; students: StudentRecord[] }) {
  const student = item.studentId ? students.find((entry) => entry.id === item.studentId) : undefined;
  return (
    <article className="workflow-directory-row workflow-directory-row--schedule">
      <span className="workflow-directory-icon workflow-directory-icon--schedule" style={item.titleColor ? { "--workflow-accent": item.titleColor } as CSSProperties : undefined} aria-hidden="true" />
      <span className="workflow-directory-name" style={item.titleColor ? { color: item.titleColor } : undefined}>
        {item.title}
        <small>{student ? `Student: ${fullName(student)}` : item.notes || scheduleTypeLabel(item.type)}</small>
      </span>
      <span className="workflow-directory-cell">{item.date}</span>
      <span className="workflow-directory-cell">{item.time}</span>
      <span className="workflow-directory-cell">
        <span>{item.date} at {item.time}</span>
        {item.recurring && <small>Repeats weekly</small>}
      </span>
    </article>
  );
}

function SchedulePage() {
  const { students, scheduledClasses, addScheduledClass, showToast } = useAppState();
  const [form, setForm] = useState({ title: "", date: "2026-05-22", time: "5:30 PM", type: "class", titleColor: "#b8f5e2", recurring: false, studentId: "", notes: "" });
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [customScheduleTypes, setCustomScheduleTypes] = useState<string[]>([]);
  const [isCustomTypeDialogOpen, setIsCustomTypeDialogOpen] = useState(false);
  const [newScheduleTypeName, setNewScheduleTypeName] = useState("");
  const scheduleTypeOptions = useMemo(() => {
    const options = new Map(defaultScheduleTypeOptions.map((option) => [option.value, option]));
    customScheduleTypes.forEach((type) => {
      const trimmed = type.trim();
      if (trimmed && !options.has(trimmed)) {
        options.set(trimmed, { value: trimmed, label: scheduleTypeLabel(trimmed) });
      }
    });
    scheduledClasses.forEach((item) => {
      if (item.type.trim() && !options.has(item.type)) {
        options.set(item.type, { value: item.type, label: scheduleTypeLabel(item.type) });
      }
    });
    return [...options.values()];
  }, [customScheduleTypes, scheduledClasses]);
  const scheduleGroups = useMemo(
    () => scheduleTypeOptions
      .map((option) => ({
        label: option.label,
        value: option.value,
        items: scheduledClasses.filter((item) => item.type === option.value)
      }))
      .filter((group) => group.items.length > 0),
    [scheduleTypeOptions, scheduledClasses]
  );

  const closeCustomTypeDialog = () => {
    setIsCustomTypeDialogOpen(false);
    setNewScheduleTypeName("");
  };

  const openScheduleModal = () => {
    setScheduleModalOpen(true);
  };

  const closeScheduleModal = () => {
    setScheduleModalOpen(false);
    setForm({ title: "", date: form.date, time: form.time, type: "class", titleColor: "#b8f5e2", recurring: false, studentId: "", notes: "" });
  };

  const submitCustomScheduleType = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newScheduleTypeName.trim();
    if (!trimmed) {
      showToast("Enter a schedule type name.");
      return;
    }
    const existingType = scheduleTypeOptions.find(
      (option) => option.value.toLowerCase() === trimmed.toLowerCase() || option.label.toLowerCase() === trimmed.toLowerCase()
    );
    const scheduleType = existingType?.value ?? trimmed;
    if (!existingType) {
      setCustomScheduleTypes((current) =>
        current.some((type) => type.toLowerCase() === trimmed.toLowerCase()) ? current : [...current, trimmed]
      );
    }
    setForm((current) => ({ ...current, type: scheduleType }));
    closeCustomTypeDialog();
    showToast(`${scheduleTypeLabel(scheduleType)} added to schedule types.`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const created = addScheduledClass({
      title: form.title,
      date: form.date,
      time: form.time,
      type: form.type,
      recurring: form.recurring,
      titleColor: form.titleColor,
      studentId: form.studentId || undefined,
      notes: form.notes
    });
    if (!created) {
      showToast("Enter a schedule title, date, time, and type.");
      return;
    }
    setForm({ title: "", date: form.date, time: form.time, type: "class", titleColor: "#b8f5e2", recurring: false, studentId: "", notes: "" });
    setScheduleModalOpen(false);
    showToast(`${created.title} added to schedule.`);
  };

  return (
    <OperationsPage
      className="operations-page--workflow"
      title="Schedule"
      text="Create class, private lesson, and testing-prep schedule items."
      action={
        <button type="button" className="operations-action student-header-add" onClick={openScheduleModal}>
          <Plus size={18} /> Add Schedule Event
        </button>
      }
    >
      <section className="operations-panel workflow-directory-panel">
        <div className="student-roster-head">
          <div>
            <h2>Upcoming Schedule</h2>
            <p>{scheduledClasses.length} schedule item{scheduledClasses.length === 1 ? "" : "s"} grouped by type for quick scanning.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Schedule directory">
          {scheduleGroups.map((group) => (
            <section key={group.value} className={`workflow-directory-group workflow-directory-group--${slugClassName(group.label)}`} role="group" aria-label={`${group.label} schedule items`}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{group.label}</h3>
                </div>
                <span>{group.items.length} item{group.items.length === 1 ? "" : "s"}</span>
              </div>
              <div className="workflow-directory-list workflow-directory-list--schedule">
                <div className="workflow-directory-list-head" aria-hidden="true">
                  <span aria-hidden="true" />
                  <span className="workflow-directory-column-label">Title</span>
                  <span className="workflow-directory-column-label">Date</span>
                  <span className="workflow-directory-column-label">Time</span>
                  <span className="workflow-directory-column-label">Status</span>
                </div>
                {group.items.map((item) => <ScheduleCard key={item.id} item={item} students={students} />)}
              </div>
            </section>
          ))}
        </div>
      </section>
      {scheduleModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeScheduleModal()}>
          <form
            aria-labelledby="schedule-modal-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel student-modal-card workflow-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
          <div className="student-modal-head">
            <div>
              <h2 id="schedule-modal-title">Add Schedule Event</h2>
              <p>Create a one-time or recurring schedule item for the calendar.</p>
            </div>
            <button type="button" className="student-modal-close" aria-label="Close schedule editor" onClick={closeScheduleModal}>
              <X size={18} />
            </button>
          </div>
          <label>
            Event title
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label>
            Schedule date
            <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </label>
          <label>
            Schedule time
            <input value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
          </label>
          <label>
            Title color
            <input type="color" value={form.titleColor} onChange={(event) => setForm({ ...form, titleColor: event.target.value })} />
          </label>
          <label>
            Schedule type
            <select
              value={form.type}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setNewScheduleTypeName("");
                  setIsCustomTypeDialogOpen(true);
                  return;
                }
                setForm({ ...form, type: event.target.value });
              }}
            >
              {scheduleTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="checkbox-row operations-checkbox-row">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(event) => setForm({ ...form, recurring: event.target.checked })}
            />
            Recurring
          </label>
          <label>
            Student
            <select value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
              <option value="">No specific student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{fullName(student)}</option>
              ))}
            </select>
          </label>
          <button type="submit">
            <Plus size={18} /> Add Schedule Event
          </button>
        </form>
      </div>
      )}
      {isCustomTypeDialogOpen && (
        <div className="modal-backdrop">
          <form
            aria-labelledby="create-schedule-type-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel"
            role="dialog"
            onSubmit={submitCustomScheduleType}
          >
            <div className="drawer-head">
              <div>
                <h2 id="create-schedule-type-title">Create schedule type</h2>
                <p>Name the new schedule type.</p>
              </div>
            </div>
            <label>
              New schedule type name
              <input
                autoFocus
                value={newScheduleTypeName}
                onChange={(event) => setNewScheduleTypeName(event.target.value)}
              />
            </label>
            <div className="button-row">
              <button type="submit">Submit</button>
              <button type="button" onClick={closeCustomTypeDialog}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

function MessagePreview({ message }: { message: MessageLog }) {
  return (
    <article className="message-preview">
      <div>
        <strong>{messageKindLabel(message.kind)}</strong>
        <span>{message.status}</span>
      </div>
      <p>{message.recipientName} · {message.recipientPhone}</p>
      <p>{message.body}</p>
    </article>
  );
}

type MessengerParticipant = {
  id: string;
  name: string;
  role: "staff" | "student" | "parent";
  subtitle: string;
  detail: string;
};

type MessengerFinderFilter = MessengerParticipant["role"];

const managerMessengerParticipant: MessengerParticipant = {
  id: "direct-staff-seed",
  name: "Cho's Manager",
  role: "staff",
  subtitle: "Studio staff",
  detail: "Manager account"
};

const staffMessengerParticipants: MessengerParticipant[] = [
  managerMessengerParticipant,
  {
    id: "direct-staff-instructors",
    name: "Instructor Team",
    role: "staff",
    subtitle: "Cho's staff",
    detail: "Class, testing, and floor support"
  }
];

function studentToMessengerParticipant(student: StudentRecord): MessengerParticipant {
  return {
    id: student.id,
    name: fullName(student),
    role: "student",
    subtitle: `${student.beltRank} belt`,
    detail: student.guardianPhone || student.phone || student.email
  };
}

function studentToParentMessengerParticipant(student: StudentRecord): MessengerParticipant {
  const studentName = fullName(student);
  const guardianName = student.guardianName?.trim() || `${studentName} Parent/Guardian`;
  return {
    id: `parent-${student.id}`,
    name: guardianName,
    role: "parent",
    subtitle: `Parent of ${studentName}`,
    detail: student.guardianPhone || student.guardianEmail || student.email || "No parent contact on file"
  };
}

function directMessageThreadId(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join("__");
}

function formatMessengerTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function DirectMessageBubble({ message, mine }: { message: DirectMessage; mine: boolean }) {
  return (
    <article className={`messenger-bubble${mine ? " mine" : ""}`}>
      <div>
        <strong>{message.senderName}</strong>
        <span>{formatMessengerTime(message.createdAt)}</span>
      </div>
      <p>{message.body}</p>
    </article>
  );
}

const messengerFinderFilters: { value: MessengerFinderFilter; label: string }[] = [
  { value: "staff", label: "Staff" },
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" }
];

function DirectMessengerPanel({
  className = "",
  title = "Direct Messenger",
  description = "Click any user name to open a private conversation and send a message instantly."
}: {
  className?: string;
  title?: string;
  description?: string;
}) {
  const { accountRole, students, directMessages, sendDirectMessage, showToast } = useAppState();
  const studentParticipants = useMemo(() => students.map(studentToMessengerParticipant), [students]);
  const parentParticipants = useMemo(() => students.map(studentToParentMessengerParticipant), [students]);
  const currentParticipant = accountRole === "student" && studentParticipants[0] ? studentParticipants[0] : managerMessengerParticipant;
  const messageContacts = useMemo(
    () => [...staffMessengerParticipants, ...studentParticipants, ...parentParticipants].filter((participant) => participant.id !== currentParticipant.id),
    [currentParticipant.id, parentParticipants, studentParticipants]
  );
  const [selectedParticipantId, setSelectedParticipantId] = useState(messageContacts[0]?.id ?? "");
  const [directMessageText, setDirectMessageText] = useState("");
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderFilter, setFinderFilter] = useState<MessengerFinderFilter>("student");
  const [finderQuery, setFinderQuery] = useState("");
  const selectedParticipant = messageContacts.find((participant) => participant.id === selectedParticipantId) ?? messageContacts[0];
  const selectedThreadId = selectedParticipant ? directMessageThreadId(currentParticipant.id, selectedParticipant.id) : "";
  const selectedConversationMessages = useMemo(
    () => directMessages.filter((message) => message.threadId === selectedThreadId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [directMessages, selectedThreadId]
  );
  const finderResults = useMemo(() => {
    const query = finderQuery.trim().toLowerCase();
    return messageContacts.filter((participant) => {
      if (participant.role !== finderFilter) return false;
      if (!query) return true;
      return `${participant.name} ${participant.subtitle} ${participant.detail}`.toLowerCase().includes(query);
    });
  }, [finderFilter, finderQuery, messageContacts]);

  useEffect(() => {
    if (!messageContacts.length) return;
    if (!messageContacts.some((participant) => participant.id === selectedParticipantId)) {
      setSelectedParticipantId(messageContacts[0].id);
    }
  }, [messageContacts, selectedParticipantId]);

  const sendDirect = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedParticipant) return;
    const sent = sendDirectMessage({
      senderId: currentParticipant.id,
      senderName: currentParticipant.name,
      recipientId: selectedParticipant.id,
      recipientName: selectedParticipant.name,
      body: directMessageText
    });
    if (!sent) {
      showToast("Type a message before sending.");
      return;
    }
    setDirectMessageText("");
    showToast(`Message sent to ${selectedParticipant.name}.`);
  };

  const openConversation = (participant: MessengerParticipant) => {
    setSelectedParticipantId(participant.id);
    setDirectMessageText("");
    setFinderOpen(false);
  };

  const panelClassName = ["operations-panel", "messenger-panel", className].filter(Boolean).join(" ");

  return (
    <section className={panelClassName} aria-label="Direct message center">
      <div className="student-roster-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="messenger-head-actions">
          <button type="button" className="operations-action secondary" onClick={() => setFinderOpen(true)}>
            <Search size={18} /> Find User
          </button>
          <span className="messenger-self-badge">Signed in as {currentParticipant.name}</span>
        </div>
      </div>
      <div className="messenger-shell">
        <aside className="messenger-people" aria-label="Message people">
          {messageContacts.map((participant) => {
            const threadId = directMessageThreadId(currentParticipant.id, participant.id);
            const latestMessage = directMessages.filter((message) => message.threadId === threadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            return (
              <button
                key={participant.id}
                type="button"
                className={`messenger-contact${selectedParticipant?.id === participant.id ? " active" : ""}`}
                aria-label={`Open conversation with ${participant.name}`}
                onClick={() => setSelectedParticipantId(participant.id)}
              >
                <div>
                  <strong>{participant.name}</strong>
                  <small>{participant.subtitle}</small>
                  <p>{latestMessage?.body ?? participant.detail}</p>
                </div>
              </button>
            );
          })}
        </aside>
        <section className="messenger-chat" aria-label={selectedParticipant ? `Conversation with ${selectedParticipant.name}` : "Conversation"}>
          {selectedParticipant ? (
            <>
              <header>
                <div>
                  <h2>{selectedParticipant.name}</h2>
                  <p>{selectedParticipant.subtitle}</p>
                </div>
              </header>
              <div className="messenger-thread" aria-live="polite">
                {selectedConversationMessages.length ? (
                  selectedConversationMessages.map((message) => (
                    <DirectMessageBubble key={message.id} message={message} mine={message.senderId === currentParticipant.id} />
                  ))
                ) : (
                  <p className="messenger-empty">No messages yet. Start the conversation with {selectedParticipant.name}.</p>
                )}
              </div>
              <form className="messenger-composer" onSubmit={sendDirect}>
                <label>
                  Message {selectedParticipant.name}
                  <textarea rows={3} value={directMessageText} onChange={(event) => setDirectMessageText(event.target.value)} />
                </label>
                <button type="submit" className="operations-action">
                  <MessagesSquare size={18} /> Send Message
                </button>
              </form>
            </>
          ) : (
            <p className="messenger-empty">Add students to start direct messaging.</p>
          )}
        </section>
      </div>
      {finderOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setFinderOpen(false)}>
          <section
            aria-labelledby="messenger-finder-title"
            aria-modal="true"
            className="modal-card messenger-finder-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="messenger-finder-title">Find User</h2>
                <p>Search by category, then click a name to open that message thread.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close find user" onClick={() => setFinderOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="messenger-finder-tabs" role="group" aria-label="User categories">
              {messengerFinderFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={finderFilter === filter.value}
                  className={finderFilter === filter.value ? "active" : ""}
                  onClick={() => {
                    setFinderFilter(filter.value);
                    setFinderQuery("");
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <label className="messenger-finder-search">
              Search users
              <input value={finderQuery} onChange={(event) => setFinderQuery(event.target.value)} placeholder="Type a name, role, phone, or email" />
            </label>
            <div className="messenger-finder-results">
              {finderResults.length ? (
                finderResults.map((participant) => (
                  <button
                    key={participant.id}
                    type="button"
                    className="messenger-finder-result"
                    aria-label={`Open conversation with ${participant.name}`}
                    onClick={() => openConversation(participant)}
                  >
                    <div>
                      <strong>{participant.name}</strong>
                      <small>{participant.subtitle}</small>
                      <p>{participant.detail}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="messenger-empty">No users found in this category.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function MessagesPage() {
  const { students, messageCampaigns, messageLogs, sendMarketingBlast, sendMissedClassFollowUps, showToast } = useAppState();
  const [marketingMessage, setMarketingMessage] = useState("Monthly special: 10% off gloves and uniforms this week.");
  const missedCount = students.filter((student) => student.missedClassCount >= 3).length;

  const sendFollowUps = () => {
    const count = sendMissedClassFollowUps();
    showToast(count ? `${count} missed-class follow-up text${count === 1 ? "" : "s"} queued.` : "No missed-class follow-ups needed.");
  };

  const sendMarketing = (event: FormEvent) => {
    event.preventDefault();
    const count = sendMarketingBlast(marketingMessage);
    showToast(count ? `Marketing blast queued for ${count} student${count === 1 ? "" : "s"}.` : "Enter a marketing message.");
  };

  return (
    <OperationsPage title="Message Settings" text="Manage mass messages, missed-class text follow-ups, message logs, and other message tools.">
      <section className="operations-panel message-settings-panel">
        <h2>Messenger Settings</h2>
        <p>All one-to-one app messenger conversations now stay inside the Home Page messenger container. Use this Manager&apos;s Page tool for message settings, mass texts, text logs, and other messaging operations.</p>
        <Link className="operations-action secondary" to="/">
          <MessageCircle size={18} /> Open Home Page Messages
        </Link>
      </section>
      <div className="operations-two-column">
        <section className="operations-panel">
          <h2>Follow-Up Automation</h2>
          <p>{missedCount} student{missedCount === 1 ? "" : "s"} currently missed 3 classes or more.</p>
          <button type="button" className="operations-action" onClick={sendFollowUps}>
            <Mail size={18} /> Send Missed-Class Follow-Ups
          </button>
        </section>
        <form className="operations-form-panel" onSubmit={sendMarketing}>
          <h2>Marketing Tool</h2>
          <label>
            Marketing message
            <textarea rows={4} value={marketingMessage} onChange={(event) => setMarketingMessage(event.target.value)} />
          </label>
          <button type="submit">
            <Mail size={18} /> Send Marketing Blast
          </button>
          {messageCampaigns[0] && <p className="operations-note">Latest campaign: {messageCampaigns[0].title}</p>}
        </form>
      </div>
      <section className="operations-panel">
        <h2>Text Log</h2>
        <div className="message-log-grid">
          {messageLogs.map((message) => <MessagePreview key={message.id} message={message} />)}
        </div>
      </section>
    </OperationsPage>
  );
}

function CheckInsPage() {
  const { accountRole, students, checkIns, recordStudentCheckIn, showToast } = useAppState();
  const firstStudentId = students[0]?.id ?? "";
  const [selectedStudentId, setSelectedStudentId] = useState(firstStudentId);
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0];
  const isStudentMode = accountRole === "student";
  const latestStudentCheckIn = selectedStudent ? checkIns.find((checkIn) => checkIn.studentId === selectedStudent.id) : undefined;
  const studentAfterCheckIn = selectedStudent ? students.find((student) => student.id === selectedStudent.id) : undefined;

  const checkIn = () => {
    if (!selectedStudent) return;
    const created = recordStudentCheckIn(selectedStudent.id);
    if (created) {
      showToast(`${created.studentName} checked in.`);
    }
  };

  return (
    <OperationsPage title={isStudentMode ? "Student Check-In" : "Check-Ins"} text="Students can sign in, track belt progress, and reset missed-class follow-up status.">
      <div className="operations-two-column">
        <section className="operations-panel checkin-panel">
          {!isStudentMode && (
            <label>
              Student
              <select value={selectedStudent?.id ?? ""} onChange={(event) => setSelectedStudentId(event.target.value)}>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{fullName(student)}</option>
                ))}
              </select>
            </label>
          )}
          {selectedStudent && (
            <>
              <div className="student-rank-card">
                <Award size={32} />
                <div>
                  <p>Current rank</p>
                  <h2>{selectedStudent.beltRank} Belt</h2>
                </div>
              </div>
              <p>Classes attended: {studentAfterCheckIn?.classesAttended ?? selectedStudent.classesAttended}</p>
              <p>Missed classes: {studentAfterCheckIn?.missedClassCount ?? selectedStudent.missedClassCount}</p>
              <button type="button" className="operations-action" onClick={checkIn}>
                <CheckCircle2 size={18} /> Check In Today
              </button>
              {latestStudentCheckIn && <p className="operations-success">Checked in today: {latestStudentCheckIn.date}</p>}
            </>
          )}
        </section>
        <section className="operations-panel">
          <h2>Recent Check-Ins</h2>
          <div className="operations-list compact">
            {checkIns.length ? checkIns.map((checkIn) => (
              <article className="operations-list-card" key={checkIn.id}>
                <strong>{checkIn.studentName}</strong>
                <p>{checkIn.date} · {checkIn.beltRank} Belt</p>
              </article>
            )) : <p>No check-ins recorded yet.</p>}
          </div>
        </section>
      </div>
    </OperationsPage>
  );
}

function EventCard({ event }: { event: StudioEvent }) {
  return (
    <article className="workflow-directory-row workflow-directory-row--event">
      <span className="workflow-directory-icon workflow-directory-icon--event" aria-hidden="true" />
      <span className="workflow-directory-name">
        {event.title}
        <small>{event.details}</small>
      </span>
      <span className="workflow-directory-cell">{event.date}</span>
      <span className="workflow-directory-cell">{event.time}</span>
      <span className="workflow-directory-cell">{audienceLabel(event.audience)}</span>
    </article>
  );
}

function EventsPage() {
  const { accountRole, studioEvents, addStudioEvent, showToast } = useAppState();
  const [form, setForm] = useState({ title: "", date: "2026-06-01", time: "6:00 PM", details: "", audience: "students" as StudioEvent["audience"] });
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const isStudent = accountRole === "student";
  const eventGroups = useMemo(
    () => Array.from(new Set(studioEvents.map((event) => event.audience)))
      .sort((left, right) => audienceLabel(left).localeCompare(audienceLabel(right), undefined, { sensitivity: "base" }))
      .map((audience) => ({
        audience,
        label: audienceLabel(audience),
        items: studioEvents.filter((event) => event.audience === audience)
      })),
    [studioEvents]
  );

  const openEventModal = () => {
    setEventModalOpen(true);
  };

  const closeEventModal = () => {
    setEventModalOpen(false);
    setForm({ title: "", date: form.date, time: form.time, details: "", audience: "students" });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const created = addStudioEvent(form);
    if (!created) {
      showToast("Enter event title, date, and time.");
      return;
    }
    setForm({ title: "", date: form.date, time: form.time, details: "", audience: "students" });
    setEventModalOpen(false);
    showToast(`${created.title} added to events.`);
  };

  return (
    <OperationsPage
      className="operations-page--workflow"
      title="Events"
      text="Keep students up to date on testing dates, movie night, and special studio events."
      action={!isStudent && (
        <button type="button" className="operations-action student-header-add" onClick={openEventModal}>
          <Plus size={18} /> Add Event
        </button>
      )}
    >
      <section className="operations-panel workflow-directory-panel">
        <div className="student-roster-head">
          <div>
            <h2>Studio Event Board</h2>
            <p>{studioEvents.length} event{studioEvents.length === 1 ? "" : "s"} grouped by audience.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Event directory">
          {eventGroups.map((group) => (
            <section key={group.audience} className={`workflow-directory-group workflow-directory-group--${slugClassName(group.label)}`} role="group" aria-label={`${group.label} events`}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{group.label}</h3>
                </div>
                <span>{group.items.length} event{group.items.length === 1 ? "" : "s"}</span>
              </div>
              <div className="workflow-directory-list workflow-directory-list--events">
                <div className="workflow-directory-list-head" aria-hidden="true">
                  <span aria-hidden="true" />
                  <span className="workflow-directory-column-label">Event</span>
                  <span className="workflow-directory-column-label">Date</span>
                  <span className="workflow-directory-column-label">Time</span>
                  <span className="workflow-directory-column-label">Audience</span>
                </div>
                {group.items.map((event) => <EventCard key={event.id} event={event} />)}
              </div>
            </section>
          ))}
        </div>
      </section>
      {eventModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeEventModal()}>
          <form
            aria-labelledby="event-modal-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel student-modal-card workflow-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="event-modal-title">Add Event</h2>
                <p>Create a studio event for students, families, or staff.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close event editor" onClick={closeEventModal}>
                <X size={18} />
              </button>
            </div>
            <label>
              Event title
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label>
              Event date
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </label>
            <label>
              Event time
              <input value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
            </label>
            <label>
              Event details
              <textarea rows={4} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} />
            </label>
            <button type="submit">
              <Plus size={18} /> Add Event
            </button>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

const emptyMerchandiseForm = {
  name: "",
  category: "Gloves",
  price: "39",
  stock: "6",
  description: "",
  imageDataUrl: ""
};

function merchandiseItemToForm(item: MerchandiseItem) {
  return {
    name: item.name,
    category: item.category,
    price: String(item.price),
    stock: String(item.stock),
    description: item.description,
    imageDataUrl: item.imageDataUrl ?? ""
  };
}

function MerchandiseCard({ item, onEdit }: { item: MerchandiseItem; onEdit: (item: MerchandiseItem) => void }) {
  return (
    <button type="button" className="workflow-directory-row workflow-directory-row--button workflow-directory-row--merchandise" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}>
      <span className="workflow-directory-product-image">
        {item.imageDataUrl ? <img src={item.imageDataUrl} alt={item.name} /> : <ShoppingCart aria-hidden="true" size={24} />}
      </span>
      <span className="workflow-directory-name">
        {item.name}
        <small>{item.description}</small>
      </span>
      <span className="workflow-directory-cell">{formatMoney(item.price)}</span>
      <span className="workflow-directory-cell">{item.stock} in stock</span>
    </button>
  );
}

function MerchandisePage() {
  const { merchandiseItems, addMerchandiseItem, updateMerchandiseItem, deleteMerchandiseItem, showToast } = useAppState();
  const [form, setForm] = useState(emptyMerchandiseForm);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedMerchandiseId, setSelectedMerchandiseId] = useState("");
  const selectedMerchandise = merchandiseItems.find((item) => item.id === selectedMerchandiseId);
  const inventoryValue = useMemo(() => merchandiseItems.reduce((sum, item) => sum + item.price * item.stock, 0), [merchandiseItems]);
  const merchandiseGroups = useMemo(
    () => Array.from(new Set(merchandiseItems.map((item) => item.category)))
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .map((category) => ({
        category,
        items: merchandiseItems.filter((item) => item.category === category).sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))
      })),
    [merchandiseItems]
  );

  const closeMerchandiseModal = () => {
    setModalMode(null);
    setSelectedMerchandiseId("");
    setForm(emptyMerchandiseForm);
  };

  const openCreateMerchandise = () => {
    setSelectedMerchandiseId("");
    setForm(emptyMerchandiseForm);
    setModalMode("create");
  };

  const openEditMerchandise = (item: MerchandiseItem) => {
    setSelectedMerchandiseId(item.id);
    setForm(merchandiseItemToForm(item));
    setModalMode("edit");
  };

  const handleImageUpload = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, imageDataUrl: typeof reader.result === "string" ? reader.result : "" }));
    };
    reader.readAsDataURL(file);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock),
      description: form.description,
      imageDataUrl: form.imageDataUrl || undefined
    };
    const saved = selectedMerchandise && modalMode === "edit"
      ? updateMerchandiseItem(selectedMerchandise.id, payload)
      : addMerchandiseItem(payload);
    if (!saved) {
      showToast("Enter product name, category, price, and stock.");
      return;
    }
    closeMerchandiseModal();
    showToast(`${saved.name} saved to merchandise.`);
  };

  const deleteSelectedMerchandise = () => {
    if (!selectedMerchandise) return;
    const deleted = deleteMerchandiseItem(selectedMerchandise.id);
    if (!deleted) return;
    closeMerchandiseModal();
    showToast(`${deleted.name} removed from merchandise.`);
  };

  const modalTitle = modalMode === "edit" && selectedMerchandise ? `Edit ${selectedMerchandise.name}` : "Add New Merchandise";

  return (
    <OperationsPage
      className="operations-page--workflow"
      title="Merchandise"
      text="Upload and browse gloves, uniforms, sparring equipment, and Cho's apparel."
      action={
        <button type="button" className="operations-action student-header-add" onClick={openCreateMerchandise}>
          <Plus size={18} /> Add New Merchandise
        </button>
      }
    >
      <div className="operations-stats">
        <StatCard label="Products" value={merchandiseItems.length} icon={<Package />} />
        <StatCard label="Inventory value" value={formatMoney(inventoryValue)} icon={<Target />} />
      </div>
      <div className="operations-single-column">
        <section className="operations-panel merchandise-manager-panel workflow-directory-panel">
          <h2>Product List</h2>
          <div className="workflow-directory-grid" aria-label="Product directory">
            {merchandiseGroups.map((group) => (
              <section key={group.category} className={`workflow-directory-group workflow-directory-group--${slugClassName(group.category)}`} role="group" aria-label={`${group.category} merchandise`}>
                <div className="workflow-directory-group-head">
                  <div>
                    <span className="workflow-directory-swatch" aria-hidden="true" />
                    <h3>{group.category}</h3>
                  </div>
                  <span>{group.items.length} product{group.items.length === 1 ? "" : "s"}</span>
                </div>
                <div className="workflow-directory-list workflow-directory-list--merchandise">
                  <div className="workflow-directory-list-head" aria-hidden="true">
                    <span aria-hidden="true" />
                    <span className="workflow-directory-column-label">Product</span>
                    <span className="workflow-directory-column-label">Price</span>
                    <span className="workflow-directory-column-label">Stock</span>
                  </div>
                  {group.items.map((item) => (
                    <MerchandiseCard key={item.id} item={item} onEdit={openEditMerchandise} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
      {modalMode && (
        <div className="modal-backdrop" role="presentation" onClick={closeMerchandiseModal}>
          <form
            aria-labelledby="merchandise-modal-title"
            aria-modal="true"
            className="modal-card operations-form-panel student-modal-card merchandise-modal-card"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="merchandise-modal-title">{modalTitle}</h2>
                <p>Manage the item details, inventory count, and display image shown in the merchandise shop.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close merchandise editor" onClick={closeMerchandiseModal}>
                <X size={18} />
              </button>
            </div>
            <section className="student-form-section">
              <h3>Product Details</h3>
              <div className="student-form-grid">
                <label>
                  Product name
                  <input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </label>
                <label>
                  Category
                  <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
                </label>
                <label>
                  Price
                  <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
                </label>
                <label>
                  Stock
                  <input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
                </label>
                <label className="student-form-wide">
                  Description
                  <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
              </div>
            </section>
            <section className="student-form-section">
              <h3>Product Image</h3>
              <div className="merchandise-upload-grid">
                <label className="merchandise-image-upload">
                  Product image
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                </label>
                <div className="merchandise-image-preview">
                  {form.imageDataUrl ? <img src={form.imageDataUrl} alt="Uploaded merchandise preview" /> : <span>No product image uploaded.</span>}
                </div>
              </div>
            </section>
            <div className="student-editor-actions">
              <button type="submit">
                <CheckCircle2 size={18} /> {modalMode === "edit" ? "Save Merchandise Changes" : "Create Merchandise"}
              </button>
              {modalMode === "edit" && (
                <button type="button" className="student-delete-action" onClick={deleteSelectedMerchandise}>
                  <Trash2 size={18} /> Delete Merchandise
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

export function OperationsApp() {
  return (
    <OperationsShell>
      <Routes>
        <Route path="/" element={<ManagerHomePage />} />
        <Route path="/manager" element={<ManagerLauncherPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/check-ins" element={<CheckInsPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/merchandise" element={<MerchandisePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OperationsShell>
  );
}
