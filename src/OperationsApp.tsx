import {
  Award,
  BarChart3,
  BookOpen,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderPlus,
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
  Upload,
  Users,
  Video,
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
import type { ChildAccount, ClassWeekday, MerchandiseItem, MessageLog, ScheduledClass, StudioClass, StudyGuideFolder, StudyGuideMaterial, StudentRecord, StudioEvent, TrainingVideo, TrainingVideoFolder } from "./types";
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

type ManagerLauncherIconKind = "dashboard" | "messages" | "students" | "classes" | "studyGuide" | "events" | "scheduling" | "merchandise" | "videos" | "reports" | "study" | "test";

type ManagerLauncherItem = {
  label: string;
  icon: ManagerLauncherIconKind;
  future?: boolean;
};

const managerLauncherItems: ManagerLauncherItem[] = [
  { label: "Dashboard", icon: "dashboard" },
  { label: "Messages", icon: "messages" },
  { label: "Students", icon: "students" },
  { label: "Classes", icon: "classes" },
  { label: "Study Guide", icon: "studyGuide" },
  { label: "Events", icon: "events" },
  { label: "Scheduling", icon: "scheduling" },
  { label: "Merchandise", icon: "merchandise" },
  { label: "Videos", icon: "videos" },
  { label: "Reports", icon: "reports", future: true }
];

const studentLauncherItems: ManagerLauncherItem[] = [
  { label: "Dashboard", icon: "dashboard" },
  { label: "Classes", icon: "classes" },
  { label: "Study", icon: "study" },
  { label: "Test", icon: "test" },
  { label: "Videos", icon: "videos" }
];

const managerLauncherIconImages: Partial<Record<ManagerLauncherIconKind, string>> = {
  dashboard: dashboardLauncherIcon,
  messages: messagesLauncherIcon,
  students: studentsLauncherIcon,
  classes: classesLauncherIcon,
  events: eventsLauncherIcon,
  scheduling: schedulingLauncherIcon,
  merchandise: merchandiseLauncherIcon,
  reports: reportsLauncherIcon,
  study: reportsLauncherIcon,
  test: eventsLauncherIcon
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

const legacyProfileStorageKey = "chos.profile.v1";

function profileStorageKey(scope: "manager" | "student", sessionEmail?: string) {
  const keyEmail = (sessionEmail ?? `${scope}@chos.prototype`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return `chos.profile.${scope}.${keyEmail || "account"}.v1`;
}

function normalizeStoredProfile(saved: string | null, fallback: ManagerProfileSettings) {
  if (!saved) return undefined;
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
}

function readProfileStorage(key: string, fallback: ManagerProfileSettings) {
  if (typeof window === "undefined") return undefined;
  try {
    return normalizeStoredProfile(window.localStorage.getItem(key), fallback);
  } catch {
    return undefined;
  }
}

function storedProfileBelongsToSession(profile: ManagerProfileSettings | undefined, sessionEmail?: string) {
  return Boolean(profile && sessionEmail && profile.email.trim().toLowerCase() === sessionEmail.trim().toLowerCase());
}

function writeProfileStorage(key: string, profile: ManagerProfileSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(profile));
  } catch {
    // Profile changes still update local React state when storage is blocked.
  }
}

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
  return readProfileStorage(profileStorageKey("manager", sessionEmail), fallback) ?? readProfileStorage(legacyProfileStorageKey, fallback) ?? fallback;
}

function writeManagerProfile(profile: ManagerProfileSettings, sessionEmail?: string) {
  writeProfileStorage(profileStorageKey("manager", sessionEmail ?? profile.email), profile);
  writeProfileStorage(legacyProfileStorageKey, profile);
}

function fallbackStudentProfile(sessionEmail?: string, student?: StudentRecord): ManagerProfileSettings {
  const email = sessionEmail ?? student?.email ?? "student@chos.prototype";
  const studentName = student ? fullName(student) : "";
  const fallbackName = studentName || "Cho's Student";
  const usernameSource = fallbackName === "Cho's Student" ? email.split("@")[0] : fallbackName;
  const username = usernameSource.replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "chos-student";

  return {
    name: fallbackName,
    username,
    email,
    phone: student?.phone ?? "(262) 555-0100",
    updates: true,
    theme: readStoredAppTheme()
  };
}

function readStudentProfile(sessionEmail?: string, student?: StudentRecord): ManagerProfileSettings {
  const fallback = fallbackStudentProfile(sessionEmail, student);
  const scopedProfile = readProfileStorage(profileStorageKey("student", sessionEmail), fallback);
  if (scopedProfile) return scopedProfile;
  const legacyProfile = readProfileStorage(legacyProfileStorageKey, fallback);
  return legacyProfile && storedProfileBelongsToSession(legacyProfile, sessionEmail) ? legacyProfile : fallback;
}

function writeStudentProfile(profile: ManagerProfileSettings, sessionEmail?: string) {
  writeProfileStorage(profileStorageKey("student", sessionEmail ?? profile.email), profile);
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

  if (!launcherIconImage) {
    const LauncherSymbol = icon === "studyGuide" ? BookOpen : Video;

    return (
      <span className={frameClassName} aria-hidden="true">
        <LauncherSymbol className={`manager-launcher-symbol manager-launcher-symbol--${icon}`} />
      </span>
    );
  }

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

function getSelectedStudentLauncherItem(search: string) {
  const requestedTool = new URLSearchParams(search).get("tool");
  return studentLauncherItems.find((item) => item.icon === requestedTool) ?? studentLauncherItems[0];
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
    case "studyGuide":
      return <ManagerStudyGuidePage />;
    case "events":
      return <EventsPage />;
    case "scheduling":
      return <SchedulePage />;
    case "merchandise":
      return <MerchandisePage />;
    case "videos":
      return <ManagerVideosPage />;
    case "reports":
      return <ReportsPage />;
    default:
      return <DashboardPage />;
  }
}

function StudentPanelDashboardPage() {
  const { scheduledClasses, students, studioEvents } = useAppState();
  const selectedStudent = students[0];
  const nextScheduledClass = scheduledClasses.find((item) => !item.studentId || item.studentId === selectedStudent?.id) ?? scheduledClasses[0];
  const nextEvent = studioEvents[0];
  const studentName = selectedStudent ? fullName(selectedStudent) : "Cho's Student";

  return (
    <OperationsPage className="operations-page--workflow" title="Dashboard" text="Student overview, upcoming class reminders, and account shortcuts.">
      <div className="operations-stats">
        <StatCard label="Student" value={studentName} icon={<Users />} />
        <StatCard label="Rank" value={selectedStudent?.beltRank ?? "White"} icon={<Award />} />
        <StatCard label="Classes attended" value={selectedStudent?.classesAttended ?? 0} icon={<CheckCircle2 />} />
      </div>
      <section className="operations-panel workflow-directory-panel" aria-label="Student dashboard summary">
        <div className="student-roster-head">
          <div>
            <h2>Today</h2>
            <p>Quick student account details for the current training week.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Student dashboard cards">
          <article className="workflow-directory-group">
            <div className="workflow-directory-group-head">
              <div>
                <span className="workflow-directory-swatch" aria-hidden="true" />
                <h3>Next Class</h3>
              </div>
              <span>{nextScheduledClass?.date ?? "No date"}</span>
            </div>
            <p>{nextScheduledClass ? `${nextScheduledClass.title} at ${nextScheduledClass.time}` : "No class is scheduled yet."}</p>
          </article>
          <article className="workflow-directory-group">
            <div className="workflow-directory-group-head">
              <div>
                <span className="workflow-directory-swatch" aria-hidden="true" />
                <h3>Next Event</h3>
              </div>
              <span>{nextEvent?.date ?? "No date"}</span>
            </div>
            <p>{nextEvent ? `${nextEvent.title} at ${nextEvent.time}` : "No event notification is available yet."}</p>
          </article>
        </div>
      </section>
    </OperationsPage>
  );
}

function StudentPanelClassesPage() {
  const { studioClasses } = useAppState();

  return (
    <OperationsPage className="operations-page--workflow" title="Classes" text="Review current Cho's class options and weekly training times.">
      <section className="operations-panel workflow-directory-panel" aria-label="Student class list">
        <div className="student-roster-head">
          <div>
            <h2>Class Schedule</h2>
            <p>Active class groups shown as student-facing schedule information.</p>
          </div>
          <span>{studioClasses.length} class{studioClasses.length === 1 ? "" : "es"}</span>
        </div>
        <div className="workflow-directory-grid" aria-label="Student classes">
          {studioClasses.map((studioClass) => (
            <article className="workflow-directory-group" key={studioClass.id}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{studioClass.name}</h3>
                </div>
                <span>{formatClassTimeRange(studioClass)}</span>
              </div>
              <p>{formatClassDays(studioClass.daysOfWeek)}</p>
              {studioClass.notes && <p>{studioClass.notes}</p>}
            </article>
          ))}
        </div>
      </section>
    </OperationsPage>
  );
}

