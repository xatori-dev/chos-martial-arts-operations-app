import { describe, expect, it } from "vitest";
import { buildReportsCommandCenter } from "./operationsReports";
import type { BookingDetails, ContactSubmission, DirectMessage, MerchandiseItem, MessageLog, ScheduledClass, StudentCheckIn, StudentRecord, StudioClass, StudioEvent } from "./types";

function makeStudent(overrides: Partial<StudentRecord> & Pick<StudentRecord, "id" | "firstName" | "lastName">): StudentRecord {
  return {
    phone: "(262) 555-0100",
    email: `${overrides.firstName.toLowerCase()}@example.com`,
    dateOfBirth: "2014-09-01",
    guardianName: `${overrides.lastName} Guardian`,
    guardianPhone: "(262) 555-0100",
    guardianEmail: `${overrides.firstName.toLowerCase()}.guardian@example.com`,
    emergencyContactName: `${overrides.lastName} Emergency`,
    emergencyContactRelationship: "Parent",
    emergencyContactPhone: "(262) 555-0200",
    status: "Active",
    beltRank: "White",
    classesAttended: 0,
    missedClassCount: 0,
    joinedAt: "2026-05-01",
    ...overrides
  };
}

describe("buildReportsCommandCenter", () => {
  it("prioritizes current workload, engagement, and maintenance signals", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-1", firstName: "Maya", lastName: "Robinson", missedClassCount: 3, lastContactedAt: "2026-05-20" }),
        makeStudent({ id: "student-2", firstName: "Evan", lastName: "Ramirez", status: "Trial", missedClassCount: 1 }),
        makeStudent({ id: "student-3", firstName: "Lila", lastName: "Thompson", status: "Inactive", missedClassCount: 5 }),
        makeStudent({ id: "student-4", firstName: "Owen", lastName: "Carter", status: "Paused", missedClassCount: 2 }),
        makeStudent({ id: "student-5", firstName: "Serena", lastName: "Park", missedClassCount: 4, lastContactedAt: "2026-06-01" }),
        makeStudent({ id: "student-6", firstName: "Noah", lastName: "Bennett", status: "Trial", lastContactedAt: "2026-06-01" }),
        makeStudent({ id: "student-7", firstName: "Iris", lastName: "Morgan", status: "Paused", lastContactedAt: "2026-06-01" })
      ],
      checkIns: [
        { id: "check-1", studentId: "student-1", studentName: "Maya Robinson", date: "2026-06-01", beltRank: "Green" },
        { id: "check-2", studentId: "student-2", studentName: "Evan Ramirez", date: "2026-05-26", beltRank: "White" },
        { id: "check-3", studentId: "student-4", studentName: "Owen Carter", date: "2026-05-20", beltRank: "Blue" }
      ] satisfies StudentCheckIn[],
      scheduledClasses: [
        { id: "schedule-1", title: "Intro Lesson", date: "2026-06-03", time: "5:30 PM", type: "private-lesson" },
        { id: "schedule-2", title: "Past Class", date: "2026-05-30", time: "5:30 PM", type: "class" }
      ] satisfies ScheduledClass[],
      studioClasses: [
        { id: "class-1", name: "Youth Foundations", daysOfWeek: [1, 3], startTime: "17:00", endTime: "17:45", recurring: true }
      ] satisfies StudioClass[],
      studioEvents: [
        { id: "event-1", title: "Color Belt Testing", date: "2026-06-07", time: "10:00 AM", details: "Testing", audience: "students" },
        { id: "event-2", title: "Old Event", date: "2026-05-24", time: "10:00 AM", details: "Past", audience: "families" }
      ] satisfies StudioEvent[],
      messageLogs: [
        { id: "message-1", kind: "follow-up", recipientName: "Maya Robinson", recipientPhone: "(262) 555-0100", body: "We missed you", status: "queued", createdAt: "2026-06-01T12:00:00.000Z" }
      ] satisfies MessageLog[],
      merchandiseItems: [
        { id: "merch-1", name: "Youth Gloves", category: "Gloves", price: 39, stock: 2, reorderPoint: 4, targetStock: 10, description: "Bag gloves", imageLabel: "gloves" },
        { id: "merch-2", name: "White Uniform", category: "Uniforms", price: 39, stock: 8, description: "Starter uniform", imageLabel: "uniform" }
      ] satisfies MerchandiseItem[]
    });

    expect(report.summary).toEqual({
      currentStudents: 6,
      attendanceFollowUps: 1,
      trialFollowUps: 1,
      leadFollowUps: 0,
      directMessageReplies: 0,
      newStudentCheckIns: 0,
      attendanceGapFollowUps: 0,
      pausedFollowUps: 1,
      celebrationOutreach: 0,
      profileUpdateRequests: 0,
      classReminders: 0,
      milestoneEncouragements: 0,
      testReadinessFollowUps: 0,
      checkInsThisWeek: 2,
      queuedMessages: 1,
      staleQueuedMessages: 0,
      upcomingCalendarItems: 2,
      lowStockItems: 1,
      staleScheduleItems: 1
    });
    expect(report.priorityActions.map((action) => action.title)).toEqual([
      "Send queued texts",
      "Send missed-class follow-ups",
      "Convert trial students",
      "Restock low inventory",
      "Clear stale schedule items",
      "Review paused students"
    ]);
    expect(report.attendanceRisks.map((student) => student.name)).toEqual(["Maya Robinson"]);
    expect(report.lowStockItems).toEqual([
      { id: "merch-1", name: "Youth Gloves", category: "Gloves", stock: 2, reorderPoint: 4, targetStock: 10, restockQuantity: 8 }
    ]);
  });

  it("surfaces public starter bookings and contact leads as lead follow-up work", () => {
    const reportInput = {
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-existing", firstName: "Existing", lastName: "Member", phone: "(262) 555-0199", email: "existing@example.com" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[],
      bookings: [
        { persons: 2, date: "2026-06-03", time: "5:30 PM", timezone: "America/Chicago" },
        { persons: 1, date: "2026-06-05", time: "10:00 AM", timezone: "America/Chicago" }
      ] satisfies BookingDetails[],
      contacts: [
        {
          id: "contact-ari",
          name: "Ari Nguyen",
          email: "ari@example.com",
          phone: "(262) 555-0101",
          message: "We want to try the starter program.",
          createdAt: "2026-06-01T10:00:00.000Z"
        },
        {
          id: "contact-existing",
          name: "Existing Member",
          email: "existing@example.com",
          phone: "(262) 555-0199",
          message: "This member is already in the roster.",
          createdAt: "2026-06-01T10:05:00.000Z"
        }
      ] satisfies ContactSubmission[]
    } satisfies Parameters<typeof buildReportsCommandCenter>[0] & {
      bookings: BookingDetails[];
      contacts: ContactSubmission[];
    };

    const report = buildReportsCommandCenter(reportInput);

    expect(report.summary).toMatchObject({ leadFollowUps: 3 });
    expect(report.priorityActions).toContainEqual(expect.objectContaining({
      id: "lead-follow-ups",
      title: "Review new leads",
      detail: "Ari Nguyen, Starter booking 2026-06-03 and 1 more",
      count: 3,
      path: "/reports#reports-leads-title"
    }));
    expect(report.leadCandidates).toEqual([
      {
        id: "contact-ari",
        kind: "contact",
        name: "Ari Nguyen",
        detail: "(262) 555-0101 · ari@example.com",
        note: "We want to try the starter program.",
        date: "2026-06-01"
      },
      {
        id: "booking-2026-06-03-5-30-pm-0",
        kind: "booking",
        name: "Starter booking 2026-06-03",
        detail: "5:30 PM · 2 people",
        note: "Starter program reservation",
        date: "2026-06-03"
      },
      {
        id: "booking-2026-06-05-10-00-am-1",
        kind: "booking",
        name: "Starter booking 2026-06-05",
        detail: "10:00 AM · 1 person",
        note: "Starter program reservation",
        date: "2026-06-05"
      }
    ]);
  });

  it("surfaces unanswered student and parent app messages for staff reply", () => {
    const reportInput = {
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-ari", firstName: "Ari", lastName: "Nguyen" }),
        makeStudent({ id: "student-bree", firstName: "Bree", lastName: "Santos" }),
        makeStudent({ id: "student-cora", firstName: "Cora", lastName: "Miles", status: "Inactive" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[],
      directMessages: [
        {
          id: "direct-ari-staff",
          threadId: "direct-staff-seed-student-ari",
          senderId: "direct-staff-seed",
          senderName: "Cho's Manager",
          recipientId: "student-ari",
          recipientName: "Ari Nguyen",
          body: "Can you confirm tomorrow?",
          createdAt: "2026-06-01T09:00:00.000Z",
          status: "sent"
        },
        {
          id: "direct-ari-inbound",
          threadId: "direct-staff-seed-student-ari",
          senderId: "student-ari",
          senderName: "Ari Nguyen",
          recipientId: "direct-staff-seed",
          recipientName: "Cho's Manager",
          body: "Yes, I can make tomorrow's class.",
          createdAt: "2026-06-01T09:10:00.000Z",
          status: "sent"
        },
        {
          id: "direct-bree-inbound",
          threadId: "direct-staff-seed-student-bree",
          senderId: "student-bree",
          senderName: "Bree Santos",
          recipientId: "direct-staff-seed",
          recipientName: "Cho's Manager",
          body: "Can I reschedule?",
          createdAt: "2026-06-01T09:15:00.000Z",
          status: "sent"
        },
        {
          id: "direct-bree-staff",
          threadId: "direct-staff-seed-student-bree",
          senderId: "direct-staff-seed",
          senderName: "Cho's Manager",
          recipientId: "student-bree",
          recipientName: "Bree Santos",
          body: "Yes, we can move you.",
          createdAt: "2026-06-01T09:20:00.000Z",
          status: "sent"
        },
        {
          id: "direct-parent-inbound",
          threadId: "direct-staff-seed-parent-student-ari",
          senderId: "parent-student-ari",
          senderName: "Mina Nguyen",
          recipientId: "direct-staff-seed",
          recipientName: "Cho's Manager",
          body: "Can you send the belt test time?",
          createdAt: "2026-06-01T10:00:00.000Z",
          status: "sent"
        },
        {
          id: "direct-cora-inbound",
          threadId: "direct-staff-seed-student-cora",
          senderId: "student-cora",
          senderName: "Cora Miles",
          recipientId: "direct-staff-seed",
          recipientName: "Cho's Manager",
          body: "Inactive students should not create staff work.",
          createdAt: "2026-06-01T10:30:00.000Z",
          status: "sent"
        }
      ] satisfies DirectMessage[]
    } satisfies Parameters<typeof buildReportsCommandCenter>[0] & {
      directMessages: DirectMessage[];
    };

    const report = buildReportsCommandCenter(reportInput) as ReturnType<typeof buildReportsCommandCenter> & {
      directMessageReplyCandidates?: Array<{ id: string; senderName: string; studentName: string; body: string; createdAt: string }>;
    };

    expect(report.summary).toMatchObject({ directMessageReplies: 2 });
    expect(report.priorityActions).toContainEqual(expect.objectContaining({
      id: "direct-message-replies",
      title: "Reply to app messages",
      detail: "Mina Nguyen, Ari Nguyen",
      count: 2,
      path: "/"
    }));
    expect(report.directMessageReplyCandidates).toEqual([
      expect.objectContaining({
        id: "direct-parent-inbound",
        senderName: "Mina Nguyen",
        studentName: "Ari Nguyen",
        body: "Can you send the belt test time?",
        createdAt: "2026-06-01T10:00:00.000Z"
      }),
      expect.objectContaining({
        id: "direct-ari-inbound",
        senderName: "Ari Nguyen",
        studentName: "Ari Nguyen",
        body: "Yes, I can make tomorrow's class.",
        createdAt: "2026-06-01T09:10:00.000Z"
      })
    ]);
  });

  it("keeps reviewed public leads out of the follow-up workload", () => {
    const reportInput = {
      today: "2026-06-01",
      students: [] satisfies StudentRecord[],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[],
      bookings: [
        { persons: 2, date: "2026-06-03", time: "5:30 PM", timezone: "America/Chicago" }
      ] satisfies BookingDetails[],
      contacts: [
        {
          id: "contact-ari",
          name: "Ari Nguyen",
          email: "ari@example.com",
          phone: "(262) 555-0101",
          message: "We want to try the starter program.",
          createdAt: "2026-06-01T10:00:00.000Z"
        },
        {
          id: "contact-mina",
          name: "Mina Cho",
          email: "",
          phone: "(262) 555-0102",
          message: "Can someone call about kids classes?",
          createdAt: "2026-06-01T10:05:00.000Z"
        }
      ] satisfies ContactSubmission[],
      leadReviews: [
        {
          id: "review-contact-ari",
          leadId: "contact-ari",
          kind: "contact",
          label: "Ari Nguyen",
          reviewedAt: "2026-06-01T11:00:00.000Z"
        },
        {
          id: "review-booking",
          leadId: "booking-2026-06-03-5-30-pm-0",
          kind: "booking",
          label: "Starter booking 2026-06-03",
          reviewedAt: "2026-06-01T11:05:00.000Z"
        }
      ]
    } satisfies Parameters<typeof buildReportsCommandCenter>[0] & {
      bookings: BookingDetails[];
      contacts: ContactSubmission[];
      leadReviews: Array<{ id: string; leadId: string; kind: "booking" | "contact"; label: string; reviewedAt: string }>;
    };

    const report = buildReportsCommandCenter(reportInput);

    expect(report.summary).toMatchObject({ leadFollowUps: 1 });
    expect(report.priorityActions).toContainEqual(expect.objectContaining({
      id: "lead-follow-ups",
      count: 1,
      detail: "Mina Cho"
    }));
    expect(report.leadCandidates).toEqual([
      expect.objectContaining({ id: "contact-mina", name: "Mina Cho" })
    ]);
  });

  it("surfaces belt testing candidates who are ready for staff outreach", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-1", firstName: "Gia", lastName: "Patel", beltRank: "Orange", classesAttended: 20 }),
        makeStudent({ id: "student-2", firstName: "Iris", lastName: "Morgan", beltRank: "Blue", classesAttended: 44, missedClassCount: 1 }),
        makeStudent({ id: "student-3", firstName: "Elena", lastName: "Torres", beltRank: "Orange", classesAttended: 24, lastContactedAt: "2026-06-01" }),
        makeStudent({ id: "student-4", firstName: "Andre", lastName: "Coleman", beltRank: "Black", classesAttended: 140 }),
        makeStudent({ id: "student-5", firstName: "Caleb", lastName: "Nguyen", status: "Trial", beltRank: "Purple", classesAttended: 60 }),
        makeStudent({ id: "student-6", firstName: "Victor", lastName: "Lane", beltRank: "Purple", classesAttended: 54, phone: "" }),
        makeStudent({ id: "student-7", firstName: "Owen", lastName: "Carter", beltRank: "Red", classesAttended: 74 })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ testReadinessFollowUps: 2 });
    expect(report.priorityActions.map((action) => action.title)).toContain("Invite belt test candidates");
    expect(report).toMatchObject({
      testReadinessCandidates: [
        { id: "student-2", name: "Iris Morgan", beltRank: "Blue", classesAttended: 44, classesRequired: 38 },
        { id: "student-1", name: "Gia Patel", beltRank: "Orange", classesAttended: 20, classesRequired: 20 }
      ]
    });
  });

  it("surfaces near-testing milestone candidates before final testing outreach", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-1", firstName: "Mina", lastName: "Cho", beltRank: "White", classesAttended: 6 }),
        makeStudent({ id: "student-2", firstName: "Talia", lastName: "Rivera", beltRank: "Yellow", classesAttended: 13 }),
        makeStudent({ id: "student-3", firstName: "Nolan", lastName: "Brooks", beltRank: "Orange", classesAttended: 20 }),
        makeStudent({ id: "student-4", firstName: "Parker", lastName: "Stone", beltRank: "Green", classesAttended: 24, missedClassCount: 3 }),
        makeStudent({ id: "student-5", firstName: "June", lastName: "Kim", beltRank: "Blue", classesAttended: 34, lastContactedAt: "2026-06-01" }),
        makeStudent({ id: "student-6", firstName: "Riley", lastName: "Fox", status: "Paused", beltRank: "Purple", classesAttended: 42 }),
        makeStudent({ id: "student-7", firstName: "Sam", lastName: "Young", beltRank: "Black", classesAttended: 108 })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ milestoneEncouragements: 2 });
    expect(report.priorityActions.map((action) => action.title)).toContain("Send milestone encouragement");
    expect(report.milestoneCandidates).toEqual([
      { id: "student-2", name: "Talia Rivera", beltRank: "Yellow", nextRankName: "Orange", progressPercent: 93, classesAttended: 13, classesRequired: 14, classesRemaining: 1 },
      { id: "student-1", name: "Mina Cho", beltRank: "White", nextRankName: "Yellow", progressPercent: 75, classesAttended: 6, classesRequired: 8, classesRemaining: 2 }
    ]);
  });

  it("surfaces upcoming birthday and training anniversary outreach", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-1", firstName: "Ari", lastName: "Nguyen", dateOfBirth: "2014-06-01" }),
        makeStudent({ id: "student-2", firstName: "Bree", lastName: "Santos", dateOfBirth: "2012-06-07" }),
        makeStudent({ id: "student-3", firstName: "Cora", lastName: "Miles", joinedAt: "2025-06-06" }),
        makeStudent({ id: "student-4", firstName: "Dane", lastName: "Woods", dateOfBirth: "2011-06-08" }),
        makeStudent({ id: "student-5", firstName: "Elle", lastName: "Park", dateOfBirth: "2010-06-03", lastContactedAt: "2026-06-01" }),
        makeStudent({ id: "student-6", firstName: "Finn", lastName: "Cole", status: "Inactive", dateOfBirth: "2013-06-03" }),
        makeStudent({ id: "student-7", firstName: "Gia", lastName: "Reid", joinedAt: "2026-06-04" }),
        makeStudent({ id: "student-8", firstName: "Hana", lastName: "Lee", dateOfBirth: "2015-06-04", phone: "" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ celebrationOutreach: 3 });
    expect(report.priorityActions.map((action) => action.title)).toContain("Send celebration outreach");
    expect(report.celebrationCandidates).toEqual([
      { id: "student-1", name: "Ari Nguyen", reason: "birthday", daysAway: 0, date: "2026-06-01" },
      { id: "student-3", name: "Cora Miles", reason: "anniversary", daysAway: 5, date: "2026-06-06", years: 1 },
      { id: "student-2", name: "Bree Santos", reason: "birthday", daysAway: 6, date: "2026-06-07" }
    ]);
  });

  it("keeps celebration outreach to one nearest celebration per student", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-1", firstName: "Ari", lastName: "Nguyen", dateOfBirth: "2014-06-05", joinedAt: "2025-06-02" }),
        makeStudent({ id: "student-2", firstName: "Bree", lastName: "Santos", dateOfBirth: "2012-06-03", joinedAt: "2025-06-03" }),
        makeStudent({ id: "student-3", firstName: "Cora", lastName: "Miles", joinedAt: "2025-06-06" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ celebrationOutreach: 3 });
    expect(report.priorityActions).toContainEqual(expect.objectContaining({
      id: "celebration-outreach",
      detail: "Ari Nguyen, Bree Santos and 1 more",
      count: 3
    }));
    expect(report.celebrationCandidates).toEqual([
      { id: "student-1", name: "Ari Nguyen", reason: "anniversary", daysAway: 1, date: "2026-06-02", years: 1 },
      { id: "student-2", name: "Bree Santos", reason: "birthday", daysAway: 2, date: "2026-06-03" },
      { id: "student-3", name: "Cora Miles", reason: "anniversary", daysAway: 5, date: "2026-06-06", years: 1 }
    ]);
  });

  it("surfaces student profile data gaps for update outreach", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-1", firstName: "Ari", lastName: "Nguyen", dateOfBirth: undefined, guardianEmail: "", emergencyContactName: "", emergencyContactPhone: "" }),
        makeStudent({ id: "student-2", firstName: "Bree", lastName: "Santos", guardianEmail: "" }),
        makeStudent({ id: "student-3", firstName: "Cora", lastName: "Miles", guardianEmail: "", emergencyContactName: "", lastContactedAt: "2026-06-01" }),
        makeStudent({ id: "student-4", firstName: "Dane", lastName: "Woods", status: "Inactive", guardianEmail: "", emergencyContactName: "" }),
        makeStudent({ id: "student-5", firstName: "Elle", lastName: "Park", phone: "", guardianEmail: "", emergencyContactName: "" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ profileUpdateRequests: 2 });
    expect(report.priorityActions.map((action) => action.title)).toContain("Request profile updates");
    expect(report.profileUpdateCandidates).toEqual([
      { id: "student-1", name: "Ari Nguyen", issueCount: 4, issues: ["Birth date missing", "Guardian email missing", "Emergency contact missing", "Emergency phone missing"] },
      { id: "student-2", name: "Bree Santos", issueCount: 1, issues: ["Guardian email missing"] }
    ]);
  });

  it("surfaces annual profile verification when complete student records are stale", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({
          id: "student-1",
          firstName: "Ari",
          lastName: "Nguyen",
          joinedAt: "2025-05-01",
          profileUpdatedAt: "2025-05-01"
        }),
        makeStudent({
          id: "student-2",
          firstName: "Bree",
          lastName: "Santos",
          joinedAt: "2025-01-01",
          profileUpdatedAt: "2026-02-01"
        }),
        makeStudent({
          id: "student-3",
          firstName: "Cora",
          lastName: "Miles",
          joinedAt: "2025-05-01",
          profileUpdatedAt: "2025-05-01",
          lastContactedAt: "2026-06-01"
        }),
        makeStudent({
          id: "student-4",
          firstName: "Dane",
          lastName: "Woods",
          joinedAt: "2025-05-01",
          profileUpdatedAt: "2025-05-01",
          status: "Inactive"
        }),
        makeStudent({
          id: "student-5",
          firstName: "Elle",
          lastName: "Park",
          joinedAt: "2025-05-01",
          profileUpdatedAt: "2025-05-01",
          phone: ""
        })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ profileUpdateRequests: 1 });
    expect(report.priorityActions).toContainEqual(expect.objectContaining({
      id: "profile-updates",
      title: "Request profile updates",
      detail: "Ari Nguyen",
      count: 1
    }));
    expect(report.profileUpdateCandidates).toEqual([
      { id: "student-1", name: "Ari Nguyen", issueCount: 1, issues: ["Annual profile verification due"] }
    ]);
  });

  it("surfaces first-week new student check-ins without duplicating other outreach", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-15",
      students: [
        makeStudent({ id: "student-1", firstName: "Ari", lastName: "Nguyen", joinedAt: "2026-06-10", program: "Youth Foundations" }),
        makeStudent({ id: "student-2", firstName: "Bree", lastName: "Santos", joinedAt: "2026-06-01", program: "Adult Basics" }),
        makeStudent({ id: "student-3", firstName: "Cora", lastName: "Miles", joinedAt: "2026-06-11" }),
        makeStudent({ id: "student-4", firstName: "Dane", lastName: "Woods", joinedAt: "2026-05-31" }),
        makeStudent({ id: "student-5", firstName: "Elle", lastName: "Park", joinedAt: "2026-06-10", phone: "" }),
        makeStudent({ id: "student-6", firstName: "Finn", lastName: "Cole", joinedAt: "2026-06-10", lastContactedAt: "2026-06-15" }),
        makeStudent({ id: "student-7", firstName: "Gia", lastName: "Reid", joinedAt: "2026-06-10", status: "Trial" }),
        makeStudent({ id: "student-8", firstName: "Hana", lastName: "Lee", joinedAt: "2026-06-10", status: "Inactive" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ newStudentCheckIns: 2 });
    expect(report.priorityActions).toContainEqual(expect.objectContaining({
      id: "new-student-check-ins",
      title: "Check in with new students",
      count: 2,
      detail: "Bree Santos, Ari Nguyen"
    }));
    expect(report.newStudentCheckInCandidates).toEqual([
      { id: "student-2", name: "Bree Santos", joinedAt: "2026-06-01", daysSinceJoin: 14, program: "Adult Basics" },
      { id: "student-1", name: "Ari Nguyen", joinedAt: "2026-06-10", daysSinceJoin: 5, program: "Youth Foundations" }
    ]);
  });

  it("surfaces attendance gaps from check-in history without duplicating missed-class work", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-30",
      students: [
        makeStudent({ id: "student-1", firstName: "Ari", lastName: "Nguyen", joinedAt: "2026-05-01", lastCheckIn: "2026-06-09" }),
        makeStudent({ id: "student-2", firstName: "Bree", lastName: "Santos", joinedAt: "2026-06-01" }),
        makeStudent({ id: "student-3", firstName: "Cora", lastName: "Miles", joinedAt: "2026-05-01", lastCheckIn: "2026-06-20" }),
        makeStudent({ id: "student-4", firstName: "Dane", lastName: "Woods", joinedAt: "2026-05-01", lastCheckIn: "2026-06-01", missedClassCount: 3 }),
        makeStudent({ id: "student-5", firstName: "Elle", lastName: "Park", joinedAt: "2026-05-01", lastCheckIn: "2026-06-01", phone: "" }),
        makeStudent({ id: "student-6", firstName: "Finn", lastName: "Cole", joinedAt: "2026-05-01", lastCheckIn: "2026-06-01", lastContactedAt: "2026-06-30" }),
        makeStudent({ id: "student-7", firstName: "Gia", lastName: "Reid", joinedAt: "2026-05-01", lastCheckIn: "2026-06-01", status: "Trial" }),
        makeStudent({ id: "student-8", firstName: "Hana", lastName: "Lee", joinedAt: "2026-05-01", lastCheckIn: "2026-06-01", status: "Paused" }),
        makeStudent({ id: "student-9", firstName: "Iris", lastName: "Kim", joinedAt: "2026-06-16" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ attendanceFollowUps: 1, attendanceGapFollowUps: 2, newStudentCheckIns: 1 });
    expect(report.priorityActions).toContainEqual(expect.objectContaining({
      id: "attendance-gap-check-ins",
      title: "Check attendance gaps",
      count: 2,
      detail: "Bree Santos, Ari Nguyen"
    }));
    expect(report.attendanceGapCandidates).toEqual([
      { id: "student-2", name: "Bree Santos", lastAttendanceDate: "2026-06-01", daysSinceAttendance: 29 },
      { id: "student-1", name: "Ari Nguyen", lastAttendanceDate: "2026-06-09", daysSinceAttendance: 21 }
    ]);
  });

  it("surfaces upcoming student class reminders for queued outreach", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-1", firstName: "Ari", lastName: "Nguyen" }),
        makeStudent({ id: "student-2", firstName: "Bree", lastName: "Santos" }),
        makeStudent({ id: "student-3", firstName: "Cora", lastName: "Miles", lastContactedAt: "2026-06-01" }),
        makeStudent({ id: "student-4", firstName: "Dane", lastName: "Woods", phone: "" }),
        makeStudent({ id: "student-5", firstName: "Elle", lastName: "Park", status: "Inactive" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [
        { id: "schedule-1", title: "Private Lesson", date: "2026-06-02", time: "4:30 PM", type: "private-lesson", studentId: "student-1" },
        { id: "schedule-2", title: "Testing Prep", date: "2026-06-03", time: "5:30 PM", type: "testing-prep", studentId: "student-2" },
        { id: "schedule-3", title: "Already Contacted", date: "2026-06-02", time: "6:00 PM", type: "private-lesson", studentId: "student-3" },
        { id: "schedule-4", title: "No Phone", date: "2026-06-02", time: "6:30 PM", type: "private-lesson", studentId: "student-4" },
        { id: "schedule-5", title: "Too Far Out", date: "2026-06-04", time: "5:30 PM", type: "private-lesson", studentId: "student-1" },
        { id: "schedule-6", title: "General Class", date: "2026-06-02", time: "5:00 PM", type: "class" }
      ] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ classReminders: 2 });
    expect(report.priorityActions.map((action) => action.title)).toContain("Send class reminders");
    expect(report.classReminderCandidates).toEqual([
      { id: "schedule-1", studentId: "student-1", studentName: "Ari Nguyen", title: "Private Lesson", date: "2026-06-02", time: "4:30 PM", daysAway: 1 },
      { id: "schedule-2", studentId: "student-2", studentName: "Bree Santos", title: "Testing Prep", date: "2026-06-03", time: "5:30 PM", daysAway: 2 }
    ]);
  });

  it("keeps class reminders to one next appointment per student", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-1", firstName: "Ari", lastName: "Nguyen" }),
        makeStudent({ id: "student-2", firstName: "Bree", lastName: "Santos" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [
        { id: "schedule-later-same-day", title: "Testing Prep", date: "2026-06-02", time: "6:30 PM", type: "testing-prep", studentId: "student-1" },
        { id: "schedule-earliest", title: "Private Lesson", date: "2026-06-02", time: "4:30 PM", type: "private-lesson", studentId: "student-1" },
        { id: "schedule-next-day", title: "Board Breaking", date: "2026-06-03", time: "5:30 PM", type: "testing-prep", studentId: "student-1" },
        { id: "schedule-bree", title: "Leadership Check", date: "2026-06-03", time: "5:00 PM", type: "private-lesson", studentId: "student-2" }
      ] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ classReminders: 2 });
    expect(report.priorityActions).toContainEqual(expect.objectContaining({
      id: "class-reminders",
      detail: "Ari Nguyen, Bree Santos",
      count: 2
    }));
    expect(report.classReminderCandidates).toEqual([
      { id: "schedule-earliest", studentId: "student-1", studentName: "Ari Nguyen", title: "Private Lesson", date: "2026-06-02", time: "4:30 PM", daysAway: 1 },
      { id: "schedule-bree", studentId: "student-2", studentName: "Bree Santos", title: "Leadership Check", date: "2026-06-03", time: "5:00 PM", daysAway: 2 }
    ]);
  });

  it("counts only queued texts that can still be delivered to current students", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-1", firstName: "Ari", lastName: "Nguyen", phone: "(262) 555-0101", lastCheckIn: "2026-05-25" }),
        makeStudent({ id: "student-2", firstName: "Cora", lastName: "Miles", phone: "(262) 555-0103", status: "Inactive" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [
        { id: "message-ari", kind: "follow-up", recipientName: "Ari Nguyen", recipientPhone: "2625550101", body: "Ari needs a check-in.", status: "queued", createdAt: "2026-06-01T12:00:00.000Z" },
        { id: "message-cora", kind: "follow-up", recipientName: "Cora Miles", recipientPhone: "(262) 555-0103", body: "Cora is inactive.", status: "queued", createdAt: "2026-06-01T12:05:00.000Z" },
        { id: "message-unknown", kind: "profile-update", recipientName: "Noah Woods", recipientPhone: "(262) 555-0104", body: "Noah is no longer listed.", status: "queued", createdAt: "2026-06-01T12:10:00.000Z" },
        { id: "message-cora-sent", kind: "follow-up", recipientName: "Cora Miles", recipientPhone: "(262) 555-0103", body: "Historical inactive message.", status: "sent", createdAt: "2026-05-31T12:00:00.000Z", sentAt: "2026-05-31T12:05:00.000Z" }
      ] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary.queuedMessages).toBe(1);
    expect(report.priorityActions).toContainEqual(expect.objectContaining({ id: "queued-texts", count: 1, detail: "Ari Nguyen" }));
  });

  it("surfaces stale queued texts as cleanup work instead of hiding them", () => {
    const report = buildReportsCommandCenter({
      today: "2026-06-01",
      students: [
        makeStudent({ id: "student-1", firstName: "Ari", lastName: "Nguyen", phone: "(262) 555-0101", lastCheckIn: "2026-05-25" }),
        makeStudent({ id: "student-2", firstName: "Cora", lastName: "Miles", phone: "(262) 555-0103", status: "Inactive" })
      ],
      checkIns: [] satisfies StudentCheckIn[],
      scheduledClasses: [] satisfies ScheduledClass[],
      studioClasses: [] satisfies StudioClass[],
      studioEvents: [] satisfies StudioEvent[],
      messageLogs: [
        { id: "message-ari", kind: "follow-up", recipientName: "Ari Nguyen", recipientPhone: "2625550101", body: "Ari needs a check-in.", status: "queued", createdAt: "2026-06-01T12:00:00.000Z" },
        { id: "message-cora", kind: "follow-up", recipientName: "Cora Miles", recipientPhone: "(262) 555-0103", body: "Cora is inactive.", status: "queued", createdAt: "2026-06-01T12:05:00.000Z" },
        { id: "message-unknown", kind: "profile-update", recipientName: "Noah Woods", recipientPhone: "(262) 555-0104", body: "Noah is no longer listed.", status: "queued", createdAt: "2026-06-01T12:10:00.000Z" },
        { id: "message-cora-sent", kind: "follow-up", recipientName: "Cora Miles", recipientPhone: "(262) 555-0103", body: "Historical inactive message.", status: "sent", createdAt: "2026-05-31T12:00:00.000Z", sentAt: "2026-05-31T12:05:00.000Z" }
      ] satisfies MessageLog[],
      merchandiseItems: [] satisfies MerchandiseItem[]
    });

    expect(report.summary).toMatchObject({ queuedMessages: 1, staleQueuedMessages: 2 });
    expect(report.priorityActions).toEqual([
      expect.objectContaining({ id: "queued-texts", count: 1, detail: "Ari Nguyen" }),
      expect.objectContaining({ id: "stale-queued-text-cleanup", title: "Clear stale queued texts", count: 2, detail: "Cora Miles, Noah Woods" })
    ]);
  });
});