function StudentStudyPage() {
  const { studyGuideFolders, studyGuideMaterials } = useAppState();
  const studyItems = [
    { title: "Forms", detail: "Practice beginner forms with clean stances, eyes forward, and steady breathing." },
    { title: "Kicks", detail: "Review front kick, round kick, and side kick control before class." },
    { title: "Respect", detail: "Prepare bow-in etiquette, listening posture, and class focus goals." }
  ];

  return (
    <OperationsPage className="operations-page--workflow" title="Study" text="Student practice reminders for at-home martial arts review.">
      <StudyGuideLibrarySection
        ariaLabel="Student study guide materials"
        emptyText="No manager study materials have been published yet."
        folders={studyGuideFolders}
        materials={studyGuideMaterials}
        title="Study Materials"
      />
      <section className="operations-panel workflow-directory-panel" aria-label="Student study guide">
        <div className="student-roster-head">
          <div>
            <h2>Practice Guide</h2>
            <p>Simple study cards for skills students can review before the next class.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Study cards">
          {studyItems.map((item) => (
            <article className="workflow-directory-group" key={item.title}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{item.title}</h3>
                </div>
                <span>Study</span>
              </div>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </OperationsPage>
  );
}

function StudentTestPage() {
  const testItems = [
    { title: "Attendance", detail: "Stay consistent with classes before the next belt evaluation." },
    { title: "Readiness", detail: "Ask an instructor to confirm forms, kicks, and focus before testing." },
    { title: "Event Prep", detail: "Watch event notifications for color belt testing dates and arrival details." }
  ];

  return (
    <OperationsPage className="operations-page--workflow" title="Test" text="Testing readiness reminders and next-step preparation for students.">
      <section className="operations-panel workflow-directory-panel" aria-label="Student test readiness">
        <div className="student-roster-head">
          <div>
            <h2>Testing Checklist</h2>
            <p>Key readiness points before a student signs up for belt testing.</p>
          </div>
        </div>
        <div className="workflow-directory-grid" aria-label="Testing checklist cards">
          {testItems.map((item) => (
            <article className="workflow-directory-group" key={item.title}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{item.title}</h3>
                </div>
                <span>Test</span>
              </div>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </OperationsPage>
  );
}

function formatStudyMaterialSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "Study file";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatStudyGuideFolderOption(folder: StudyGuideFolder, folders: StudyGuideFolder[]) {
  const parentFolder = folder.parentId ? folders.find((candidate) => candidate.id === folder.parentId) : undefined;
  return parentFolder ? `${parentFolder.name} / ${folder.name}` : folder.name;
}

function StudyGuideLibrarySection({
  ariaLabel,
  emptyText,
  folders,
  materials,
  title
}: {
  ariaLabel: string;
  emptyText: string;
  folders: StudyGuideFolder[];
  materials: StudyGuideMaterial[];
  title: string;
}) {
  const folderGroups = folders.map((folder) => ({
    folder,
    materials: materials.filter((material) => material.folderId === folder.id),
    parentFolder: folder.parentId ? folders.find((candidate) => candidate.id === folder.parentId) : undefined
  }));
  const unfiledMaterials = materials.filter((material) => !folders.some((folder) => folder.id === material.folderId));

  return (
    <section className="operations-panel workflow-directory-panel study-guide-library-panel" aria-label={ariaLabel}>
      <div className="student-roster-head">
        <div>
          <h2>{title}</h2>
          <p>{materials.length} study material{materials.length === 1 ? "" : "s"} published for students.</p>
        </div>
      </div>
      {folders.length || materials.length ? (
        <div className="workflow-directory-grid study-guide-library-grid" aria-label={`${title} folders`}>
          {folderGroups.map(({ folder, materials: folderMaterials, parentFolder }) => (
            <section className="workflow-directory-group study-guide-folder-card" key={folder.id} role="group" aria-label={`${folder.name} study guide folder`}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{folder.name}</h3>
                </div>
                <span>{folderMaterials.length} file{folderMaterials.length === 1 ? "" : "s"}</span>
              </div>
              <p className="study-guide-folder-subject">{folder.subject}</p>
              {parentFolder && <p className="study-guide-folder-path">Inside {parentFolder.name}</p>}
              {folder.description && <p>{folder.description}</p>}
              {folderMaterials.length ? (
                <div className="study-material-list">
                  {folderMaterials.map((material) => (
                    <article className="study-material-card" key={material.id}>
                      <span className="study-material-file-icon" aria-hidden="true">
                        <FileText />
                      </span>
                      <div className="study-material-details">
                        <h4>{material.title}</h4>
                        {material.description && <p>{material.description}</p>}
                        <span>{material.fileName} · {formatStudyMaterialSize(material.size)}</span>
                      </div>
                      <a className="study-material-download" href={material.fileDataUrl} download={material.fileName}>
                        Open {material.title}
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="study-guide-empty-note">No materials in this folder yet.</p>
              )}
            </section>
          ))}
          {unfiledMaterials.length > 0 && (
            <section className="workflow-directory-group study-guide-folder-card" role="group" aria-label="Unfiled study guide folder">
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>Unfiled</h3>
                </div>
                <span>{unfiledMaterials.length} file{unfiledMaterials.length === 1 ? "" : "s"}</span>
              </div>
              <div className="study-material-list">
                {unfiledMaterials.map((material) => (
                  <article className="study-material-card" key={material.id}>
                    <span className="study-material-file-icon" aria-hidden="true">
                      <FileText />
                    </span>
                    <div className="study-material-details">
                      <h4>{material.title}</h4>
                      {material.description && <p>{material.description}</p>}
                      <span>{material.fileName} · {formatStudyMaterialSize(material.size)}</span>
                    </div>
                    <a className="study-material-download" href={material.fileDataUrl} download={material.fileName}>
                      Open {material.title}
                    </a>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <p className="study-guide-empty-note">{emptyText}</p>
      )}
    </section>
  );
}

function ManagerStudyGuidePage() {
  const { addStudyGuideFolder, addStudyGuideMaterial, showToast, studyGuideFolders, studyGuideMaterials } = useAppState();
  const [folderForm, setFolderForm] = useState({ name: "", subject: "", parentId: "", description: "" });
  const [materialForm, setMaterialForm] = useState({
    title: "",
    folderId: studyGuideFolders[0]?.id ?? "",
    description: "",
    fileName: "",
    mimeType: "",
    size: 0,
    fileDataUrl: ""
  });

  useEffect(() => {
    if (!studyGuideFolders.length) return;
    setMaterialForm((current) => (
      studyGuideFolders.some((folder) => folder.id === current.folderId)
        ? current
        : { ...current, folderId: studyGuideFolders[0].id }
    ));
  }, [studyGuideFolders]);

  const createStudyFolder = (event: FormEvent) => {
    event.preventDefault();
    const savedFolder = addStudyGuideFolder(folderForm);
    if (!savedFolder) {
      showToast("Enter a study folder name, subject, and valid parent folder.");
      return;
    }
    setFolderForm({ name: "", subject: "", parentId: "", description: "" });
    setMaterialForm((current) => ({ ...current, folderId: savedFolder.id }));
    showToast(`${savedFolder.name} study folder created.`);
  };

  const handleStudyMaterialUpload = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const fileDataUrl = typeof reader.result === "string" ? reader.result : "";
      setMaterialForm((current) => ({
        ...current,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        fileDataUrl
      }));
    };
    reader.readAsDataURL(file);
  };

  const publishStudyMaterial = (event: FormEvent) => {
    event.preventDefault();
    const savedMaterial = addStudyGuideMaterial(materialForm);
    if (!savedMaterial) {
      showToast("Create a folder, add a title, and choose a study material file before publishing.");
      return;
    }
    setMaterialForm((current) => ({
      title: "",
      folderId: current.folderId,
      description: "",
      fileName: "",
      mimeType: "",
      size: 0,
      fileDataUrl: ""
    }));
    showToast(`${savedMaterial.title} published to student study materials.`);
  };

  return (
    <OperationsPage className="operations-page--workflow" title="Study Guide" text="Create student study folders and publish downloadable training materials.">
      <div className="operations-stats">
        <StatCard label="Folders" value={studyGuideFolders.length} icon={<FolderPlus />} />
        <StatCard label="Materials" value={studyGuideMaterials.length} icon={<FileText />} />
      </div>
      <div className="operations-two-column study-guide-manager-layout">
        <section className="operations-panel study-guide-manager-panel" aria-label="Manager study guide tools">
          <div className="student-roster-head">
            <div>
              <h2>Study Upload Center</h2>
              <p>Create top-level folders or subfolders, then publish study files into the selected folder.</p>
            </div>
          </div>
          <form className="study-guide-tool-form" aria-label="Create study folder" onSubmit={createStudyFolder}>
            <h3>New Folder</h3>
            <label>
              Folder name
              <input value={folderForm.name} onChange={(event) => setFolderForm({ ...folderForm, name: event.target.value })} />
            </label>
            <label>
              Folder subject
              <input value={folderForm.subject} onChange={(event) => setFolderForm({ ...folderForm, subject: event.target.value })} />
            </label>
            <label>
              Parent folder
              <select value={folderForm.parentId} onChange={(event) => setFolderForm({ ...folderForm, parentId: event.target.value })}>
                <option value="">Top-level folder</option>
                {studyGuideFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>{formatStudyGuideFolderOption(folder, studyGuideFolders)}</option>
                ))}
              </select>
            </label>
            <label>
              Folder description
              <textarea rows={2} value={folderForm.description} onChange={(event) => setFolderForm({ ...folderForm, description: event.target.value })} />
            </label>
            <button type="submit" className="operations-action student-header-add">
              <FolderPlus size={18} /> Create Folder
            </button>
          </form>
          <form className="study-guide-tool-form" aria-label="Upload study material" onSubmit={publishStudyMaterial}>
            <h3>Publish Material</h3>
            <label>
              Material title
              <input value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} />
            </label>
            <label>
              Material folder
              <select value={materialForm.folderId} disabled={!studyGuideFolders.length} onChange={(event) => setMaterialForm({ ...materialForm, folderId: event.target.value })}>
                {studyGuideFolders.length ? (
                  studyGuideFolders.map((folder) => <option key={folder.id} value={folder.id}>{formatStudyGuideFolderOption(folder, studyGuideFolders)}</option>)
                ) : (
                  <option value="">Create a folder first</option>
                )}
              </select>
            </label>
            <label>
              Material description
              <textarea rows={3} value={materialForm.description} onChange={(event) => setMaterialForm({ ...materialForm, description: event.target.value })} />
            </label>
            <label className="study-material-file-upload">
              Upload study material file
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                aria-label="Upload study material file"
                onChange={handleStudyMaterialUpload}
              />
            </label>
            <p className="study-material-upload-ready">{materialForm.fileName ? `${materialForm.fileName} ready to publish.` : "No study material selected yet."}</p>
            <button type="submit" className="operations-action student-header-add">
              <Upload size={18} /> Publish Study Material
            </button>
          </form>
        </section>
        <StudyGuideLibrarySection
          ariaLabel="Manager study guide library"
          emptyText="Create a folder and upload the first study material for students."
          folders={studyGuideFolders}
          materials={studyGuideMaterials}
          title="Student Study Library"
        />
      </div>
    </OperationsPage>
  );
}

function formatVideoFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "Video file";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function VideoLibrarySection({
  ariaLabel,
  emptyText,
  folders,
  title,
  videos
}: {
  ariaLabel: string;
  emptyText: string;
  folders: TrainingVideoFolder[];
  title: string;
  videos: TrainingVideo[];
}) {
  const folderGroups = folders.map((folder) => ({
    folder,
    videos: videos.filter((video) => video.folderId === folder.id)
  }));
  const unfiledVideos = videos.filter((video) => !folders.some((folder) => folder.id === video.folderId));

  return (
    <section className="operations-panel workflow-directory-panel videos-library-panel" aria-label={ariaLabel}>
      <div className="student-roster-head">
        <div>
          <h2>{title}</h2>
          <p>{videos.length} video{videos.length === 1 ? "" : "s"} published for students.</p>
        </div>
      </div>
      {folders.length || videos.length ? (
        <div className="workflow-directory-grid videos-library-grid" aria-label={`${title} folders`}>
          {folderGroups.map(({ folder, videos: folderVideos }) => (
            <section className="workflow-directory-group videos-folder-card" key={folder.id} role="group" aria-label={`${folder.name} video folder`}>
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>{folder.name}</h3>
                </div>
                <span>{folderVideos.length} video{folderVideos.length === 1 ? "" : "s"}</span>
              </div>
              <p className="videos-folder-subject">{folder.subject}</p>
              {folder.description && <p>{folder.description}</p>}
              {folderVideos.length ? (
                <div className="training-video-list">
                  {folderVideos.map((video) => (
                    <article className="training-video-card" key={video.id}>
                      <video className="training-video-player" title={`${video.title} video player`} src={video.videoDataUrl} controls preload="metadata" />
                      <div>
                        <h4>{video.title}</h4>
                        {video.description && <p>{video.description}</p>}
                        <span>{video.fileName} · {formatVideoFileSize(video.size)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="videos-empty-note">No videos in this folder yet.</p>
              )}
            </section>
          ))}
          {unfiledVideos.length > 0 && (
            <section className="workflow-directory-group videos-folder-card" role="group" aria-label="Unfiled video folder">
              <div className="workflow-directory-group-head">
                <div>
                  <span className="workflow-directory-swatch" aria-hidden="true" />
                  <h3>Unfiled</h3>
                </div>
                <span>{unfiledVideos.length} video{unfiledVideos.length === 1 ? "" : "s"}</span>
              </div>
              <div className="training-video-list">
                {unfiledVideos.map((video) => (
                  <article className="training-video-card" key={video.id}>
                    <video className="training-video-player" title={`${video.title} video player`} src={video.videoDataUrl} controls preload="metadata" />
                    <div>
                      <h4>{video.title}</h4>
                      {video.description && <p>{video.description}</p>}
                      <span>{video.fileName} · {formatVideoFileSize(video.size)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <p className="videos-empty-note">{emptyText}</p>
      )}
    </section>
  );
}

function ManagerVideosPage() {
  const { addTrainingVideo, addTrainingVideoFolder, showToast, trainingVideoFolders, trainingVideos } = useAppState();
  const [folderForm, setFolderForm] = useState({ name: "", subject: "", description: "" });
  const [videoForm, setVideoForm] = useState({
    title: "",
    folderId: trainingVideoFolders[0]?.id ?? "",
    description: "",
    fileName: "",
    mimeType: "",
    size: 0,
    videoDataUrl: ""
  });

  useEffect(() => {
    if (!trainingVideoFolders.length) return;
    setVideoForm((current) => (
      trainingVideoFolders.some((folder) => folder.id === current.folderId)
        ? current
        : { ...current, folderId: trainingVideoFolders[0].id }
    ));
  }, [trainingVideoFolders]);

  const createFolder = (event: FormEvent) => {
    event.preventDefault();
    const savedFolder = addTrainingVideoFolder(folderForm);
    if (!savedFolder) {
      showToast("Enter a video folder name and subject.");
      return;
    }
    setFolderForm({ name: "", subject: "", description: "" });
    setVideoForm((current) => ({ ...current, folderId: savedFolder.id }));
    showToast(`${savedFolder.name} video folder created.`);
  };

  const handleVideoUpload = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const videoDataUrl = typeof reader.result === "string" ? reader.result : "";
      setVideoForm((current) => ({
        ...current,
        fileName: file.name,
        mimeType: file.type || "video/mp4",
        size: file.size,
        videoDataUrl
      }));
    };
    reader.readAsDataURL(file);
  };

  const publishVideo = (event: FormEvent) => {
    event.preventDefault();
    const savedVideo = addTrainingVideo(videoForm);
    if (!savedVideo) {
      showToast("Create a folder, add a title, and choose a video file before publishing.");
      return;
    }
    setVideoForm((current) => ({
      title: "",
      folderId: current.folderId,
      description: "",
      fileName: "",
      mimeType: "",
      size: 0,
      videoDataUrl: ""
    }));
    showToast(`${savedVideo.title} published to student videos.`);
  };

  return (
    <OperationsPage className="operations-page--workflow" title="Videos" text="Upload student training videos and organize them into subject folders.">
      <div className="operations-stats">
        <StatCard label="Folders" value={trainingVideoFolders.length} icon={<FolderPlus />} />
        <StatCard label="Videos" value={trainingVideos.length} icon={<Video />} />
      </div>
      <div className="operations-two-column videos-manager-layout">
        <section className="operations-panel videos-manager-panel" aria-label="Manager video upload tools">
          <div className="student-roster-head">
            <div>
              <h2>Upload Center</h2>
              <p>Create folders first, then publish videos into the selected student subject folder.</p>
            </div>
          </div>
          <form className="video-tool-form" aria-label="Create video folder" onSubmit={createFolder}>
            <h3>New Folder</h3>
            <label>
              Folder name
              <input value={folderForm.name} onChange={(event) => setFolderForm({ ...folderForm, name: event.target.value })} />
            </label>
            <label>
              Folder subject
              <input value={folderForm.subject} onChange={(event) => setFolderForm({ ...folderForm, subject: event.target.value })} />
            </label>
            <label>
              Folder description
              <textarea rows={2} value={folderForm.description} onChange={(event) => setFolderForm({ ...folderForm, description: event.target.value })} />
            </label>
            <button type="submit" className="operations-action student-header-add">
              <FolderPlus size={18} /> Create Folder
            </button>
          </form>
          <form className="video-tool-form" aria-label="Upload student video" onSubmit={publishVideo}>
            <h3>Publish Video</h3>
            <label>
              Video title
              <input value={videoForm.title} onChange={(event) => setVideoForm({ ...videoForm, title: event.target.value })} />
            </label>
            <label>
              Video folder
              <select value={videoForm.folderId} disabled={!trainingVideoFolders.length} onChange={(event) => setVideoForm({ ...videoForm, folderId: event.target.value })}>
                {trainingVideoFolders.length ? (
                  trainingVideoFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)
                ) : (
                  <option value="">Create a folder first</option>
                )}
              </select>
            </label>
            <label>
              Video description
              <textarea rows={3} value={videoForm.description} onChange={(event) => setVideoForm({ ...videoForm, description: event.target.value })} />
            </label>
            <label className="video-file-upload">
              Upload video file
              <input type="file" accept="video/*" aria-label="Upload video file" onChange={handleVideoUpload} />
            </label>
            <p className="video-upload-ready">{videoForm.fileName ? `${videoForm.fileName} ready to publish.` : "No video selected yet."}</p>
            <button type="submit" className="operations-action student-header-add">
              <Upload size={18} /> Publish Video
            </button>
          </form>
        </section>
        <VideoLibrarySection
          ariaLabel="Manager video library"
          emptyText="Create a folder and upload the first training video for students."
          folders={trainingVideoFolders}
          title="Student Video Library"
          videos={trainingVideos}
        />
      </div>
    </OperationsPage>
  );
}

function StudentVideosPage() {
  const { trainingVideoFolders, trainingVideos } = useAppState();

  return (
    <OperationsPage className="operations-page--workflow" title="Videos" text="Watch training videos published by Cho's managers.">
      <VideoLibrarySection
        ariaLabel="Student video library"
        emptyText="No training videos have been published yet."
        folders={trainingVideoFolders}
        title="Videos"
        videos={trainingVideos}
      />
    </OperationsPage>
  );
}

function StudentLauncherWorkspace({ tool }: { tool: ManagerLauncherIconKind }) {
  switch (tool) {
    case "classes":
      return <StudentPanelClassesPage />;
    case "study":
      return <StudentStudyPage />;
    case "test":
      return <StudentTestPage />;
    case "videos":
      return <StudentVideosPage />;
    case "dashboard":
    default:
      return <StudentPanelDashboardPage />;
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

type ManagerComposeKind = ManagerHomeThread["kind"];
type ManagerComposeRecipientRole = "staff" | "student" | "parent";

type ManagerComposeRecipient = {
  id: string;
  name: string;
  role: ManagerComposeRecipientRole;
  subtitle: string;
  detail: string;
};

type ManagerComposeRecipientSummaryItem = {
  id: string;
  label: string;
  detail: string;
  variant: "category" | "person";
};

const managerComposeRecipientRoles: ManagerComposeRecipientRole[] = ["staff", "student", "parent"];

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
    accent: "#ff7a1a"
  }
];

const studentHomeThreads: ManagerHomeThread[] = [
  {
    id: "student-testing-event",
    kind: "event",
    sender: "Event Team",
    title: "Upcoming Event: Color Belt Testing",
    preview: "Testing registration and arrival details are ready...",
    sentDate: "May 15, 2026",
    sentTime: "10:30 AM",
    sentDateTime: "2026-05-15T10:30:00-05:00",
    avatar: eventsLauncherIcon,
    accent: "#ff7a1a",
    unread: true
  },
  {
    id: "student-practice-reminder",
    kind: "message",
    sender: "Head Coach",
    title: "Practice Session Reminder",
    preview: "Bring your belt card and review your form before class...",
    sentDate: "May 15, 2026",
    sentTime: "9:15 AM",
    sentDateTime: "2026-05-15T09:15:00-05:00",
    avatar: classesLauncherIcon,
    accent: "#7be4ff",
    unread: true
  },
  {
    id: "student-attendance",
    kind: "message",
    sender: "Front Desk",
    title: "Attendance Confirmation",
    preview: "Your next class reservation is confirmed...",
    sentDate: "May 15, 2026",
    sentTime: "8:45 AM",
    sentDateTime: "2026-05-15T08:45:00-05:00",
    avatar: studentsLauncherIcon,
    accent: "#8a78ff"
  },
  {
    id: "student-merch",
    kind: "message",
    sender: "Merch Store",
    title: "New Student Gear Available",
    preview: "Uniforms, gloves, and training gear are ready for pickup...",
    sentDate: "May 14, 2026",
    sentTime: "4:20 PM",
    sentDateTime: "2026-05-14T16:20:00-05:00",
    avatar: merchandiseLauncherIcon,
    accent: "#7bdcff"
  },
  {
    id: "student-account",
    kind: "message",
    sender: "System Admin",
    title: "Account Security Update",
    preview: "Your student profile settings were reviewed...",
    sentDate: "May 14, 2026",
    sentTime: "11:05 AM",
    sentDateTime: "2026-05-14T11:05:00-05:00",
    avatar: studentsLauncherIcon,
    accent: "#67d8ff"
  },
  {
    id: "student-parent-meeting",
    kind: "event",
    sender: "Event Team",
    title: "Upcoming Event: Parent Meeting",
    preview: "Families are invited to review summer training details...",
    sentDate: "May 13, 2026",
    sentTime: "2:45 PM",
    sentDateTime: "2026-05-13T14:45:00-05:00",
    avatar: schedulingLauncherIcon,
    accent: "#ff7a1a"
  }
];

type ParentProfileTab = "dashboard" | "classes" | "study" | "test" | "messages" | "notifications";

const parentProfileTabs: { id: ParentProfileTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "classes", label: "Classes" },
  { id: "study", label: "Study" },
  { id: "test", label: "Test" },
  { id: "messages", label: "Messages" },
  { id: "notifications", label: "Notifications" }
];

const parentStudyItems = [
  { title: "Forms at home", detail: "Review the current form slowly, then let the child perform it once without coaching." },
  { title: "Class focus", detail: "Ask what the instructor corrected last class and write one practice goal before the next visit." },
  { title: "Confidence routine", detail: "Use a short bow-in, stance check, and breathing reset for young students before training." }
];

const parentTestingItems = [
  { title: "Class consistency", detail: "Watch attendance and missed classes before signing up for a belt test." },
  { title: "Instructor approval", detail: "Ask Cho's staff to confirm forms, kicks, attitude, and focus before the testing event." },
  { title: "Family logistics", detail: "Check arrival time, uniform, belt card, water, and event notifications before test day." }
];

function childBeltLabel(beltSlug: string) {
  const normalizedSlug = beltSlug.toLowerCase().replace(/\s+/g, "-");
  return beltOptions.find((belt) => belt.toLowerCase().replace(/\s+/g, "-") === normalizedSlug) ?? `${beltSlug.slice(0, 1).toUpperCase()}${beltSlug.slice(1)}`;
}

function childInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "C") + (parts[1]?.[0] ?? "");
}

const managerComposeStaffRecipients: ManagerComposeRecipient[] = [
  {
    id: "direct-staff-instructors",
    name: "Instructor Team",
    role: "staff",
    subtitle: "Cho's staff",
    detail: "Class, testing, and floor support"
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

function studentToComposeRecipient(student: StudentRecord): ManagerComposeRecipient {
  return {
    id: student.id,
    name: fullName(student),
    role: "student",
    subtitle: `${student.beltRank} belt student`,
    detail: student.phone || student.email || "No student contact on file"
  };
}

function studentToParentComposeRecipient(student: StudentRecord): ManagerComposeRecipient {
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

function composeRecipientRoleLabel(role: ManagerComposeRecipientRole) {
  if (role === "staff") return "Staff";
  if (role === "parent") return "Parent";
  return "Student";
}

function composeRecipientGroupTitle(role: ManagerComposeRecipientRole) {
  if (role === "staff") return "Staff";
  if (role === "parent") return "Parents";
  return "Students";
}

function composeRecipientGroupDescription(role: ManagerComposeRecipientRole) {
  if (role === "staff") return "Studio team and instructors";
  if (role === "parent") return "Guardian and family contacts";
  return "Student member contacts";
}

function composeMessagePreview(body: string) {
  const cleanBody = body.replace(/\s+/g, " ").trim();
  if (cleanBody.length <= 78) return cleanBody;
  return `${cleanBody.slice(0, 75).trimEnd()}...`;
}

function formatManagerComposeTimestamp(date: Date) {
  return {
    sentDate: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    sentTime: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    sentDateTime: date.toISOString()
  };
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

function StudentProfilePage() {
  const { logout, scheduledClasses, session, showToast, studioClasses, studioEvents, students } = useAppState();
  const today = useLiveCalendarDate();
  const selectedStudent = useMemo(() => {
    const sessionEmail = session?.email.toLowerCase();
    return (
      (sessionEmail ? students.find((student) => student.email.toLowerCase() === sessionEmail) : undefined) ??
      students.find((student) => (student.status ?? "Active").toLowerCase() === "active") ??
      students[0]
    );
  }, [session?.email, students]);
  const [studentProfile, setStudentProfile] = useState(() => readStudentProfile(session?.email, selectedStudent));
  const [studentProfileOpen, setStudentProfileOpen] = useState(false);
  const [homeScheduleWeekStartKey, setHomeScheduleWeekStartKey] = useState(() => toDateKey(weekDaysForDate(today)[0]));
  const [selectedHomeScheduleDateKey, setSelectedHomeScheduleDateKey] = useState(() => toDateKey(today));
  const [feedThreads, setFeedThreads] = useState(() => studentHomeThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
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
  const studentName = studentProfile.name || (selectedStudent ? fullName(selectedStudent) : "Cho's Student");
  const studentRoleLabel = `${selectedStudent?.program ?? "Cho's Martial Arts"} Student`;
  const memberSinceLabel = formatMonthYear(selectedStudent?.joinedAt ?? session?.createdAt);
  const studentPortrait = studentProfile.photoDataUrl ?? (selectedStudent?.profileImagePath ? publicAsset(selectedStudent.profileImagePath) : publicAsset("assets/CheetahProfilePic/Cheetah.png"));

  useEffect(() => {
    setStudentProfile(readStudentProfile(session?.email, selectedStudent));
  }, [selectedStudent, session?.email]);

  useEffect(() => {
    const defaultDateKey = findInitialHomeAgendaDate(today, scheduledClasses, studioClasses, studioEvents);
    const defaultWeekStart = weekDaysForDate(parseCalendarDate(defaultDateKey))[0];
    setHomeScheduleWeekStartKey(toDateKey(defaultWeekStart));
    setSelectedHomeScheduleDateKey(defaultDateKey);
  }, [scheduledClasses, studioClasses, studioEvents, today]);

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

  const changeStudentProfilePhoto = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file for the student profile picture.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        showToast("Could not read that profile image.");
        return;
      }

      setStudentProfile((currentProfile) => {
        const nextProfile = { ...currentProfile, photoDataUrl: result };
        writeStudentProfile(nextProfile, session?.email);
        return nextProfile;
      });
      showToast("Student profile picture updated.");
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

  const changeFeedFilter = (nextFilter: ManagerHomeThread["kind"]) => {
    const resolvedFilter: ManagerHomeFeedFilter = feedFilter === nextFilter ? "all" : nextFilter;
    setFeedFilter(resolvedFilter);
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

  const closeFeedSearch = () => {
    setSearchQuery("");
    setIsFeedSearchOpen(false);
  };

  const handleFeedSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") closeFeedSearch();
  };

  const toggleStudentHomeTheme = () => {
    const nextTheme: AppThemeMode = studentProfile.theme === "dark" ? "light" : "dark";
    setStudentProfile((currentProfile) => {
      const nextProfile = { ...currentProfile, theme: nextTheme };
      writeStudentProfile(nextProfile, session?.email);
      return nextProfile;
    });
    applyAppTheme(nextTheme);
    writeStoredAppTheme(nextTheme);
  };

  const saveStudentProfileSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateEmail(studentProfile.email)) {
      showToast("Enter a valid profile email.");
      return;
    }
    writeStudentProfile(studentProfile, session?.email);
    applyAppTheme(studentProfile.theme);
    writeStoredAppTheme(studentProfile.theme);
    setStudentProfileOpen(false);
    showToast("Student profile settings saved.");
  };

  const sendReply = () => {
    if (!replyText.trim()) {
      showToast("Write a reply before sending.");
      return;
    }
    showToast("Reply queued for Cho's staff.");
    setReplyText("");
  };

  return (
    <section className="manager-home-page student-profile-page" aria-label="Student profile page">
      <header className="manager-home-profile-title manager-page-title-bar" aria-label="Student profile page header">
        <ManagerPageTitleFrame title="Profile" className="manager-home-profile-title-frame" />
        <nav className="manager-home-top-actions" aria-label="Student profile quick actions">
          <Link className="manager-home-top-action student-profile-panel-link" to="/manager" aria-label="Student's Panel">
            <img className="manager-home-panel-icon" src={managerPageIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">Student's Panel</span>
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
          <section className="manager-home-overview student-profile-overview" aria-label="Student profile overview section" ref={overviewContentRef}>
            <article className="manager-home-profile-card" aria-label="Student profile overview">
              <button className="manager-home-profile-settings-link" type="button" aria-label="Profile Settings" onClick={() => setStudentProfileOpen(true)}>
                <img className="manager-home-profile-settings-icon" src={managerProfileSettingsIcon} alt="" draggable="false" />
              </button>
              <button
                aria-checked={studentProfile.theme === "dark"}
                aria-label={studentProfile.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className={`manager-home-profile-theme-toggle manager-home-profile-theme-toggle--${studentProfile.theme}`}
                onClick={toggleStudentHomeTheme}
                role="switch"
                type="button"
              >
                <span className="manager-home-profile-theme-icons" aria-hidden="true">
                  <Sun size={15} />
                  <Moon size={15} />
                </span>
                <span className="manager-home-profile-theme-thumb" aria-hidden="true">
                  {studentProfile.theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
                </span>
              </button>
              <label className="manager-home-profile-frame manager-home-profile-upload">
                <span className="sr-only">Upload student profile picture</span>
                <input type="file" accept="image/*" aria-label="Upload student profile picture" onChange={changeStudentProfilePhoto} />
                <img src={studentPortrait} alt={`${studentName} profile portrait`} draggable="false" />
                <span className="manager-home-profile-change-badge" aria-hidden="true">
                  <Camera size={15} />
                </span>
              </label>
              <div className="manager-home-profile-copy">
                <h2>{studentName}</h2>
                <p>{studentRoleLabel}</p>
              </div>
              <dl className="manager-home-profile-facts">
                <div>
                  <dt><Award size={20} /></dt>
                  <dd>Rank: {selectedStudent?.beltRank ?? "Green"} Belt</dd>
                </div>
                <div>
                  <dt><Target size={20} /></dt>
                  <dd>Member Since: {memberSinceLabel}</dd>
                </div>
                <div>
                  <dt><Users size={20} /></dt>
                  <dd>Classes: {selectedStudent?.classesAttended ?? 24} Attended</dd>
                </div>
              </dl>
            </article>
            <section className="manager-home-week-card" aria-label="Student month schedule">
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
          aria-label={isOverviewCollapsed ? "Expand student overview" : "Collapse student overview"}
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
        <section className="manager-home-feed-panel student-profile-feed-panel" aria-label="Messages and event notifications">
          <div className="manager-home-feed-head">
            <div className="manager-home-feed-counts" aria-label="Feed totals">
              <button
                className={`manager-home-count manager-home-count--message${feedFilter === "message" ? " is-active" : ""}`}
                type="button"
                aria-pressed={feedFilter === "message"}
                aria-controls="student-profile-unified-feed"
                onClick={() => changeFeedFilter("message")}
              >
                {messageCount} {messageCount === 1 ? "Message" : "Messages"}
              </button>
              <button
                className={`manager-home-count manager-home-count--event${feedFilter === "event" ? " is-active" : ""}`}
                type="button"
                aria-pressed={feedFilter === "event"}
                aria-controls="student-profile-unified-feed"
                onClick={() => changeFeedFilter("event")}
              >
                {eventCount} Event {eventCount === 1 ? "Notification" : "Notifications"}
              </button>
            </div>
          </div>
          <div className={`manager-home-search-shell${isFeedSearchOpen ? " is-open" : ""}`}>
            {isFeedSearchOpen ? (
              <div className="manager-home-search" role="search">
                <Search size={22} aria-hidden="true" />
                <label className="sr-only" htmlFor="student-profile-feed-search">Search messages and event notifications</label>
                <input
                  aria-label="Search messages and event notifications"
                  id="student-profile-feed-search"
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
                aria-controls="student-profile-feed-search"
                aria-expanded="false"
                onClick={() => setIsFeedSearchOpen(true)}
              >
                <Search size={24} />
              </button>
            )}
          </div>
          <div className="manager-home-unified-feed" id="student-profile-unified-feed" aria-label="Student message and notification feed">
            {visibleFeedSections.length ? (
              visibleFeedSections.map((section) => (
                <section className="manager-home-date-section" key={section.date} aria-label={`Messages and event notifications from ${section.date}`}>
                  <div className="manager-home-date-divider" role="separator" aria-label={`Messages and event notifications from ${section.date}`}>
                    <span>{section.date}</span>
                  </div>
                  {section.threads.map((thread) => {
                    const isSelected = thread.id === selectedThreadId;
                    const isUnread = Boolean(thread.unread);
                    const kindLabel = thread.kind === "event" ? "Event Notification" : "Message";
                    const readStatusLabel = isUnread ? "Unread" : "Read";

                    return (
                      <article className={`manager-home-feed-item manager-home-feed-item--${thread.kind}${isUnread ? " is-unread" : " is-read"}${isSelected ? " is-selected" : ""}`} key={thread.id}>
                        <div className="manager-home-feed-row student-profile-feed-row">
                          <button
                            className="manager-home-feed-button"
                            type="button"
                            aria-expanded={isSelected}
                            aria-controls={`student-profile-feed-detail-${thread.id}`}
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
                        </div>
                        {isSelected && (
                          <div className="manager-home-feed-detail" id={`student-profile-feed-detail-${thread.id}`} aria-label={`${thread.title} details`}>
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
                                <p>{thread.kind === "event" ? "event notice for students and families" : "message for your student profile"}</p>
                              </div>
                              <button type="button" aria-label="More message actions">
                                <MoreHorizontal size={20} />
                              </button>
                            </header>
                            <div className="manager-home-message-copy">
                              <p>Hello {studentName},</p>
                              <p>{thread.preview.replace("...", ".")} Please review this update before your next class.</p>
                            </div>
                            {thread.kind === "event" && (
                              <section className="manager-home-event-card" aria-label="Event details">
                                <h3>Event Details</h3>
                                <p><CalendarDays size={18} /> <span>Date: July 25 - July 27, 2026</span></p>
                                <p><MapPin size={18} /> <span>Location: Cho&apos;s Martial Arts</span></p>
                                <p><Users size={18} /> <span>Participants: Students and families</span></p>
                                <p><CheckCircle2 size={18} /> <span>Check-in Time: 8:00 AM</span></p>
                              </section>
                            )}
                            <p>{thread.kind === "event" ? "Arrive on time, bring your gear, and check in with the front desk." : "This message is saved to your Profile page for quick follow-up."}</p>
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
        {studentProfileOpen && (
          <div className="modal-backdrop manager-profile-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setStudentProfileOpen(false)}>
            <form className="modal-card manager-profile-modal" role="dialog" aria-modal="true" aria-label="Student profile settings" onSubmit={saveStudentProfileSettings}>
              <header className="student-modal-head">
                <div>
                  <h2>Profile Settings</h2>
                  <p>Edit student contact settings and app theme.</p>
                </div>
                <button className="student-modal-close" type="button" aria-label="Close student profile settings" onClick={() => setStudentProfileOpen(false)}>
                  <X size={20} />
                </button>
              </header>
              <section className="student-form-section manager-profile-form-section">
                <label className="field-label">
                  Name
                  <input
                    className="input"
                    value={studentProfile.name}
                    onChange={(event) => setStudentProfile({ ...studentProfile, name: event.target.value })}
                    placeholder="Cho's Student"
                  />
                </label>
                <label className="field-label">
                  Username
                  <input
                    className="input"
                    value={studentProfile.username}
                    onChange={(event) => setStudentProfile({ ...studentProfile, username: event.target.value })}
                    autoComplete="username"
                    placeholder="chos-student"
                  />
                </label>
                <label className="field-label">
                  Email
                  <input
                    className="input"
                    value={studentProfile.email}
                    onChange={(event) => setStudentProfile({ ...studentProfile, email: event.target.value })}
                    placeholder="student@chos.prototype"
                  />
                </label>
                <label className="field-label">
                  Phone
                  <input
                    className="input"
                    value={studentProfile.phone}
                    onChange={(event) => setStudentProfile({ ...studentProfile, phone: event.target.value })}
                    placeholder="(262) 555-0100"
                  />
                </label>
                <div className="manager-profile-preferences">
                  <div className="manager-theme-setting" role="group" aria-label="App theme">
                    <span>App Theme</span>
                    <div className="manager-theme-options">
                      <button
                        type="button"
                        className={`manager-theme-option${studentProfile.theme === "light" ? " is-active" : ""}`}
                        aria-pressed={studentProfile.theme === "light"}
                        onClick={() => setStudentProfile({ ...studentProfile, theme: "light" })}
                      >
                        <Sun size={16} /> Light
                      </button>
                      <button
                        type="button"
                        className={`manager-theme-option${studentProfile.theme === "dark" ? " is-active" : ""}`}
                        aria-pressed={studentProfile.theme === "dark"}
                        onClick={() => setStudentProfile({ ...studentProfile, theme: "dark" })}
                      >
                        <Moon size={16} /> Dark
                      </button>
                    </div>
                  </div>
                  <label className="manager-profile-check">
                    <input
                      type="checkbox"
                      checked={studentProfile.updates}
                      onChange={(event) => setStudentProfile({ ...studentProfile, updates: event.target.checked })}
                    />
                    <span>Receive class and event updates</span>
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
      </main>
    </section>
  );
}

function ParentProfileTabContent({
  activeTab,
  selectedChild,
  scheduledClasses,
  studioClasses,
  studioEvents
}: {
  activeTab: ParentProfileTab;
  selectedChild?: ChildAccount;
  scheduledClasses: ScheduledClass[];
  studioClasses: StudioClass[];
  studioEvents: StudioEvent[];
}) {
  const childName = selectedChild?.name ?? "your child";
  const nextClass = scheduledClasses.find((item) => !item.studentId) ?? scheduledClasses[0];
  const nextEvent = studioEvents[0];

  if (activeTab === "classes") {
    return (
      <section className="parent-tool-panel" aria-label="Parent classes view">
        <header>
          <h2>Classes</h2>
          <p>See the class options and weekly schedule before deciding where {childName} should train next.</p>
        </header>
        <div className="parent-class-grid">
          {studioClasses.map((studioClass) => (
            <article className="parent-class-card" key={studioClass.id}>
              <span className="parent-card-icon" aria-hidden="true"><CalendarDays size={20} /></span>
              <div>
                <h3>{studioClass.name}</h3>
                <p>{formatClassDays(studioClass.daysOfWeek)}</p>
                <strong>{formatClassTimeRange(studioClass)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === "study") {
    return (
      <section className="parent-tool-panel" aria-label="Parent study view">
        <header>
          <h2>Study</h2>
          <p>Parent-friendly practice prompts for helping younger students review at home.</p>
        </header>
        <div className="parent-card-list">
          {parentStudyItems.map((item) => (
            <article className="parent-guide-card" key={item.title}>
              <span className="parent-card-icon" aria-hidden="true"><Award size={20} /></span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === "test") {
    return (
      <section className="parent-tool-panel" aria-label="Parent test readiness view">
        <header>
          <h2>Test</h2>
          <p>Track what parents should confirm before a child is ready for belt testing.</p>
        </header>
        <div className="parent-card-list">
          {parentTestingItems.map((item) => (
            <article className="parent-guide-card" key={item.title}>
              <span className="parent-card-icon" aria-hidden="true"><Target size={20} /></span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === "messages") {
    const messages = studentHomeThreads.filter((thread) => thread.kind === "message");
    return (
      <section className="parent-tool-panel" aria-label="Parent messages view">
        <header>
          <h2>Messages</h2>
          <p>Review staff and studio messages connected to {childName}&apos;s account.</p>
        </header>
        <div className="parent-message-list">
          {messages.map((thread) => (
            <article className="parent-message-row" key={thread.id}>
              <img src={thread.avatar} alt="" draggable="false" />
              <div>
                <strong>{thread.title}</strong>
                <span>{thread.sender} - {thread.sentDate} at {thread.sentTime}</span>
                <p>{thread.preview}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === "notifications") {
    const eventThreads = studentHomeThreads.filter((thread) => thread.kind === "event");
    return (
      <section className="parent-tool-panel" aria-label="Parent notifications view">
        <header>
          <h2>Notifications</h2>
          <p>Event notices, parent reminders, and testing updates for the family.</p>
        </header>
        <div className="parent-message-list">
          {eventThreads.map((thread) => (
            <article className="parent-message-row" key={thread.id}>
              <img src={thread.avatar} alt="" draggable="false" />
              <div>
                <strong>{thread.title}</strong>
                <span>{thread.sender} - {thread.sentDate} at {thread.sentTime}</span>
                <p>{thread.preview}</p>
              </div>
            </article>
          ))}
          {studioEvents.slice(0, 3).map((event) => (
            <article className="parent-message-row" key={event.id}>
              <span className="parent-card-icon" aria-hidden="true"><CalendarDays size={20} /></span>
              <div>
                <strong>{event.title}</strong>
                <span>{event.date} at {event.time}</span>
                <p>{event.details}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="parent-tool-panel" aria-label="Parent dashboard view">
      <header>
        <h2>Dashboard</h2>
        <p>A quick view of {childName}&apos;s profile, next class, and family alerts.</p>
      </header>
      <div className="parent-dashboard-grid">
        <article>
          <span>Selected Student</span>
          <strong>{selectedChild?.name ?? "No child selected"}</strong>
          <p>{selectedChild ? `Age ${selectedChild.age || "not set"} - ${childBeltLabel(selectedChild.beltSlug)} Belt` : "Create a child profile to start tracking their student tools."}</p>
        </article>
        <article>
          <span>Next Class</span>
          <strong>{nextClass?.title ?? "No class scheduled"}</strong>
          <p>{nextClass ? `${nextClass.date} at ${nextClass.time}` : "Cho's staff can add schedule items from the manager panel."}</p>
        </article>
        <article>
          <span>Next Notification</span>
          <strong>{nextEvent?.title ?? "No event posted"}</strong>
          <p>{nextEvent ? `${nextEvent.date} at ${nextEvent.time}` : "No event notifications are currently queued."}</p>
        </article>
      </div>
    </section>
  );
}

function ParentChildProfileModal({
  form,
  mode,
  onChange,
  onClose,
  onSubmit
}: {
  form: { name: string; age: string; beltSlug: string };
  mode: "add" | "edit";
  onChange: (form: { name: string; age: string; beltSlug: string }) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const modalTitle = mode === "edit" ? "Edit Child Profile" : "Add Child Profile";

  return (
    <div className="modal-backdrop parent-profile-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal-card manager-profile-modal parent-child-modal" role="dialog" aria-modal="true" aria-label={modalTitle} onSubmit={onSubmit}>
        <header className="student-modal-head">
          <div>
            <h2>{modalTitle}</h2>
            <p>Keep each child profile clear for parent-supervised student access.</p>
          </div>
          <button className="student-modal-close" type="button" aria-label={`Close ${modalTitle}`} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <section className="student-form-section manager-profile-form-section">
          <label className="field-label">
            Child name
            <input className="input" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="Mina Cho" />
          </label>
          <label className="field-label">
            Child age
            <input className="input" inputMode="numeric" value={form.age} onChange={(event) => onChange({ ...form, age: event.target.value })} placeholder="8" />
          </label>
          <label className="field-label">
            Current belt
            <select className="input" value={form.beltSlug} onChange={(event) => onChange({ ...form, beltSlug: event.target.value })}>
              {beltOptions.map((belt) => (
                <option key={belt} value={belt.toLowerCase().replace(/\s+/g, "-")}>
                  {belt}
                </option>
              ))}
            </select>
          </label>
        </section>
        <div className="student-editor-actions manager-profile-actions">
          <button type="submit">
            <CheckCircle2 size={18} /> Save Child Profile
          </button>
        </div>
      </form>
    </div>
  );
}

function ParentProfilePage() {
  const { addChildAccount, guardianChildren, logout, scheduledClasses, showToast, studioClasses, studioEvents, updateChildAccount } = useAppState();
  const [activeTab, setActiveTab] = useState<ParentProfileTab>("dashboard");
  const [selectedChildId, setSelectedChildId] = useState(() => guardianChildren[0]?.id ?? "");
  const [childModalMode, setChildModalMode] = useState<"add" | "edit" | null>(null);
  const [editingChildId, setEditingChildId] = useState("");
  const [childForm, setChildForm] = useState({ name: "", age: "", beltSlug: "white" });
  const selectedChild = guardianChildren.find((child) => child.id === selectedChildId) ?? guardianChildren[0];
  const messageCount = studentHomeThreads.filter((thread) => thread.kind === "message").length;
  const notificationCount = studentHomeThreads.filter((thread) => thread.kind === "event").length + studioEvents.length;

  useEffect(() => {
    if (!guardianChildren.length) {
      setSelectedChildId("");
      return;
    }
    if (!guardianChildren.some((child) => child.id === selectedChildId)) {
      setSelectedChildId(guardianChildren[0].id);
    }
  }, [guardianChildren, selectedChildId]);

  const openAddChild = () => {
    setChildForm({ name: "", age: "", beltSlug: "white" });
    setEditingChildId("");
    setChildModalMode("add");
  };

  const openEditChild = (child: ChildAccount) => {
    setChildForm({ name: child.name, age: child.age, beltSlug: child.beltSlug });
    setEditingChildId(child.id);
    setChildModalMode("edit");
  };

  const closeChildModal = () => {
    setChildModalMode(null);
    setEditingChildId("");
  };

  const saveChildProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const savedChild = childModalMode === "edit" && editingChildId ? updateChildAccount(editingChildId, childForm) : addChildAccount(childForm);
    if (!savedChild) {
      showToast("Enter a child name.");
      return;
    }
    setSelectedChildId(savedChild.id);
    closeChildModal();
    showToast(`${savedChild.name} child profile saved.`);
  };

  return (
    <section className="manager-home-page parent-profile-page" aria-label="Parent profile page">
      <header className="manager-home-profile-title manager-page-title-bar" aria-label="Parent profile page header">
        <ManagerPageTitleFrame title="Parent Profile" className="manager-home-profile-title-frame" />
        <nav className="manager-home-top-actions" aria-label="Parent profile quick actions">
          <button className="manager-home-top-action parent-profile-add-action" type="button" aria-label="Add Child Profile" onClick={openAddChild}>
            <Plus size={28} aria-hidden="true" />
            <span className="manager-home-top-action-label">Add Child</span>
          </button>
          <button className="manager-home-top-action manager-home-logout-button" type="button" aria-label="Log Out" onClick={logout}>
            <img className="manager-home-logout-icon" src={managerLogoutIcon} alt="" draggable="false" />
            <span className="manager-home-top-action-label">Log Out</span>
          </button>
        </nav>
      </header>

      <main className="parent-profile-shell">
        <section className="parent-profile-overview" aria-label="Parent family overview">
          <article className="parent-family-card">
            <div>
              <p>Family Profile</p>
              <h2>Manage every child from one parent page.</h2>
              <span>Built for parents with younger students or multiple children in class.</span>
            </div>
            <div className="parent-family-stats" aria-label="Parent family totals">
              <span><strong>{guardianChildren.length}</strong> Child Profiles</span>
              <span><strong>{messageCount}</strong> Messages</span>
              <span><strong>{notificationCount}</strong> Notifications</span>
            </div>
          </article>

          <section className="parent-child-profiles" aria-label="Parent child profiles">
            <div className="parent-section-head">
              <div>
                <h2>Kids Profiles</h2>
                <p>Create, select, and edit each child before opening their student tools.</p>
              </div>
              <button type="button" onClick={openAddChild}>
                <Plus size={18} /> Add Child
              </button>
            </div>
            <div className="parent-child-list">
              {guardianChildren.length ? (
                guardianChildren.map((child) => {
                  const isSelected = child.id === selectedChild?.id;
                  return (
                    <article
                      aria-label={`${child.name} profile card`}
                      className={`parent-child-card${isSelected ? " is-selected" : ""}`}
                      key={child.id}
                      onClick={() => setSelectedChildId(child.id)}
                      role="group"
                    >
                      <button type="button" aria-label={`Select ${child.name} profile`} aria-pressed={isSelected} onClick={() => setSelectedChildId(child.id)}>
                        <span className="parent-child-avatar" aria-hidden="true">{childInitials(child.name)}</span>
                        <span>
                          <strong>{child.name}</strong>
                          <small>{child.age ? `Age ${child.age}` : "Age not set"} - {childBeltLabel(child.beltSlug)} Belt</small>
                        </span>
                      </button>
                      <button
                        className="parent-child-edit"
                        type="button"
                        aria-label={`Edit ${child.name} profile`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditChild(child);
                        }}
                      >
                        Edit
                      </button>
                    </article>
                  );
                })
              ) : (
                <p className="parent-empty-note">No child profiles yet. Add the first student profile to begin.</p>
              )}
            </div>
          </section>
        </section>

        <section className="parent-selected-student" aria-label="Selected child workspace">
          <div className="parent-selected-head">
            <div>
              <span className="parent-child-avatar parent-child-avatar--large" aria-hidden="true">{selectedChild ? childInitials(selectedChild.name) : "P"}</span>
              <div>
                <p>Selected Student</p>
                <h2>{selectedChild?.name ?? "No child selected"}</h2>
                <span>{selectedChild ? `${selectedChild.age ? `Age ${selectedChild.age}` : "Age not set"} - ${childBeltLabel(selectedChild.beltSlug)} Belt` : "Add a child profile to unlock student tools."}</span>
              </div>
            </div>
            {selectedChild && (
              <button type="button" onClick={() => openEditChild(selectedChild)}>
                Edit Profile
              </button>
            )}
          </div>

          <nav className="parent-tool-tabs" aria-label="Parent student tools">
            {parentProfileTabs.map((tab) => (
              <button className={activeTab === tab.id ? "is-active" : ""} key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </nav>

          <ParentProfileTabContent
            activeTab={activeTab}
            selectedChild={selectedChild}
            scheduledClasses={scheduledClasses}
            studioClasses={studioClasses}
            studioEvents={studioEvents}
          />
        </section>
      </main>

      {childModalMode && (
        <ParentChildProfileModal
          form={childForm}
          mode={childModalMode}
          onChange={setChildForm}
          onClose={closeChildModal}
          onSubmit={saveChildProfile}
        />
      )}
    </section>
  );
}

function ManagerHomePage() {
  const { addStudioEvent, logout, scheduledClasses, sendDirectMessage, session, showToast, studioClasses, studioEvents, students } = useAppState();
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
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeKind, setComposeKind] = useState<ManagerComposeKind>("message");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAllUsers, setComposeAllUsers] = useState(false);
  const [composeSelectedRecipientIds, setComposeSelectedRecipientIds] = useState<Set<string>>(() => new Set());
  const [isComposeContactsOpen, setIsComposeContactsOpen] = useState(false);
  const [collapsedComposeRecipientRoles, setCollapsedComposeRecipientRoles] = useState<Set<ManagerComposeRecipientRole>>(() => new Set());
  const [composeRecipientQuery, setComposeRecipientQuery] = useState("");
  const [composeEventDate, setComposeEventDate] = useState(() => toDateKey(today));
  const [composeEventTime, setComposeEventTime] = useState("6:00 PM");
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
  const composeRecipients = useMemo(
    () => [
      ...managerComposeStaffRecipients,
      ...students.map(studentToComposeRecipient),
      ...students.map(studentToParentComposeRecipient)
    ],
    [students]
  );
  const visibleComposeRecipients = useMemo(() => {
    const query = composeRecipientQuery.trim().toLowerCase();
    return composeRecipients.filter((recipient) => {
      if (!query) return true;
      return `${recipient.name} ${recipient.subtitle} ${recipient.detail}`.toLowerCase().includes(query);
    });
  }, [composeRecipientQuery, composeRecipients]);
  const composeRecipientGroups = useMemo(
    () => managerComposeRecipientRoles.map((role) => ({
      role,
      title: composeRecipientGroupTitle(role),
      description: composeRecipientGroupDescription(role),
      recipients: visibleComposeRecipients.filter((recipient) => recipient.role === role)
    })),
    [visibleComposeRecipients]
  );
  const selectedComposeRecipientCount = composeAllUsers ? composeRecipients.length : composeSelectedRecipientIds.size;
  const composeRecipientSummaryItems = useMemo<ManagerComposeRecipientSummaryItem[]>(() => {
    if (composeAllUsers) {
      return [{
        id: "all-users",
        label: "All Users",
        detail: `${composeRecipients.length} contacts`,
        variant: "category"
      }];
    }

    return managerComposeRecipientRoles.flatMap((role): ManagerComposeRecipientSummaryItem[] => {
      const roleRecipients = composeRecipients.filter((recipient) => recipient.role === role);
      const selectedRoleRecipients = roleRecipients.filter((recipient) => composeSelectedRecipientIds.has(recipient.id));
      if (!selectedRoleRecipients.length) return [];

      if (selectedRoleRecipients.length === roleRecipients.length) {
        return [{
          id: `all-${role}`,
          label: `All ${composeRecipientGroupTitle(role)}`,
          detail: `${roleRecipients.length} ${roleRecipients.length === 1 ? "contact" : "contacts"}`,
          variant: "category" as const
        }];
      }

      return selectedRoleRecipients.map((recipient): ManagerComposeRecipientSummaryItem => ({
        id: recipient.id,
        label: recipient.name,
        detail: composeRecipientRoleLabel(recipient.role),
        variant: "person"
      }));
    });
  }, [composeAllUsers, composeRecipients, composeSelectedRecipientIds]);
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
    if (!isComposeOpen) return;

    const closeComposeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isComposeContactsOpen) {
        setIsComposeContactsOpen(false);
        return;
      }
      if (event.key === "Escape") setIsComposeOpen(false);
    };

    window.addEventListener("keydown", closeComposeOnEscape);
    return () => window.removeEventListener("keydown", closeComposeOnEscape);
  }, [isComposeContactsOpen, isComposeOpen]);

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
        writeManagerProfile(nextProfile, session?.email);
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
      writeManagerProfile(nextProfile, session?.email);
      return nextProfile;
    });
    writeStoredAppTheme(nextTheme);
  };

  const resetComposeForm = () => {
    setComposeKind("message");
    setComposeSubject("");
    setComposeBody("");
    setComposeAllUsers(false);
    setComposeSelectedRecipientIds(new Set());
    setIsComposeContactsOpen(false);
    setCollapsedComposeRecipientRoles(new Set());
    setComposeRecipientQuery("");
    setComposeEventDate(toDateKey(today));
    setComposeEventTime("6:00 PM");
  };

  const closeComposeDialog = () => {
    setIsComposeOpen(false);
    resetComposeForm();
  };

  const toggleComposeRecipient = (recipientId: string) => {
    setComposeSelectedRecipientIds((currentIds) => {
      const nextIds = new Set(composeAllUsers ? [] : currentIds);
      if (nextIds.has(recipientId)) {
        nextIds.delete(recipientId);
      } else {
        nextIds.add(recipientId);
      }
      return nextIds;
    });
    setComposeAllUsers(false);
  };

  const selectComposeRecipientGroup = (recipients: ManagerComposeRecipient[]) => {
    if (!recipients.length) return;

    setComposeSelectedRecipientIds((currentIds) => {
      const nextIds = new Set(composeAllUsers ? [] : currentIds);
      recipients.forEach((recipient) => nextIds.add(recipient.id));
      return nextIds;
    });
    setComposeAllUsers(false);
  };

  const getComposeRecipientsByRole = (role: ManagerComposeRecipientRole) => composeRecipients.filter((recipient) => recipient.role === role);

  const isComposeRecipientRoleOnlySelected = (role: ManagerComposeRecipientRole) => {
    if (composeAllUsers) return false;

    const roleRecipientIds = getComposeRecipientsByRole(role).map((recipient) => recipient.id);
    return roleRecipientIds.length > 0
      && composeSelectedRecipientIds.size === roleRecipientIds.length
      && roleRecipientIds.every((recipientId) => composeSelectedRecipientIds.has(recipientId));
  };

  const clearComposeRecipients = () => {
    setComposeAllUsers(false);
    setComposeSelectedRecipientIds(new Set());
  };

  const quickToggleComposeAllUsers = () => {
    if (composeAllUsers) {
      clearComposeRecipients();
      return;
    }

    setComposeAllUsers(true);
    setComposeSelectedRecipientIds(new Set());
  };

  const quickToggleComposeRecipientRole = (role: ManagerComposeRecipientRole) => {
    const roleRecipients = getComposeRecipientsByRole(role);
    if (!roleRecipients.length) return;

    if (isComposeRecipientRoleOnlySelected(role)) {
      clearComposeRecipients();
      return;
    }

    setComposeAllUsers(false);
    setComposeSelectedRecipientIds(new Set(roleRecipients.map((recipient) => recipient.id)));
  };

  const toggleComposeRecipientGroup = (role: ManagerComposeRecipientRole) => {
    setCollapsedComposeRecipientRoles((currentRoles) => {
      const nextRoles = new Set(currentRoles);
      if (nextRoles.has(role)) {
        nextRoles.delete(role);
      } else {
        nextRoles.add(role);
      }
      return nextRoles;
    });
  };

  const sendCompose = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const subject = composeSubject.trim();
    const body = composeBody.trim();
    const recipients = composeAllUsers ? composeRecipients : composeRecipients.filter((recipient) => composeSelectedRecipientIds.has(recipient.id));

    if (!subject || !body) {
      showToast("Enter a subject and message body.");
      return;
    }

    if (!recipients.length) {
      showToast("Choose at least one recipient.");
      return;
    }

    if (composeKind === "event" && (!composeEventDate || !composeEventTime.trim())) {
      showToast("Choose an event date and time.");
      return;
    }

    const timestamp = new Date();
    const sent = formatManagerComposeTimestamp(timestamp);
    const createdThread: ManagerHomeThread = {
      id: `compose-${composeKind}-${timestamp.getTime()}`,
      kind: composeKind,
      sender: "Cho's Manager",
      title: subject,
      preview: composeMessagePreview(body),
      sentDate: sent.sentDate,
      sentTime: sent.sentTime,
      sentDateTime: sent.sentDateTime,
      avatar: composeKind === "event" ? eventsLauncherIcon : messagesLauncherIcon,
      accent: composeKind === "event" ? "#ff7a1a" : "#7be4ff"
    };

    if (composeKind === "message") {
      recipients.forEach((recipient) => {
        sendDirectMessage({
          senderId: "direct-staff-seed",
          senderName: "Cho's Manager",
          recipientId: recipient.id,
          recipientName: recipient.name,
          body: `${subject}\n\n${body}`
        });
      });
    } else {
      addStudioEvent({
        title: subject,
        date: composeEventDate,
        time: composeEventTime,
        details: body,
        audience: composeAllUsers ? "public" : "students"
      });
    }

    setFeedThreads((currentThreads) => [createdThread, ...currentThreads]);
    setSelectedThreadId(createdThread.id);
    setSelectedFeedThreadIds(new Set());
    setFeedFilter("all");
    setSearchQuery("");
    setIsFeedSearchOpen(false);
    setIsComposeOpen(false);
    resetComposeForm();
    showToast(composeAllUsers ? "Compose sent to all users." : `Compose sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`);
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
              <button className="manager-home-compose" type="button" aria-label="Compose" onClick={() => setIsComposeOpen(true)}>
                <span>Compose</span>
                <Plus size={16} />
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
        {isComposeOpen && (
          <div
            className="manager-compose-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeComposeDialog();
            }}
          >
            <form
              className="manager-compose-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="manager-compose-title"
              onSubmit={sendCompose}
            >
              <header className="manager-compose-head">
                <div>
                  <p>Manager message center</p>
                  <h2 id="manager-compose-title">Compose</h2>
                </div>
                <button className="manager-compose-close" type="button" aria-label="Close compose" onClick={closeComposeDialog}>
                  <X size={20} />
                </button>
              </header>

              <div className="manager-compose-mode" aria-label="Compose type">
                <label className={composeKind === "message" ? "is-selected" : undefined}>
                  <input
                    type="radio"
                    name="manager-compose-kind"
                    checked={composeKind === "message"}
                    onChange={() => setComposeKind("message")}
                  />
                  <span><Mail size={18} /> Contact Message</span>
                </label>
                <label className={composeKind === "event" ? "is-selected" : undefined}>
                  <input
                    type="radio"
                    name="manager-compose-kind"
                    checked={composeKind === "event"}
                    onChange={() => setComposeKind("event")}
                  />
                  <span><CalendarDays size={18} /> Event Notification</span>
                </label>
              </div>

              <div className="manager-compose-layout">
                <section className="manager-compose-message-card" aria-label="Compose message">
                  <label className="manager-compose-field">
                    <span>Subject</span>
                    <input
                      aria-label="Subject"
                      value={composeSubject}
                      onChange={(event) => setComposeSubject(event.target.value)}
                      placeholder={composeKind === "event" ? "Event notice title" : "Message subject"}
                    />
                  </label>
                  <label className="manager-compose-field manager-compose-field--body">
                    <span>Message body</span>
                    <textarea
                      aria-label="Message body"
                      value={composeBody}
                      onChange={(event) => setComposeBody(event.target.value)}
                      placeholder="Write the message..."
                      rows={5}
                    />
                  </label>
                  {composeKind === "event" && (
                    <div className="manager-compose-event-fields">
                      <label className="manager-compose-field">
                        <span>Event date</span>
                        <input
                          aria-label="Event date"
                          type="date"
                          value={composeEventDate}
                          onChange={(event) => setComposeEventDate(event.target.value)}
                        />
                      </label>
                      <label className="manager-compose-field">
                        <span>Event time</span>
                        <input
                          aria-label="Event time"
                          value={composeEventTime}
                          onChange={(event) => setComposeEventTime(event.target.value)}
                          placeholder="6:00 PM"
                        />
                      </label>
                    </div>
                  )}
                </section>

                <section className="manager-compose-recipients" aria-label="Compose recipients">
                  <div className="manager-compose-recipient-toolbar">
                    <div className="manager-compose-recipient-title">
                      <span>Recipients</span>
                      <strong>{selectedComposeRecipientCount} selected</strong>
                    </div>
                    <button
                      className="manager-compose-contacts-toggle"
                      type="button"
                      aria-expanded={isComposeContactsOpen}
                      aria-controls="manager-compose-contacts-dialog"
                      onClick={() => setIsComposeContactsOpen(true)}
                    >
                      <Users size={16} />
                      <span>Contacts</span>
                    </button>
                  </div>
                  <div className="manager-compose-quick-panel" aria-label="Quick recipient actions">
                    <div className="manager-compose-quick-panel-head">
                      <span>Quick Audience</span>
                      <small>Tap an active preset again to clear.</small>
                    </div>
                    <div className="manager-compose-quick-actions">
                      <label className={`manager-compose-quick-option${composeAllUsers ? " is-selected" : ""}`}>
                        <input
                          aria-label="All Users"
                          type="checkbox"
                          checked={composeAllUsers}
                          onChange={quickToggleComposeAllUsers}
                        />
                        <span>
                          <strong>All Users</strong>
                          <small>{composeRecipients.length} contacts</small>
                        </span>
                      </label>
                      <label className={`manager-compose-quick-option${isComposeRecipientRoleOnlySelected("staff") ? " is-selected" : ""}`}>
                        <input
                          aria-label="All Staff"
                          type="checkbox"
                          checked={isComposeRecipientRoleOnlySelected("staff")}
                          onChange={() => quickToggleComposeRecipientRole("staff")}
                        />
                        <span>
                          <strong>All Staff</strong>
                          <small>{getComposeRecipientsByRole("staff").length} contact</small>
                        </span>
                      </label>
                      <label className={`manager-compose-quick-option${isComposeRecipientRoleOnlySelected("student") ? " is-selected" : ""}`}>
                        <input
                          aria-label="All Students"
                          type="checkbox"
                          checked={isComposeRecipientRoleOnlySelected("student")}
                          onChange={() => quickToggleComposeRecipientRole("student")}
                        />
                        <span>
                          <strong>All Students</strong>
                          <small>{getComposeRecipientsByRole("student").length} contacts</small>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="manager-compose-selected-panel" aria-label="Selected compose recipients">
                    <div className="manager-compose-selected-panel-head">
                      <span>Selected Contacts</span>
                      <strong>{selectedComposeRecipientCount}</strong>
                    </div>
                    {composeRecipientSummaryItems.length ? (
                      <div className="manager-compose-selected-chips">
                        {composeRecipientSummaryItems.map((item) => (
                          <span className={`manager-compose-selected-chip manager-compose-selected-chip--${item.variant}`} key={item.id}>
                            <Users size={13} aria-hidden="true" />
                            <span>
                              <strong>{item.label}</strong>
                              <small>{item.detail}</small>
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>No contacts selected yet.</p>
                    )}
                  </div>
                </section>
              </div>

              <footer className="manager-compose-actions">
                <button type="button" className="manager-compose-secondary" onClick={closeComposeDialog}>Cancel</button>
                <button type="submit" className="manager-compose-submit">
                  <Send size={18} />
                  <span>Send Compose</span>
                </button>
              </footer>
            </form>
            {isComposeContactsOpen && (
              <div
                className="manager-compose-contacts-backdrop"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setIsComposeContactsOpen(false);
                }}
              >
                <section
                  className="manager-compose-contacts-modal"
                  id="manager-compose-contacts-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="manager-compose-contacts-title"
                >
                  <header className="manager-compose-contacts-head">
                    <div>
                      <p>Recipient directory</p>
                      <h2 id="manager-compose-contacts-title">Contacts</h2>
                    </div>
                    <button className="manager-compose-close" type="button" aria-label="Close contacts" onClick={() => setIsComposeContactsOpen(false)}>
                      <X size={20} />
                    </button>
                  </header>

                  <div className="manager-compose-contact-tools manager-compose-contact-tools--dialog">
                    <label className="manager-compose-contact-search">
                      <Search size={17} aria-hidden="true" />
                      <span className="sr-only">Search compose contacts</span>
                      <input
                        aria-label="Search compose contacts"
                        type="search"
                        value={composeRecipientQuery}
                        onChange={(event) => setComposeRecipientQuery(event.target.value)}
                        placeholder="Search contacts by name, role, phone, or email"
                      />
                    </label>
                    <span className="manager-compose-contact-count">{visibleComposeRecipients.length} visible · {selectedComposeRecipientCount} selected</span>
                  </div>

                  <div className="manager-compose-contact-categories">
                    {composeRecipientGroups.map((group) => {
                      const isGroupCollapsed = collapsedComposeRecipientRoles.has(group.role);
                      const contactListId = `manager-compose-contact-list-${group.role}`;
                      const selectedGroupCount = composeAllUsers
                        ? group.recipients.length
                        : group.recipients.filter((recipient) => composeSelectedRecipientIds.has(recipient.id)).length;

                      return (
                        <section
                          className={`manager-compose-contact-category manager-compose-contact-category--${group.role}${isGroupCollapsed ? " is-collapsed" : ""}`}
                          key={group.role}
                          role="group"
                          aria-label={`${group.title} contacts`}
                        >
                          <header>
                            <button
                              className="manager-compose-category-toggle"
                              type="button"
                              aria-expanded={!isGroupCollapsed}
                              aria-controls={contactListId}
                              onClick={() => toggleComposeRecipientGroup(group.role)}
                            >
                              <ChevronRight size={16} aria-hidden="true" />
                              <span className="sr-only">{isGroupCollapsed ? "Expand" : "Collapse"} {group.title}</span>
                            </button>
                            <div className="manager-compose-category-summary">
                              <h3>{group.title}</h3>
                              <p>{group.description}</p>
                            </div>
                            <div className="manager-compose-category-actions">
                              <span>{selectedGroupCount}/{group.recipients.length}</span>
                              <button
                                className="manager-compose-category-select"
                                type="button"
                                aria-label={`Select all ${group.title}`}
                                disabled={!group.recipients.length}
                                onClick={() => selectComposeRecipientGroup(group.recipients)}
                              >
                                Select All
                              </button>
                            </div>
                          </header>
                          {!isGroupCollapsed && (
                            <div className="manager-compose-contact-list" id={contactListId} aria-label={`${group.title} contact list`}>
                              {group.recipients.length ? (
                                group.recipients.map((recipient) => (
                                  <label className="manager-compose-contact" key={recipient.id}>
                                    <input
                                      type="checkbox"
                                      aria-label={`${recipient.name} ${composeRecipientRoleLabel(recipient.role)} ${recipient.detail}`}
                                      checked={composeAllUsers || composeSelectedRecipientIds.has(recipient.id)}
                                      onChange={() => toggleComposeRecipient(recipient.id)}
                                    />
                                    <span aria-hidden="true" />
                                    <div>
                                      <strong>{recipient.name}</strong>
                                      <small>{composeRecipientRoleLabel(recipient.role)} · {recipient.subtitle}</small>
                                      <p>{recipient.detail}</p>
                                    </div>
                                  </label>
                                ))
                              ) : (
                                <p className="manager-compose-empty">No matching contacts.</p>
                              )}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>

                  <footer className="manager-compose-contacts-actions">
                    <button type="button" className="manager-compose-submit" onClick={() => setIsComposeContactsOpen(false)}>Done</button>
                  </footer>
                </section>
              </div>
            )}
          </div>
        )}
      </main>
    </section>
  );
}

function ManagerLauncherPage() {
  const { accountRole, logout, session, showToast, students } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSettings, setProfileSettings] = useState(() => readManagerProfile(session?.email));
  const [profilePassword, setProfilePassword] = useState({ newPassword: "", confirmPassword: "" });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isStudentPanel = accountRole === "student";
  const launcherItems = isStudentPanel ? studentLauncherItems : managerLauncherItems;
  const selectedLauncherItem = isStudentPanel ? getSelectedStudentLauncherItem(location.search) : getSelectedManagerLauncherItem(location.search);
  const launcherName = isStudentPanel ? "student" : "manager";
  const sidebarToggleLabel = isSidebarCollapsed ? `Expand ${launcherName} app launcher` : `Collapse ${launcherName} app launcher`;
  const studentRecord = students[0];
  const studentPanelProfile = isStudentPanel ? readStudentProfile(session?.email, studentRecord) : undefined;
  const profileActionPhoto = isStudentPanel
    ? studentPanelProfile?.photoDataUrl ?? (studentRecord?.profileImagePath ? publicAsset(studentRecord.profileImagePath) : publicAsset("assets/CheetahProfilePic/Cheetah.png"))
    : profileSettings.photoDataUrl ?? publicAsset("assets/CheetahProfilePic/Cheetah.png");

  useEffect(() => {
    if (new URLSearchParams(location.search).get("profile") !== "settings") return;
    if (isStudentPanel) {
      navigate("/manager", { replace: true });
      return;
    }
    setProfileSettings(readManagerProfile(session?.email));
    setProfilePassword({ newPassword: "", confirmPassword: "" });
    setProfileOpen(true);
    navigate("/manager", { replace: true });
  }, [isStudentPanel, location.search, navigate, session?.email]);

  const selectProfileTheme = (theme: AppThemeMode) => {
    setProfileSettings((current) => ({ ...current, theme }));
    writeManagerProfile({ ...readManagerProfile(session?.email), theme }, session?.email);
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
    writeManagerProfile(nextProfile, session?.email);
    setProfileSettings(nextProfile);
    setProfilePassword({ newPassword: "", confirmPassword: "" });
    setProfileOpen(false);
    navigate("/", { replace: true });
    showToast("Manager profile settings saved.");
  };

  return (
    <section className={`manager-launcher-page${isStudentPanel ? " student-launcher-page" : ""}`} aria-label={isStudentPanel ? "Student dashboard" : "Manager dashboard"}>
      <main className="manager-launcher-main">
        <header className="manager-launcher-topbar manager-page-title-bar" aria-label={isStudentPanel ? "Student panel page header" : "Manager panel page header"}>
          <ManagerPageTitleFrame title={isStudentPanel ? "Student's Panel" : "MANAGER PANEL"} className="manager-page-title-frame--manager-panel" />
          <nav className="manager-home-top-actions" aria-label={isStudentPanel ? "Student panel quick actions" : "Manager panel quick actions"}>
            <Link className="manager-home-top-action manager-launcher-profile-link" to="/" aria-label="Profile">
              <img
                className="manager-home-profile-action-photo"
                src={profileActionPhoto}
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
        <div className={`manager-launcher-body${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}`} role="group" aria-label={isStudentPanel ? "Student launcher workspace frame" : "Manager launcher workspace frame"}>
          <nav
            className="manager-launcher-grid manager-launcher-sidebar"
            id="manager-launcher-sidebar"
            aria-label={isStudentPanel ? "Student app launcher" : "Manager app launcher"}
            data-orientation="vertical"
            hidden={isSidebarCollapsed}
          >
            {launcherItems.map((item) => {
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
            {isStudentPanel ? <StudentLauncherWorkspace tool={selectedLauncherItem.icon} /> : <ManagerLauncherWorkspace tool={selectedLauncherItem.icon} />}
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

function OperationsHomePage() {
  const { accountRole } = useAppState();
  if (accountRole === "student") return <StudentProfilePage />;
  if (accountRole === "guardian") return <ParentProfilePage />;
  return <ManagerHomePage />;
}

function StaffOnlyRoute({ children }: { children: ReactNode }) {
  const { accountRole } = useAppState();
  return accountRole === "staff" ? <>{children}</> : <Navigate to="/" replace />;
}

function StaffOrStudentRoute({ children }: { children: ReactNode }) {
  const { accountRole } = useAppState();
  return accountRole === "staff" || accountRole === "student" ? <>{children}</> : <Navigate to="/" replace />;
}

function ManagerPanelRoute() {
  const { accountRole } = useAppState();
  if (accountRole === "guardian") return <Navigate to="/" replace />;
  return <ManagerLauncherPage />;
}

export function OperationsApp() {
  return (
    <OperationsShell>
      <Routes>
        <Route path="/" element={<OperationsHomePage />} />
        <Route path="/manager" element={<ManagerPanelRoute />} />
        <Route path="/dashboard" element={<StaffOnlyRoute><DashboardPage /></StaffOnlyRoute>} />
        <Route path="/students" element={<StaffOnlyRoute><StudentsPage /></StaffOnlyRoute>} />
        <Route path="/classes" element={<StaffOnlyRoute><ClassesPage /></StaffOnlyRoute>} />
        <Route path="/study-guide" element={<StaffOnlyRoute><ManagerStudyGuidePage /></StaffOnlyRoute>} />
        <Route path="/schedule" element={<StaffOnlyRoute><SchedulePage /></StaffOnlyRoute>} />
        <Route path="/messages" element={<StaffOnlyRoute><MessagesPage /></StaffOnlyRoute>} />
        <Route path="/check-ins" element={<StaffOrStudentRoute><CheckInsPage /></StaffOrStudentRoute>} />
        <Route path="/events" element={<StaffOnlyRoute><EventsPage /></StaffOnlyRoute>} />
        <Route path="/merchandise" element={<StaffOnlyRoute><MerchandisePage /></StaffOnlyRoute>} />
        <Route path="/videos" element={<StaffOnlyRoute><ManagerVideosPage /></StaffOnlyRoute>} />
        <Route path="/reports" element={<StaffOnlyRoute><ReportsPage /></StaffOnlyRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OperationsShell>
  );
}
