import { describe, expect, it } from "vitest";
import { buildOperationsBackupSnapshot, parseOperationsBackupSnapshot, type OperationsBackupInput } from "./operationsBackup";

type BackupInputOverrides = Omit<Partial<OperationsBackupInput>, "automationRuns" | "messagingSetup"> & {
  automationRuns?: readonly Record<string, unknown>[];
  messagingSetup?: readonly Record<string, unknown>[];
};

function makeBackupInput(overrides: BackupInputOverrides = {}): OperationsBackupInput {
  return {
    accounts: [],
    accountRoles: [],
    managedAccounts: [],
    childAccounts: [],
    students: [],
    studioClasses: [],
    scheduledClasses: [],
    messageCampaigns: [],
    scheduledTextCampaigns: [],
    messageLogs: [],
    directMessages: [],
    automationRuns: [],
    messagingSetup: [],
    studioEvents: [],
    merchandiseItems: [],
    checkIns: [],
    trainingVideoFolders: [],
    trainingVideos: [],
    studyGuideFolders: [],
    studyGuideMaterials: [],
    orders: [],
    bookings: [],
    contacts: [],
    leadReviews: [],
    ...overrides
  } as unknown as OperationsBackupInput;
}

function makeBackupPayload(overrides: Record<string, unknown>) {
  const snapshot = buildOperationsBackupSnapshot(makeBackupInput(), "2026-06-02T12:00:00.000Z");
  return {
    schemaVersion: snapshot.schemaVersion,
    exportedAt: snapshot.exportedAt,
    data: {
      ...snapshot.data,
      ...overrides
    }
  };
}

describe("buildOperationsBackupSnapshot", () => {
  it("redacts saved account passwords from exported backup data", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        accounts: [
          {
            email: "family@example.com",
            password: "FamilySecret123",
            createdAt: "2026-06-01T09:00:00.000Z"
          }
        ],
        managedAccounts: [
          {
            id: "managed-staff",
            displayName: "Jordan Lee",
            username: "jordan.staff",
            password: "StaffSecret123",
            role: "staff",
            status: "active",
            access: ["dashboard", "students", "reports"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ],
        childAccounts: [
          {
            id: "child-kai",
            parentEmail: "family@example.com",
            name: "Kai Cho",
            username: "kai-cho.child",
            password: "ChildSecret123",
            age: "7",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(JSON.stringify(snapshot.data)).not.toContain("FamilySecret123");
    expect(JSON.stringify(snapshot.data)).not.toContain("StaffSecret123");
    expect(JSON.stringify(snapshot.data)).not.toContain("ChildSecret123");
    expect(snapshot.data.accounts[0]).not.toHaveProperty("password");
    expect(snapshot.data.managedAccounts[0]).not.toHaveProperty("password");
    expect(snapshot.data.childAccounts[0]).not.toHaveProperty("password");
    expect(snapshot.data.accounts[0]).toMatchObject({
      email: "family@example.com"
    });
    expect(snapshot.data.managedAccounts[0]).toMatchObject({
      displayName: "Jordan Lee",
      username: "jordan.staff",
      access: ["dashboard", "students", "reports"]
    });
    expect(snapshot.data.childAccounts[0]).toMatchObject({
      name: "Kai Cho",
      username: "kai-cho.child",
      parentEmail: "family@example.com"
    });
  });

  it("parses exported backup data and ignores unknown sections", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [
          {
            id: "student-restored",
            firstName: "Ari",
            lastName: "Nguyen",
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          }
        ],
        merchandiseItems: [
          { id: "merch-restored", name: "Restored Gloves", category: "Gloves", price: 39, stock: 6, description: "Restored item.", imageLabel: "gloves" }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );
    const parsed = parseOperationsBackupSnapshot(JSON.stringify({
      ...snapshot,
      data: {
        ...snapshot.data,
        unsupportedSection: [{ id: "ignore-me" }]
      }
    }));

    expect(parsed.summary.totalRecords).toBe(2);
    expect(parsed.data.students).toEqual([expect.objectContaining({ id: "student-restored", firstName: "Ari" })]);
    expect(parsed.data.merchandiseItems).toEqual([expect.objectContaining({ id: "merch-restored", stock: 6 })]);
    expect(parsed.data).not.toHaveProperty("unsupportedSection");
  });

  it("rejects incomplete backup snapshots that omit required sections", () => {
    const snapshot = buildOperationsBackupSnapshot(makeBackupInput(), "2026-06-02T12:00:00.000Z");
    const incompleteSnapshot = JSON.parse(JSON.stringify(snapshot)) as { data: Partial<OperationsBackupInput> };
    delete incompleteSnapshot.data.contacts;

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(incompleteSnapshot))).toThrow(/missing required operations sections: contacts/i);
  });

  it("restores legacy backups that predate reviewed lead metadata", () => {
    const snapshot = buildOperationsBackupSnapshot(makeBackupInput(), "2026-06-02T12:00:00.000Z");
    const legacySnapshot = JSON.parse(JSON.stringify(snapshot)) as { data: Partial<OperationsBackupInput> };
    delete legacySnapshot.data.leadReviews;

    expect(parseOperationsBackupSnapshot(JSON.stringify(legacySnapshot)).data.leadReviews).toEqual([]);
  });

  it("exports portable messaging setup without provider secrets or raw push subscription key material", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        messagingSetup: [
          {
            id: " production-messaging ",
            twilioRelayEndpoint: " https://relay.example.test/api/messages/twilio ",
            pushServerEndpoint: " https://push.example.test/api/push/subscriptions ",
            webPushPublicKey: " BO_PUBLIC_WEB_PUSH_KEY ",
            pushSubscriptionEndpoint: "https://fcm.googleapis.com/fcm/send/device-1",
            pushSubscriptionJson: JSON.stringify({
              endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
              keys: {
                p256dh: "raw-device-p256dh",
                auth: "raw-device-auth"
              }
            }),
            TWILIO_AUTH_TOKEN: "secret-auth-token",
            VAPID_PRIVATE_KEY: "secret-vapid-private-key",
            twilioLaunchProfile: {
              messagingServiceSid: " MG1234567890abcdef ",
              smsSender: " +12625550100 ",
              inboundWebhookUrl: " https://relay.example.test/api/messages/inbound ",
              statusCallbackBaseUrl: " https://relay.example.test/api/messages/status ",
              relayHealthCheckUrl: " https://relay.example.test/api/messages/health ",
              managerAuthMode: "server-session",
              senderType: "10dlc",
              a2pBrandStatus: "approved",
              a2pCampaignStatus: "approved",
              tollFreeVerificationStatus: "not-used",
              complianceNotes: " A2P 10DLC path approved for studio outreach. ",
              savedAt: " 2026-06-03T10:15:00.000Z "
            }
          }
        ]
      }),
      "2026-06-03T12:00:00.000Z"
    );
    const messagingSetup = (snapshot.data as unknown as { messagingSetup?: readonly Record<string, unknown>[] }).messagingSetup;

    expect(messagingSetup).toEqual([
      expect.objectContaining({
        id: "production-messaging",
        twilioRelayEndpoint: "https://relay.example.test/api/messages/twilio",
        pushServerEndpoint: "https://push.example.test/api/push/subscriptions",
        webPushPublicKey: "BO_PUBLIC_WEB_PUSH_KEY",
        twilioLaunchProfile: expect.objectContaining({
          messagingServiceSid: "MG1234567890abcdef",
          smsSender: "+12625550100",
          inboundWebhookUrl: "https://relay.example.test/api/messages/inbound",
          statusCallbackBaseUrl: "https://relay.example.test/api/messages/status",
          relayHealthCheckUrl: "https://relay.example.test/api/messages/health",
          managerAuthMode: "server-session",
          senderType: "10dlc",
          a2pBrandStatus: "approved",
          a2pCampaignStatus: "approved",
          tollFreeVerificationStatus: "not-used",
          complianceNotes: "A2P 10DLC path approved for studio outreach.",
          savedAt: "2026-06-03T10:15:00.000Z"
        })
      })
    ]);
    expect(snapshot.sections.find((section) => section.id === "messagingSetup")).toEqual(expect.objectContaining({
      label: "Production Messaging Setup",
      shortLabel: "messaging setup",
      count: 1
    }));
    expect(JSON.stringify(messagingSetup)).not.toMatch(/TWILIO_AUTH_TOKEN|VAPID_PRIVATE_KEY|secret-auth-token|secret-vapid-private-key|pushSubscriptionJson|pushSubscriptionEndpoint|raw-device-p256dh|raw-device-auth|fcm\.googleapis/i);
  });

  it("rejects restored production messaging setup that contains provider secrets or raw push subscription material", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        messagingSetup: [
          {
            id: "production-messaging",
            twilioRelayEndpoint: "https://relay.example.test/api/messages/twilio",
            TWILIO_AUTH_TOKEN: "secret-auth-token"
          }
        ]
      })
    ))).toThrow(/messagingSetup entries must not include provider secrets/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        messagingSetup: [
          {
            id: "production-messaging",
            pushSubscriptionJson: JSON.stringify({
              endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
              keys: {
                p256dh: "raw-device-p256dh",
                auth: "raw-device-auth"
              }
            })
          }
        ]
      })
    ))).toThrow(/messagingSetup entries must not include raw push subscription material/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        messagingSetup: [
          {
            id: "production-messaging",
            webPushPublicKey: JSON.stringify({
              endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
              keys: {
                p256dh: "raw-device-p256dh",
                auth: "raw-device-auth"
              }
            })
          }
        ]
      })
    ))).toThrow(/messagingSetup entries must not include raw push subscription material/i);
  });

  it("drops raw push subscription-shaped strings from exported messaging setup", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        messagingSetup: [
          {
            id: "production-messaging",
            twilioRelayEndpoint: "https://relay.example.test/api/messages/twilio",
            webPushPublicKey: JSON.stringify({
              endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
              keys: {
                p256dh: "raw-device-p256dh",
                auth: "raw-device-auth"
              }
            })
          }
        ]
      })
    );
    const messagingSetup = (snapshot.data as unknown as { messagingSetup?: readonly Record<string, unknown>[] }).messagingSetup;

    expect(messagingSetup).toEqual([
      expect.objectContaining({
        id: "production-messaging",
        twilioRelayEndpoint: "https://relay.example.test/api/messages/twilio"
      })
    ]);
    expect(messagingSetup?.[0]).not.toHaveProperty("webPushPublicKey");
    expect(JSON.stringify(messagingSetup)).not.toMatch(/raw-device-p256dh|raw-device-auth|fcm\.googleapis/i);
  });

  it("restores legacy backups that predate production messaging setup metadata", () => {
    const snapshot = buildOperationsBackupSnapshot(makeBackupInput(), "2026-06-02T12:00:00.000Z");
    const legacySnapshot = JSON.parse(JSON.stringify(snapshot)) as { data: Record<string, unknown> };
    delete legacySnapshot.data.messagingSetup;

    expect((parseOperationsBackupSnapshot(JSON.stringify(legacySnapshot)).data as unknown as { messagingSetup?: readonly unknown[] }).messagingSetup).toEqual([]);
  });

  it("exports text automation run audit history with restorable Twilio scheduler metadata", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        automationRuns: [
          {
            id: " automation-run-1 ",
            ranAt: " 2026-06-03T10:00:00.000Z ",
            status: "queued",
            totalQueued: 1,
            deliveryProvider: "twilio",
            deliveryChannel: "sms",
            deliveryMode: "prototype",
            relayPayloadSchemaVersion: "chos-twilio-relay.v1",
            breakdown: [
              { key: "scheduledPromotions", label: " Scheduled promotions ", queued: 1 },
              { key: "eventReminders", label: " Event reminders ", queued: 0 }
            ]
          }
        ]
      }),
      "2026-06-03T12:00:00.000Z"
    );
    const automationRuns = (snapshot.data as unknown as { automationRuns?: readonly Record<string, unknown>[] }).automationRuns;

    expect(automationRuns).toEqual([
      expect.objectContaining({
        id: "automation-run-1",
        ranAt: "2026-06-03T10:00:00.000Z",
        status: "queued",
        totalQueued: 1,
        deliveryProvider: "twilio",
        deliveryChannel: "sms",
        deliveryMode: "prototype",
        relayPayloadSchemaVersion: "chos-twilio-relay.v1",
        breakdown: [
          { key: "scheduledPromotions", label: "Scheduled promotions", queued: 1 },
          { key: "eventReminders", label: "Event reminders", queued: 0 }
        ]
      })
    ]);
    expect(snapshot.sections.find((section) => section.id === "automationRuns")).toEqual(expect.objectContaining({
      label: "Text Automation Runs",
      shortLabel: "automation runs",
      count: 1
    }));
  });

  it("restores legacy backups that predate text automation run audit history", () => {
    const snapshot = buildOperationsBackupSnapshot(makeBackupInput(), "2026-06-02T12:00:00.000Z");
    const legacySnapshot = JSON.parse(JSON.stringify(snapshot)) as { data: Record<string, unknown> };
    delete legacySnapshot.data.automationRuns;

    expect((parseOperationsBackupSnapshot(JSON.stringify(legacySnapshot)).data as unknown as { automationRuns?: readonly unknown[] }).automationRuns).toEqual([]);
  });

  it("rejects malformed restore files before state is changed", () => {
    expect(() => parseOperationsBackupSnapshot("{")).toThrow(/valid JSON/i);
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({ schemaVersion: "wrong", data: {} }))).toThrow(/unsupported backup schema/i);
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        students: { id: "not-an-array" }
      }
    }))).toThrow(/students must be an array/i);
  });

  it("rejects backup sections containing non-record entries", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        students: [
          {
            id: "student-valid",
            firstName: "Ari",
            lastName: "Nguyen",
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          },
          null
        ]
      }
    }))).toThrow(/students entries must be objects/i);
  });

  it("rejects id-backed backup records without stable ids", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        students: [
          {
            firstName: "Ari",
            lastName: "Nguyen",
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          }
        ]
      }
    }))).toThrow(/students entries must include string ids/i);
  });

  it("rejects duplicate ids inside id-backed backup sections", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        students: [
          {
            id: "student-duplicate",
            firstName: "Ari",
            lastName: "Nguyen",
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          },
          {
            id: "student-duplicate",
            firstName: "Mina",
            lastName: "Park",
            phone: "(262) 555-0102",
            email: "mina@example.com",
            status: "Active",
            beltRank: "White",
            classesAttended: 3,
            missedClassCount: 0,
            joinedAt: "2026-02-01"
          }
        ]
      }
    }))).toThrow(/students entries must have unique ids/i);
  });

  it("rejects student backup records without required workflow fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        students: [
          {
            id: "student-missing-phone",
            firstName: "Ari",
            lastName: "Nguyen",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          }
        ]
      }
    }))).toThrow(/students entries must include required string workflow fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        students: [
          {
            id: "student-bad-counts",
            firstName: "Ari",
            lastName: "Nguyen",
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: "12",
            missedClassCount: -1,
            joinedAt: "2026-01-01"
          }
        ]
      }
    }))).toThrow(/students entries must include nonnegative numeric attendance fields/i);
  });

  it("exports student records with restorable identity and attendance fields", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [
          {
            id: " student-ari ",
            firstName: " Ari ",
            lastName: " Nguyen ",
            phone: " (262) 555-0101 ",
            email: " ari@example.com ",
            status: " Active ",
            beltRank: " Yellow ",
            classesAttended: "12",
            missedClassCount: -1,
            joinedAt: " 2026-01-01 ",
            notes: " Needs a belt test reminder. ",
            studentSmsConsentUpdatedAt: " 2026-05-20T10:00:00.000Z ",
            guardianSmsConsentUpdatedAt: " 2026-05-21T11:00:00.000Z ",
            smsConsentUpdatedAt: " 2026-05-19T09:00:00.000Z "
          },
          {
            id: "student-mina",
            firstName: "Mina",
            lastName: "Park",
            phone: "(262) 555-0102",
            email: "mina@example.com",
            status: "Inactive",
            beltRank: "White",
            classesAttended: 3.8,
            missedClassCount: Number.NaN,
            joinedAt: "2026-02-01"
          },
          {
            id: "student-missing-email",
            firstName: "No",
            lastName: "Email",
            phone: "(262) 555-0103",
            email: " ",
            status: "Active",
            beltRank: "White",
            classesAttended: 1,
            missedClassCount: 0,
            joinedAt: "2026-03-01"
          },
          {
            id: "student-ari",
            firstName: "Duplicate",
            lastName: "Student",
            phone: "(262) 555-0104",
            email: "duplicate@example.com",
            status: "Active",
            beltRank: "Blue",
            classesAttended: 8,
            missedClassCount: 0,
            joinedAt: "2026-04-01"
          }
        ] as OperationsBackupInput["students"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.students).toEqual([
      expect.objectContaining({
        id: "student-ari",
        firstName: "Ari",
        lastName: "Nguyen",
        phone: "(262) 555-0101",
        email: "ari@example.com",
        status: "Active",
        beltRank: "Yellow",
        classesAttended: 12,
        missedClassCount: 0,
        joinedAt: "2026-01-01",
        notes: "Needs a belt test reminder.",
        studentSmsConsentUpdatedAt: "2026-05-20T10:00:00.000Z",
        guardianSmsConsentUpdatedAt: "2026-05-21T11:00:00.000Z",
        smsConsentUpdatedAt: "2026-05-19T09:00:00.000Z"
      }),
      expect.objectContaining({
        id: "student-mina",
        classesAttended: 3,
        missedClassCount: 0
      })
    ]);
    expect(snapshot.sections.find((section) => section.id === "students")).toEqual(expect.objectContaining({ count: 2 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.students).toHaveLength(2);
  });

  it("rejects merchandise backup records without required inventory fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        merchandiseItems: [
          {
            id: "merch-missing-category",
            name: "Youth Gloves",
            price: 39,
            stock: 6,
            description: "Starter gloves.",
            imageLabel: "gloves"
          }
        ]
      }
    }))).toThrow(/merchandiseItems entries must include required string inventory fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        merchandiseItems: [
          {
            id: "merch-bad-stock",
            name: "Youth Gloves",
            category: "Gloves",
            price: "39",
            stock: -1,
            reorderPoint: -2,
            targetStock: "8",
            description: "Starter gloves.",
            imageLabel: "gloves"
          }
        ]
      }
    }))).toThrow(/merchandiseItems entries must include nonnegative numeric inventory fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        merchandiseItems: [
          {
            id: "merch-bad-thresholds",
            name: "Youth Gloves",
            category: "Gloves",
            price: 39,
            stock: 2,
            reorderPoint: 8,
            targetStock: 8,
            description: "Starter gloves.",
            imageLabel: "gloves"
          }
        ]
      })
    ))).toThrow(/merchandiseItems entries must use target stock above reorder point/i);
  });

  it("rejects merchandise backup records with malformed inventory metadata", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        merchandiseItems: [
          {
            id: "merch-gloves",
            name: " Youth Boxing Gloves ",
            category: "Gloves",
            price: 39,
            stock: 2,
            reorderPoint: 3,
            targetStock: 8,
            description: "Youth 6oz gloves for bag work.",
            imageLabel: "gloves"
          }
        ]
      })
    ))).toThrow(/merchandiseItems entries must include valid inventory fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        merchandiseItems: [
          {
            id: "merch-unsafe-image",
            name: "Youth Boxing Gloves",
            category: "Gloves",
            price: 39,
            stock: 2,
            reorderPoint: 3,
            targetStock: 8,
            description: "Youth 6oz gloves for bag work.",
            imageLabel: "gloves",
            imageDataUrl: "data:text/html,<script>alert(1)</script>"
          }
        ]
      })
    ))).toThrow(/merchandiseItems entries must include valid inventory fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        merchandiseItems: [
          {
            id: "merch-bad-restock",
            name: "Youth Boxing Gloves",
            category: "Gloves",
            price: 39,
            stock: 2,
            reorderPoint: 3,
            targetStock: 8,
            description: "Youth 6oz gloves for bag work.",
            imageLabel: "gloves",
            lastRestockedAt: 42
          }
        ]
      })
    ))).toThrow(/merchandiseItems entries must include valid inventory fields/i);
  });

  it("exports merchandise inventory with restorable stock thresholds", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        merchandiseItems: [
          {
            id: "merch-gloves",
            name: "Youth Boxing Gloves",
            category: "Gloves",
            price: 39,
            stock: 2,
            reorderPoint: 3,
            targetStock: 8,
            description: "Youth 6oz gloves for bag work.",
            imageLabel: "gloves"
          },
          {
            id: "merch-bad-optional-thresholds",
            name: "White Basic Uniform",
            category: "Uniforms",
            price: 39,
            stock: 10,
            reorderPoint: -2,
            targetStock: "8",
            description: "Starter uniform with Cho's logo patches.",
            imageLabel: "uniform"
          },
          {
            id: "merch-target-too-low",
            name: "Cho's Training Shirt",
            category: "Apparel",
            price: 24,
            stock: 4,
            reorderPoint: 6,
            targetStock: 6,
            description: "Breathable shirt for daily practice.",
            imageLabel: "shirt"
          }
        ] as OperationsBackupInput["merchandiseItems"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.merchandiseItems).toEqual([
      expect.objectContaining({ id: "merch-gloves", reorderPoint: 3, targetStock: 8 }),
      expect.objectContaining({ id: "merch-bad-optional-thresholds", reorderPoint: 0, targetStock: 8 }),
      expect.objectContaining({ id: "merch-target-too-low", reorderPoint: 6, targetStock: 7 })
    ]);
    expect(snapshot.sections.find((section) => section.id === "merchandiseItems")).toEqual(expect.objectContaining({ count: 3 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.merchandiseItems).toHaveLength(3);
  });

  it("exports merchandise inventory with restorable product fields", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        merchandiseItems: [
          {
            id: " merch-gloves ",
            name: " Youth Boxing Gloves ",
            category: " Gloves ",
            price: "39.99",
            stock: "2.9",
            reorderPoint: "3",
            targetStock: "8",
            description: " Youth 6oz gloves for bag work. ",
            imageLabel: " gloves ",
            imageDataUrl: " data:image/png;base64,AAAA ",
            lastRestockedAt: " 2026-06-01T09:00:00.000Z "
          },
          {
            id: "merch-missing-name",
            name: " ",
            category: "Gloves",
            price: 39,
            stock: 2,
            description: "Missing name should not restore.",
            imageLabel: "gloves"
          },
          {
            id: "merch-bad-price",
            name: "Bad Price",
            category: "Gloves",
            price: -1,
            stock: 2,
            description: "Bad price should not restore.",
            imageLabel: "gloves"
          },
          {
            id: "merch-unsafe-image",
            name: "Unsafe Image",
            category: "Gloves",
            price: 39,
            stock: 2,
            description: "Unsafe image should be stripped.",
            imageLabel: "gloves",
            imageDataUrl: "data:text/html,<script>alert(1)</script>"
          },
          {
            id: "merch-duplicate",
            name: "Duplicate One",
            category: "Uniforms",
            price: 39,
            stock: 10,
            description: "First duplicate wins.",
            imageLabel: "uniform"
          },
          {
            id: " merch-duplicate ",
            name: "Duplicate Two",
            category: "Uniforms",
            price: 49,
            stock: 5,
            description: "Second duplicate is dropped.",
            imageLabel: "uniform"
          }
        ] as OperationsBackupInput["merchandiseItems"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.merchandiseItems).toEqual([
      expect.objectContaining({
        id: "merch-gloves",
        name: "Youth Boxing Gloves",
        category: "Gloves",
        price: 39.99,
        stock: 2,
        reorderPoint: 3,
        targetStock: 8,
        description: "Youth 6oz gloves for bag work.",
        imageLabel: "gloves",
        imageDataUrl: "data:image/png;base64,AAAA",
        lastRestockedAt: "2026-06-01T09:00:00.000Z"
      }),
      expect.objectContaining({
        id: "merch-unsafe-image",
        name: "Unsafe Image",
        price: 39,
        stock: 2
      }),
      expect.objectContaining({
        id: "merch-duplicate",
        name: "Duplicate One"
      })
    ]);
    expect(snapshot.data.merchandiseItems[1]).not.toHaveProperty("imageDataUrl");
    expect(snapshot.sections.find((section) => section.id === "merchandiseItems")).toEqual(expect.objectContaining({ count: 3 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.merchandiseItems).toHaveLength(3);
  });

  it("rejects order backup records without required commerce fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        orders: [
          {
            id: "order-missing-customer",
            orderNumber: "CHOS-2026-0001",
            createdAt: "2026-06-01T10:00:00.000Z",
            items: [],
            subtotal: 0,
            discount: 0,
            tax: 0,
            total: 0,
            notes: "",
            pickupOption: "In-store pickup and fitting at Cho's Martial Arts",
            status: "Ready for in-store pickup coordination"
          }
        ]
      }
    }))).toThrow(/orders entries must include required commerce fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        orders: [
          {
            id: "order-bad-total",
            orderNumber: "CHOS-2026-0001",
            createdAt: "2026-06-01T10:00:00.000Z",
            customer: {
              firstName: "Ari",
              lastName: "Nguyen",
              email: "ari@example.com",
              phone: "(262) 555-0101",
              address: "N89W16863 Appleton Ave",
              city: "Menomonee Falls",
              state: "WI",
              zip: "53051"
            },
            items: {},
            subtotal: 39,
            discount: -1,
            tax: "1.95",
            total: Number.NaN,
            notes: "",
            pickupOption: "In-store pickup and fitting at Cho's Martial Arts",
            status: "Ready for in-store pickup coordination"
          }
        ]
      }
    }))).toThrow(/orders entries must include valid commerce totals and items/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        orders: [
          {
            id: "order-empty-items",
            orderNumber: "CHOS-2026-0002",
            createdAt: "2026-06-01T10:00:00.000Z",
            customer: {
              firstName: "Ari",
              lastName: "Nguyen",
              email: "ari@example.com",
              phone: "(262) 555-0101",
              address: "N89W16863 Appleton Ave",
              city: "Menomonee Falls",
              state: "WI",
              zip: "53051"
            },
            items: [],
            subtotal: 0,
            discount: 0,
            tax: 0,
            total: 0,
            notes: "",
            pickupOption: "In-store pickup and fitting at Cho's Martial Arts",
            status: "Ready for in-store pickup coordination"
          }
        ]
      })
    ))).toThrow(/orders entries must include valid commerce totals and items/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        orders: [
          {
            id: "order-mismatched-totals",
            orderNumber: "CHOS-2026-0003",
            createdAt: "2026-06-01T10:00:00.000Z",
            customer: {
              firstName: "Ari",
              lastName: "Nguyen",
              email: "ari@example.com",
              phone: "(262) 555-0101",
              address: "N89W16863 Appleton Ave",
              city: "Menomonee Falls",
              state: "WI",
              zip: "53051"
            },
            items: [
              {
                id: "cart-gloves",
                productSlug: "youth-boxing-gloves",
                name: "Youth Boxing Gloves",
                unitPrice: 39,
                displayPrice: "$39.00",
                quantity: 2
              }
            ],
            subtotal: 40,
            discount: 0,
            tax: 2,
            total: 42,
            notes: "",
            pickupOption: "In-store pickup and fitting at Cho's Martial Arts",
            status: "Ready for in-store pickup coordination"
          }
        ]
      })
    ))).toThrow(/orders entries must include valid commerce totals and items/i);
  });

  it("exports orders with restorable commerce totals and items", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        orders: [
          {
            id: " order-stale-totals ",
            orderNumber: " CHOS-2026-0004 ",
            createdAt: " 2026-06-01T10:00:00.000Z ",
            customer: {
              firstName: " Ari ",
              lastName: " Nguyen ",
              email: " ari@example.com ",
              phone: " (262) 555-0101 ",
              address: " N89W16863 Appleton Ave ",
              city: " Menomonee Falls ",
              state: " WI ",
              zip: " 53051 "
            },
            items: [
              {
                id: " cart-gloves ",
                productSlug: " youth-boxing-gloves ",
                name: " Youth Boxing Gloves ",
                unitPrice: 39,
                displayPrice: " $39.00 ",
                quantity: 2
              }
            ],
            subtotal: 40,
            discount: 0,
            tax: 2,
            total: 42,
            notes: " Please hold for pickup. ",
            pickupOption: " In-store pickup and fitting at Cho's Martial Arts ",
            status: " Ready for in-store pickup coordination "
          },
          {
            id: "order-empty-items",
            orderNumber: "CHOS-2026-0005",
            createdAt: "2026-06-01T10:10:00.000Z",
            customer: {
              firstName: "Ari",
              lastName: "Nguyen",
              email: "ari@example.com",
              phone: "(262) 555-0101",
              address: "N89W16863 Appleton Ave",
              city: "Menomonee Falls",
              state: "WI",
              zip: "53051"
            },
            items: [],
            subtotal: 0,
            discount: 0,
            tax: 0,
            total: 0,
            notes: "",
            pickupOption: "In-store pickup and fitting at Cho's Martial Arts",
            status: "Ready for in-store pickup coordination"
          },
          {
            id: "order-missing-customer",
            orderNumber: "CHOS-2026-0006",
            createdAt: "2026-06-01T10:20:00.000Z",
            customer: {
              firstName: "Ari",
              lastName: "Nguyen",
              email: "ari@example.com",
              phone: "",
              address: "N89W16863 Appleton Ave",
              city: "Menomonee Falls",
              state: "WI",
              zip: "53051"
            },
            items: [
              {
                id: "cart-uniform",
                productSlug: "white-basic-uniform",
                name: "White Basic Uniform",
                unitPrice: 39,
                displayPrice: "$39.00",
                quantity: 1
              }
            ],
            subtotal: 39,
            discount: 0,
            tax: 1.95,
            total: 40.95,
            notes: "",
            pickupOption: "In-store pickup and fitting at Cho's Martial Arts",
            status: "Ready for in-store pickup coordination"
          }
        ] as OperationsBackupInput["orders"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.orders).toEqual([
      expect.objectContaining({
        id: "order-stale-totals",
        orderNumber: "CHOS-2026-0004",
        subtotal: 78,
        discount: 0,
        tax: 3.9,
        total: 81.9,
        notes: "Please hold for pickup.",
        pickupOption: "In-store pickup and fitting at Cho's Martial Arts",
        status: "Ready for in-store pickup coordination",
        customer: {
          firstName: "Ari",
          lastName: "Nguyen",
          email: "ari@example.com",
          phone: "(262) 555-0101",
          address: "N89W16863 Appleton Ave",
          city: "Menomonee Falls",
          state: "WI",
          zip: "53051"
        },
        items: [
          expect.objectContaining({
            id: "cart-gloves",
            productSlug: "youth-boxing-gloves",
            name: "Youth Boxing Gloves",
            unitPrice: 39,
            displayPrice: "$39.00",
            quantity: 2
          })
        ]
      })
    ]);
    expect(snapshot.sections.find((section) => section.id === "orders")).toEqual(expect.objectContaining({ count: 1 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.orders).toHaveLength(1);
  });

  it("rejects booking and contact backup records without required customer fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        bookings: [
          {
            persons: 0,
            date: "2026-06-06",
            time: "10:00 AM",
            timezone: "America/Denver"
          }
        ]
      }
    }))).toThrow(/bookings entries must include valid starter booking fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        contacts: [
          {
            id: "contact-missing-message",
            name: "Ari Nguyen",
            email: "ari@example.com",
            phone: "(262) 555-0101",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/contacts entries must include required lead fields/i);
  });

  it("rejects restored lead backups with hidden whitespace or malformed contact fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(makeBackupPayload({
      bookings: [
        {
          persons: 1,
          date: " 2026-06-06",
          time: "10:00 AM",
          timezone: "America/Chicago"
        }
      ]
    })))).toThrow(/bookings entries must include valid starter booking fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(makeBackupPayload({
      bookings: [
        {
          persons: 1,
          date: "2026-06-06",
          time: "10:00 AM ",
          timezone: "America/Chicago"
        }
      ]
    })))).toThrow(/bookings entries must include valid starter booking fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(makeBackupPayload({
      contacts: [
        {
          id: "contact-padded-name",
          name: " Ari Nguyen",
          email: "ari@example.com",
          phone: "",
          message: "I want to restart classes.",
          createdAt: "2026-06-01T10:00:00.000Z"
        }
      ]
    })))).toThrow(/contacts entries must include valid lead fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(makeBackupPayload({
      contacts: [
        {
          id: "contact-invalid-phone",
          name: "Ari Nguyen",
          email: "ari@example.com",
          phone: 2625550101,
          message: "I want to restart classes.",
          createdAt: "2026-06-01T10:00:00.000Z"
        }
      ]
    })))).toThrow(/contacts entries must include valid lead fields/i);
  });

  it("restores lead contacts with either email or phone", () => {
    const parsed = parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        contacts: [
          {
            id: "contact-email-only",
            name: "Ari Nguyen",
            email: "ari@example.com",
            phone: "",
            message: "I want to restart classes.",
            createdAt: "2026-06-01T10:00:00.000Z"
          },
          {
            id: "contact-phone-only",
            name: "Mina Cho",
            email: "",
            phone: "(262) 555-0102",
            message: "Can we schedule a starter session?",
            createdAt: "2026-06-01T10:05:00.000Z"
          }
        ]
      })
    ));

    expect(parsed.data.contacts).toEqual([
      expect.objectContaining({ id: "contact-email-only", email: "ari@example.com", phone: "" }),
      expect.objectContaining({ id: "contact-phone-only", email: "", phone: "(262) 555-0102" })
    ]);
  });

  it("exports lead contacts without unusable contact records", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        contacts: [
          {
            id: " contact-email-only ",
            name: " Ari Nguyen ",
            email: " ari@example.com ",
            phone: " ",
            message: " I want to restart classes. ",
            createdAt: " 2026-06-01T10:00:00.000Z "
          },
          {
            id: "contact-phone-only",
            name: "Mina Cho",
            email: "",
            phone: "(262) 555-0102",
            message: "Can we schedule a starter session?",
            createdAt: "2026-06-01T10:05:00.000Z"
          },
          {
            id: "contact-no-method",
            name: "No Method",
            email: " ",
            phone: " ",
            message: "There is no way to follow up.",
            createdAt: "2026-06-01T10:10:00.000Z"
          },
          {
            id: "contact-no-message",
            name: "Quiet Lead",
            email: "quiet@example.com",
            phone: "",
            message: " ",
            createdAt: "2026-06-01T10:15:00.000Z"
          }
        ] as OperationsBackupInput["contacts"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.contacts).toEqual([
      {
        id: "contact-email-only",
        name: "Ari Nguyen",
        email: "ari@example.com",
        phone: "",
        message: "I want to restart classes.",
        createdAt: "2026-06-01T10:00:00.000Z"
      },
      {
        id: "contact-phone-only",
        name: "Mina Cho",
        email: "",
        phone: "(262) 555-0102",
        message: "Can we schedule a starter session?",
        createdAt: "2026-06-01T10:05:00.000Z"
      }
    ]);
    expect(snapshot.sections.find((section) => section.id === "contacts")).toEqual(expect.objectContaining({ count: 2 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.contacts).toHaveLength(2);
  });

  it("exports starter bookings with restorable count and timezone metadata", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        bookings: [
          {
            persons: 2,
            date: "2026-06-06",
            time: "10:00 AM",
            timezone: "America/Chicago"
          },
          {
            persons: 0,
            date: "2026-06-07",
            time: "11:30 AM",
            timezone: "America/Denver"
          },
          {
            persons: 3,
            date: "2026-06-08",
            time: " ",
            timezone: "America/Chicago"
          }
        ] as OperationsBackupInput["bookings"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.bookings).toEqual([
      { persons: 2, date: "2026-06-06", time: "10:00 AM", timezone: "America/Chicago" },
      { persons: 1, date: "2026-06-07", time: "11:30 AM", timezone: "America/Chicago" }
    ]);
    expect(snapshot.sections.find((section) => section.id === "bookings")).toEqual(expect.objectContaining({ count: 2 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.bookings).toHaveLength(2);
  });

  it("restores reviewed lead metadata from maintenance backups", () => {
    const parsed = parseOperationsBackupSnapshot(JSON.stringify(makeBackupPayload({
      leadReviews: [
        {
          id: "review-contact-ari",
          leadId: "contact-ari",
          kind: "contact",
          label: "Ari Nguyen",
          reviewedAt: "2026-06-01T11:00:00.000Z"
        },
        {
          id: "review-booking-ari",
          leadId: "booking-2026-06-03-5-30-pm-0",
          kind: "booking",
          label: "Starter booking 2026-06-03",
          reviewedAt: "2026-06-01T11:05:00.000Z"
        }
      ]
    })));

    expect((parsed.data as { leadReviews?: unknown }).leadReviews).toEqual([
      {
        id: "review-contact-ari",
        leadId: "contact-ari",
        kind: "contact",
        label: "Ari Nguyen",
        reviewedAt: "2026-06-01T11:00:00.000Z"
      },
      {
        id: "review-booking-ari",
        leadId: "booking-2026-06-03-5-30-pm-0",
        kind: "booking",
        label: "Starter booking 2026-06-03",
        reviewedAt: "2026-06-01T11:05:00.000Z"
      }
    ]);
  });

  it("rejects malformed reviewed lead metadata in maintenance backups", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(makeBackupPayload({
      leadReviews: [
        {
          id: "review-contact-ari",
          leadId: " contact-ari",
          kind: "contact",
          label: "Ari Nguyen",
          reviewedAt: "2026-06-01T11:00:00.000Z"
        }
      ]
    })))).toThrow(/leadReviews entries must include valid reviewed lead fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(makeBackupPayload({
      leadReviews: [
        {
          id: "review-booking-ari",
          leadId: "booking-2026-06-03-5-30-pm-0",
          kind: "archived",
          label: "Starter booking 2026-06-03",
          reviewedAt: "2026-06-01T11:05:00.000Z"
        }
      ]
    })))).toThrow(/leadReviews entries must include valid reviewed lead fields/i);
  });

  it("rejects message log backup records without required outreach fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        messageLogs: [
          {
            id: "message-missing-phone",
            kind: "follow-up",
            recipientName: "Ari Nguyen",
            body: "We missed you in class.",
            status: "queued",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/messageLogs entries must include required outreach fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        messageLogs: [
          {
            id: "message-invalid-kind",
            kind: "invoice",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "We missed you in class.",
            status: "queued",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/messageLogs entries must use supported outreach kinds/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        messageLogs: [
          {
            id: "message-invalid-status",
            kind: "follow-up",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "We missed you in class.",
            status: "pending",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/messageLogs entries must use supported delivery statuses/i);
  });

  it("rejects restored outreach records with malformed text fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        messageCampaigns: [
          {
            id: "campaign-summer",
            title: " Summer training ",
            body: "Keep training this summer.",
            audience: "all-students",
            createdAt: "2026-06-01T09:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/messageCampaigns entries must include valid campaign fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        messageLogs: [
          {
            id: "message-ari-sent",
            kind: "follow-up",
            recipientName: " Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "Historical note.",
            status: "sent",
            sentAt: "2026-06-01T10:05:00.000Z",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/messageLogs entries must include valid outreach fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        messageCampaigns: [
          {
            id: "campaign-summer",
            title: "Summer training",
            body: "Keep training this summer.",
            audience: "all-students",
            createdAt: "2026-06-01T09:00:00.000Z"
          }
        ],
        messageLogs: [
          {
            id: "message-bad-campaign",
            kind: "marketing",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "Keep training.",
            status: "sent",
            campaignId: 42,
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/messageLogs entries must include valid outreach fields/i);
  });

  it("rejects restored queued message logs without active student recipients", () => {
    const activeStudent = {
      id: "student-ari",
      firstName: "Ari",
      lastName: "Nguyen",
      phone: "(262) 555-0101",
      email: "ari@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const inactiveStudent = {
      ...activeStudent,
      id: "student-cora",
      firstName: "Cora",
      lastName: "Miles",
      phone: "(262) 555-0103",
      email: "cora@example.com",
      status: "Inactive"
    };

    const historicalSentMessage = parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [activeStudent, inactiveStudent],
        messageLogs: [
          {
            id: "message-cora-sent",
            kind: "follow-up",
            recipientName: "Cora Miles",
            recipientPhone: "(262) 555-0103",
            body: "Historical message.",
            status: "sent",
            sentAt: "2026-06-01T10:05:00.000Z",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ));
    expect(historicalSentMessage.data.messageLogs).toHaveLength(1);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [activeStudent, inactiveStudent],
        messageLogs: [
          {
            id: "message-cora-queued",
            kind: "follow-up",
            recipientName: "Cora Miles",
            recipientPhone: "(262) 555-0103",
            body: "Stale queued message.",
            status: "queued",
            createdAt: "2026-06-02T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/queued messageLogs entries can only reference restored active recipients/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [activeStudent],
        messageLogs: [
          {
            id: "message-noah-queued",
            kind: "profile-update",
            recipientName: "Noah Woods",
            recipientPhone: "(262) 555-0104",
            body: "Missing student message.",
            status: "queued",
            createdAt: "2026-06-02T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/queued messageLogs entries can only reference restored active recipients/i);
  });

  it("exports only restorable queued text logs while preserving sent history", () => {
    const activeStudent = {
      id: "student-ari",
      firstName: "Ari",
      lastName: "Nguyen",
      phone: "(262) 555-0101",
      email: "ari@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const inactiveStudent = {
      ...activeStudent,
      id: "student-cora",
      firstName: "Cora",
      lastName: "Miles",
      phone: "(262) 555-0103",
      email: "cora@example.com",
      status: "Inactive"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent, inactiveStudent],
        messageLogs: [
          {
            id: "message-ari-queued",
            kind: "follow-up",
            recipientName: "Ari Nguyen",
            recipientPhone: "2625550101",
            body: "Ari needs a check-in.",
            status: "queued",
            createdAt: "2026-06-02T10:00:00.000Z"
          },
          {
            id: "message-cora-queued",
            kind: "follow-up",
            recipientName: "Cora Miles",
            recipientPhone: "(262) 555-0103",
            body: "Cora has stale outreach.",
            status: "queued",
            createdAt: "2026-06-02T10:05:00.000Z"
          },
          {
            id: "message-noah-queued",
            kind: "profile-update",
            recipientName: "Noah Woods",
            recipientPhone: "(262) 555-0104",
            body: "Noah is no longer listed.",
            status: "queued",
            createdAt: "2026-06-02T10:10:00.000Z"
          },
          {
            id: "message-cora-sent",
            kind: "follow-up",
            recipientName: "Cora Miles",
            recipientPhone: "(262) 555-0103",
            body: "Historical Cora message.",
            status: "sent",
            createdAt: "2026-06-01T10:00:00.000Z",
            sentAt: "2026-06-01T10:05:00.000Z"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.messageLogs).toEqual([
      expect.objectContaining({ id: "message-ari-queued", status: "queued" }),
      expect.objectContaining({ id: "message-cora-sent", status: "sent" })
    ]);
    expect(snapshot.sections.find((section) => section.id === "messageLogs")).toEqual(expect.objectContaining({ count: 2 }));
    expect(snapshot.summary.totalRecords).toBe(4);
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.messageLogs).toHaveLength(2);
  });

  it("preserves restorable queued parent and staff text logs in operations backups", () => {
    const activeStudent = {
      id: "student-ari",
      firstName: "Ari",
      lastName: "Nguyen",
      phone: "(262) 555-0101",
      email: "ari@example.com",
      guardianName: "Mina Nguyen",
      guardianPhone: "(262) 555-1101",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const staffAccount = {
      id: "staff-kim",
      displayName: "Coach Kim",
      username: "coach.kim",
      password: "staff-password",
      role: "staff",
      status: "active",
      email: "coach.kim@example.com",
      phone: "(262) 555-2101",
      access: ["messages"],
      createdAt: "2026-05-01T10:00:00.000Z"
    } satisfies OperationsBackupInput["managedAccounts"][number];
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent],
        managedAccounts: [staffAccount],
        messageLogs: [
          {
            id: "message-parent-queued",
            kind: "marketing",
            recipientName: "Mina Nguyen",
            recipientPhone: "+12625551101",
            recipientRole: "parent",
            recipientId: "parent-student-ari",
            body: "Family night starts Friday.",
            status: "queued",
            createdAt: "2026-06-02T10:00:00.000Z"
          },
          {
            id: "message-staff-queued",
            kind: "reminder",
            recipientName: "Coach Kim",
            recipientPhone: "+12625552101",
            recipientRole: "staff",
            recipientId: "staff-kim",
            body: "Please prep for family night.",
            status: "queued",
            createdAt: "2026-06-02T10:05:00.000Z"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.messageLogs).toEqual([
      expect.objectContaining({ id: "message-parent-queued", recipientRole: "parent", recipientId: "parent-student-ari" }),
      expect.objectContaining({ id: "message-staff-queued", recipientRole: "staff", recipientId: "staff-kim" })
    ]);
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.messageLogs).toHaveLength(2);
  });

  it("exports text logs without stale campaign links so backups stay restorable", () => {
    const activeStudent = {
      id: "student-ari",
      firstName: "Ari",
      lastName: "Nguyen",
      phone: "(262) 555-0101",
      email: "ari@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent],
        messageCampaigns: [
          {
            id: "campaign-summer",
            title: "Summer training",
            body: "Keep training this summer.",
            audience: "all-students",
            createdAt: "2026-06-01T09:00:00.000Z"
          }
        ],
        messageLogs: [
          {
            id: "message-valid-campaign",
            kind: "marketing",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "Keep training this summer.",
            status: "queued",
            campaignId: "campaign-summer",
            createdAt: "2026-06-02T10:00:00.000Z"
          },
          {
            id: "message-stale-queued-campaign",
            kind: "follow-up",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "Follow up this week.",
            status: "queued",
            campaignId: "campaign-deleted",
            createdAt: "2026-06-02T10:05:00.000Z"
          },
          {
            id: "message-stale-sent-campaign",
            kind: "marketing",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "Old campaign note.",
            status: "sent",
            campaignId: "campaign-archived",
            createdAt: "2026-06-01T10:00:00.000Z",
            sentAt: "2026-06-01T10:05:00.000Z"
          },
          {
            id: "message-standalone-sent",
            kind: "celebration",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "Great job at testing.",
            status: "sent",
            createdAt: "2026-06-01T11:00:00.000Z",
            sentAt: "2026-06-01T11:05:00.000Z"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.messageLogs).toEqual([
      expect.objectContaining({ id: "message-valid-campaign", campaignId: "campaign-summer" }),
      expect.objectContaining({ id: "message-stale-queued-campaign" }),
      expect.objectContaining({ id: "message-stale-sent-campaign" }),
      expect.objectContaining({ id: "message-standalone-sent" })
    ]);
    expect(snapshot.data.messageLogs[1]).not.toHaveProperty("campaignId");
    expect(snapshot.data.messageLogs[2]).not.toHaveProperty("campaignId");
    expect(snapshot.data.messageLogs[3]).not.toHaveProperty("campaignId");
    expect(snapshot.sections.find((section) => section.id === "messageLogs")).toEqual(expect.objectContaining({ count: 4 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.messageLogs).toHaveLength(4);
  });

  it("exports text logs without links to invalid message campaigns", () => {
    const activeStudent = {
      id: "student-ari",
      firstName: "Ari",
      lastName: "Nguyen",
      phone: "(262) 555-0101",
      email: "ari@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent],
        messageCampaigns: [
          {
            id: "campaign-summer",
            title: "Summer training",
            body: "Keep training this summer.",
            audience: "all-students",
            createdAt: "2026-06-01T09:00:00.000Z"
          },
          {
            id: "campaign-empty-title",
            title: " ",
            body: "This campaign title was corrupted.",
            audience: "all-students",
            createdAt: "2026-06-01T09:05:00.000Z"
          },
          {
            id: "campaign-unsupported-audience",
            title: "Family blast",
            body: "Unsupported audience should not restore.",
            audience: "all-families",
            createdAt: "2026-06-01T09:10:00.000Z"
          }
        ] as OperationsBackupInput["messageCampaigns"],
        messageLogs: [
          {
            id: "message-valid-campaign",
            kind: "marketing",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "Keep training this summer.",
            status: "queued",
            campaignId: "campaign-summer",
            createdAt: "2026-06-02T10:00:00.000Z"
          },
          {
            id: "message-invalid-campaign",
            kind: "marketing",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "Unsupported audience should not restore.",
            status: "queued",
            campaignId: "campaign-unsupported-audience",
            createdAt: "2026-06-02T10:05:00.000Z"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.messageCampaigns).toEqual([
      expect.objectContaining({ id: "campaign-summer", audience: "all-students" })
    ]);
    expect(snapshot.data.messageLogs).toEqual([
      expect.objectContaining({ id: "message-valid-campaign", campaignId: "campaign-summer" }),
      expect.objectContaining({ id: "message-invalid-campaign" })
    ]);
    expect(snapshot.data.messageLogs[1]).not.toHaveProperty("campaignId");
    expect(snapshot.sections.find((section) => section.id === "messageCampaigns")).toEqual(expect.objectContaining({ count: 1 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.messageCampaigns).toHaveLength(1);
  });

  it("preserves valid scheduled text promotions in operations backups", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        messageCampaigns: [
          {
            id: "campaign-summer",
            title: "Summer training",
            body: "Keep training this summer.",
            audience: "parents",
            createdAt: "2026-06-01T09:00:00.000Z"
          }
        ],
        scheduledTextCampaigns: [
          {
            id: "scheduled-family-sale",
            title: "Family gear sale",
            body: "Family gear sale starts tonight at 5 PM.",
            audience: "parents",
            scheduledFor: "2026-06-03",
            scheduledTime: "17:00",
            status: "scheduled",
            createdAt: "2026-06-01T09:00:00.000Z"
          },
          {
            id: "scheduled-queued",
            title: "Queued sale",
            body: "Queued family gear sale.",
            audience: "parents",
            scheduledFor: "2026-06-02",
            scheduledTime: "09:00",
            status: "queued",
            createdAt: "2026-06-01T09:05:00.000Z",
            queuedAt: "2026-06-02T09:00:00.000Z",
            campaignId: "campaign-summer"
          },
          {
            id: "scheduled-invalid",
            title: " ",
            body: "Invalid scheduled promotion should drop.",
            audience: "parents",
            scheduledFor: "2026-06-02",
            status: "scheduled",
            createdAt: "2026-06-01T09:10:00.000Z"
          },
          {
            id: "scheduled-invalid-time",
            title: "Invalid send time",
            body: "Invalid scheduled promotion time should drop.",
            audience: "parents",
            scheduledFor: "2026-06-02",
            scheduledTime: "99:99",
            status: "scheduled",
            createdAt: "2026-06-01T09:15:00.000Z"
          }
        ] as OperationsBackupInput["scheduledTextCampaigns"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.scheduledTextCampaigns).toEqual([
      expect.objectContaining({ id: "scheduled-family-sale", scheduledTime: "17:00", status: "scheduled", audience: "parents" }),
      expect.objectContaining({ id: "scheduled-queued", scheduledTime: "09:00", status: "queued", campaignId: "campaign-summer", queuedAt: "2026-06-02T09:00:00.000Z" })
    ]);
    expect(snapshot.sections.find((section) => section.id === "scheduledTextCampaigns")).toEqual(expect.objectContaining({ count: 2 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.scheduledTextCampaigns).toHaveLength(2);
  });

  it("exports outreach campaigns and text logs with restorable fields", () => {
    const activeStudent = {
      id: "student-ari",
      firstName: "Ari",
      lastName: "Nguyen",
      phone: "(262) 555-0101",
      email: "ari@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent],
        messageCampaigns: [
          {
            id: " campaign-summer ",
            title: " Summer training ",
            body: " Keep training this summer. ",
            audience: "all-students",
            createdAt: " 2026-06-01T09:00:00.000Z "
          },
          {
            id: "campaign-empty-body",
            title: "Empty body",
            body: " ",
            audience: "all-students",
            createdAt: "2026-06-01T09:05:00.000Z"
          },
          {
            id: "campaign-duplicate",
            title: "Duplicate One",
            body: "First duplicate wins.",
            audience: "all-students",
            createdAt: "2026-06-01T09:10:00.000Z"
          },
          {
            id: " campaign-duplicate ",
            title: "Duplicate Two",
            body: "Second duplicate is dropped.",
            audience: "all-students",
            createdAt: "2026-06-01T09:15:00.000Z"
          }
        ],
        messageLogs: [
          {
            id: " message-valid-campaign ",
            kind: " marketing ",
            recipientName: " Ari Nguyen ",
            recipientPhone: " (262) 555-0101 ",
            body: " Keep training this summer. ",
            status: " queued ",
            campaignId: " campaign-summer ",
            createdAt: " 2026-06-02T10:00:00.000Z "
          },
          {
            id: "message-sent-history",
            kind: "follow-up",
            recipientName: "Former Student",
            recipientPhone: "(262) 555-0199",
            body: "Historical sent text.",
            status: "sent",
            sentAt: " 2026-06-01T10:05:00.000Z ",
            campaignId: "campaign-missing",
            createdAt: "2026-06-01T10:00:00.000Z"
          },
          {
            id: "message-blank-body",
            kind: "follow-up",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: " ",
            status: "queued",
            createdAt: "2026-06-02T10:05:00.000Z"
          },
          {
            id: "message-duplicate",
            kind: "follow-up",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "First duplicate wins.",
            status: "queued",
            createdAt: "2026-06-02T10:10:00.000Z"
          },
          {
            id: " message-duplicate ",
            kind: "follow-up",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "Second duplicate is dropped.",
            status: "queued",
            createdAt: "2026-06-02T10:15:00.000Z"
          },
          {
            id: "message-invalid-kind",
            kind: "invoice",
            recipientName: "Ari Nguyen",
            recipientPhone: "(262) 555-0101",
            body: "Invalid kind should drop.",
            status: "queued",
            createdAt: "2026-06-02T10:20:00.000Z"
          }
        ] as OperationsBackupInput["messageLogs"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.messageCampaigns).toEqual([
      expect.objectContaining({
        id: "campaign-summer",
        title: "Summer training",
        body: "Keep training this summer.",
        createdAt: "2026-06-01T09:00:00.000Z"
      }),
      expect.objectContaining({
        id: "campaign-duplicate",
        title: "Duplicate One"
      })
    ]);
    expect(snapshot.data.messageLogs).toEqual([
      expect.objectContaining({
        id: "message-valid-campaign",
        kind: "marketing",
        recipientName: "Ari Nguyen",
        recipientPhone: "(262) 555-0101",
        body: "Keep training this summer.",
        status: "queued",
        campaignId: "campaign-summer",
        createdAt: "2026-06-02T10:00:00.000Z"
      }),
      expect.objectContaining({
        id: "message-sent-history",
        status: "sent",
        sentAt: "2026-06-01T10:05:00.000Z"
      }),
      expect.objectContaining({
        id: "message-duplicate",
        body: "First duplicate wins."
      })
    ]);
    expect(snapshot.data.messageLogs[1]).not.toHaveProperty("campaignId");
    expect(snapshot.sections.find((section) => section.id === "messageCampaigns")).toEqual(expect.objectContaining({ count: 2 }));
    expect(snapshot.sections.find((section) => section.id === "messageLogs")).toEqual(expect.objectContaining({ count: 3 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.messageLogs).toHaveLength(3);
  });

  it("rejects class template backup records without valid class fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        studioClasses: [
          {
            id: "class-invalid-weekday",
            name: "Youth Foundations",
            daysOfWeek: [1, 8],
            startTime: "17:00",
            endTime: "17:45"
          }
        ]
      }
    }))).toThrow(/studioClasses entries must include valid class schedule fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        studioClasses: [
          {
            id: "class-invalid-time",
            name: "Family Training",
            daysOfWeek: [2, 4],
            startTime: "18:50",
            endTime: "18:00"
          }
        ]
      }
    }))).toThrow(/studioClasses entries must include valid class schedule fields/i);
  });

  it("exports class templates with restorable schedule fields", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        studioClasses: [
          {
            id: " class-youth ",
            name: " Youth Foundations ",
            daysOfWeek: [1, 1, 4, 9],
            startTime: " 17:00 ",
            endTime: " 17:45 ",
            recurring: "yes",
            titleColor: " #ffcc00 ",
            notes: " Tuesday and Thursday fundamentals "
          },
          {
            id: "class-planning",
            name: "Instructor Planning",
            daysOfWeek: [2],
            startTime: "14:00",
            endTime: "15:00",
            recurring: false
          },
          {
            id: "class-invalid-time",
            name: "Broken Time",
            daysOfWeek: [3],
            startTime: "18:00",
            endTime: "17:00"
          },
          {
            id: "class-invalid-days",
            name: "Broken Days",
            daysOfWeek: [9],
            startTime: "10:00",
            endTime: "11:00"
          }
        ] as OperationsBackupInput["studioClasses"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.studioClasses).toEqual([
      expect.objectContaining({
        id: "class-youth",
        name: "Youth Foundations",
        daysOfWeek: [1, 4],
        startTime: "17:00",
        endTime: "17:45",
        recurring: true,
        titleColor: "#ffcc00",
        notes: "Tuesday and Thursday fundamentals"
      }),
      expect.objectContaining({
        id: "class-planning",
        name: "Instructor Planning",
        daysOfWeek: [2],
        startTime: "14:00",
        endTime: "15:00",
        recurring: false
      })
    ]);
    expect(snapshot.sections.find((section) => section.id === "studioClasses")).toEqual(expect.objectContaining({ count: 2 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.studioClasses).toHaveLength(2);
  });

  it("rejects messaging backup records without required messaging fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        messageCampaigns: [
          {
            id: "campaign-invalid-audience",
            title: "June reminders",
            body: "Keep training this month.",
            audience: "all-families",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/messageCampaigns entries must include valid campaign fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        directMessages: [
          {
            id: "direct-invalid-self",
            threadId: "student-ari__student-ari",
            senderId: "student-ari",
            senderName: "Ari Nguyen",
            recipientId: "student-ari",
            recipientName: "Ari Nguyen",
            body: "Practice notes.",
            createdAt: "2026-06-01T10:00:00.000Z",
            status: "queued"
          }
        ]
      }
    }))).toThrow(/directMessages entries must include valid sent direct message fields/i);
  });

  it("rejects check-in backup records without required attendance fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        students: [
          {
            id: "student-restored",
            firstName: "Ari",
            lastName: "Nguyen",
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          }
        ],
        checkIns: [
          {
            id: "checkin-missing-date",
            studentId: "student-restored",
            studentName: "Ari Nguyen",
            beltRank: "Yellow"
          }
        ]
      }
    }))).toThrow(/checkIns entries must include required attendance fields/i);
  });

  it("rejects duplicate restored check-ins for the same student and date", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [
          {
            id: "student-ari",
            firstName: "Ari",
            lastName: "Nguyen",
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          }
        ],
        checkIns: [
          { id: "checkin-ari-1", studentId: "student-ari", studentName: "Ari Nguyen", date: "2026-06-01", beltRank: "Yellow" },
          { id: "checkin-ari-2", studentId: "student-ari", studentName: "Ari Nguyen", date: "2026-06-01", beltRank: "Yellow" }
        ]
      })
    ))).toThrow(/checkIns entries must have unique student date pairs/i);
  });

  it("exports check-ins without stale student links or duplicate dates", () => {
    const activeStudent = {
      id: "student-active",
      firstName: "Mina",
      lastName: "Cho",
      phone: "(262) 555-0101",
      email: "mina@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const inactiveStudent = {
      ...activeStudent,
      id: "student-inactive",
      firstName: "Ari",
      email: "ari@example.com",
      status: "Inactive"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent, inactiveStudent],
        checkIns: [
          { id: "checkin-active", studentId: "student-active", studentName: "Mina Cho", date: "2026-06-01", beltRank: "Yellow" },
          { id: "checkin-active-duplicate", studentId: "student-active", studentName: "Mina Cho", date: "2026-06-01", beltRank: "Yellow" },
          { id: "checkin-inactive", studentId: "student-inactive", studentName: "Ari Nguyen", date: "2026-06-01", beltRank: "Yellow" },
          { id: "checkin-missing", studentId: "student-missing", studentName: "Missing Student", date: "2026-06-02", beltRank: "White" }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.checkIns).toEqual([
      expect.objectContaining({ id: "checkin-active", studentId: "student-active", date: "2026-06-01" }),
      expect.objectContaining({ id: "checkin-inactive", studentId: "student-inactive", date: "2026-06-01" })
    ]);
    expect(snapshot.data.checkIns).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "checkin-active-duplicate" }),
      expect.objectContaining({ id: "checkin-missing" })
    ]));
    expect(snapshot.sections.find((section) => section.id === "checkIns")).toEqual(expect.objectContaining({ count: 2 }));
    expect(snapshot.summary.totalRecords).toBe(4);
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.checkIns).toHaveLength(2);
  });

  it("rejects calendar backup records without required scheduling fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        scheduledClasses: [
          {
            id: "schedule-missing-time",
            title: "Private Lesson",
            date: "2026-06-03",
            type: "private-lesson"
          }
        ]
      }
    }))).toThrow(/scheduledClasses entries must include required scheduling fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        studioEvents: [
          {
            id: "event-invalid-audience",
            title: "Color Belt Testing",
            date: "2026-06-07",
            time: "10:00 AM",
            details: "Testing",
            audience: "vendors"
          }
        ]
      }
    }))).toThrow(/studioEvents entries must use supported audiences/i);
  });

  it("exports studio events with restorable engagement fields", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        studioEvents: [
          {
            id: " event-testing ",
            title: " Color Belt Testing ",
            date: " 2026-06-07 ",
            time: " 10:00 AM ",
            details: " ",
            audience: "families"
          },
          {
            id: "event-open-house",
            title: "Open House",
            date: "2026-06-14",
            time: "1:00 PM",
            details: "Public demo day.",
            audience: "public"
          },
          {
            id: "event-invalid-audience",
            title: "Vendor Setup",
            date: "2026-06-15",
            time: "9:00 AM",
            details: "Unsupported audience.",
            audience: "vendors"
          },
          {
            id: "event-missing-title",
            title: " ",
            date: "2026-06-16",
            time: "9:00 AM",
            details: "No title should not restore.",
            audience: "students"
          }
        ] as OperationsBackupInput["studioEvents"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.studioEvents).toEqual([
      {
        id: "event-testing",
        title: "Color Belt Testing",
        date: "2026-06-07",
        time: "10:00 AM",
        details: "",
        audience: "families"
      },
      {
        id: "event-open-house",
        title: "Open House",
        date: "2026-06-14",
        time: "1:00 PM",
        details: "Public demo day.",
        audience: "public"
      }
    ]);
    expect(snapshot.sections.find((section) => section.id === "studioEvents")).toEqual(expect.objectContaining({ count: 2 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.studioEvents).toHaveLength(2);
  });

  it("rejects training video backup records without required library fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        trainingVideoFolders: [
          {
            id: "video-folder-missing-subject",
            name: "Forms",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/trainingVideoFolders entries must include required library fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        trainingVideoFolders: [
          { id: "video-folder-restored", name: "Forms", subject: "Beginner Forms", createdAt: "2026-06-01T10:00:00.000Z" }
        ],
        trainingVideos: [
          {
            id: "video-bad-content",
            folderId: "video-folder-restored",
            title: "Roundhouse Basics",
            fileName: "roundhouse.mp4",
            mimeType: "video/mp4",
            size: -1,
            videoDataUrl: "https://example.com/roundhouse.mp4",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      }
    }))).toThrow(/trainingVideos entries must include valid uploaded video fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        trainingVideoFolders: [
          { id: "video-folder-restored", name: "Forms", subject: "Beginner Forms", createdAt: "2026-06-01T10:00:00.000Z" }
        ],
        trainingVideos: [
          {
            id: "video-unsafe-mismatch",
            folderId: "video-folder-restored",
            title: "Unsafe Video",
            fileName: "unsafe.html",
            mimeType: "text/html",
            size: 128,
            videoDataUrl: "data:video/mp4;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/trainingVideos entries must include valid uploaded video fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        trainingVideoFolders: [
          { id: "video-folder-restored", name: "Forms", subject: "Beginner Forms", createdAt: "2026-06-01T10:00:00.000Z" }
        ],
        trainingVideos: [
          {
            id: "video-unsafe-svg",
            folderId: "video-folder-restored",
            title: "Unsafe SVG Video",
            fileName: "unsafe.svg",
            mimeType: "video/svg+xml",
            size: 128,
            videoDataUrl: "data:video/svg+xml,<svg><script>alert(1)</script></svg>",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/trainingVideos entries must include valid uploaded video fields/i);
  });

  it("rejects study guide backup records without required library fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        studyGuideFolders: [
          {
            id: "study-folder-missing-subject",
            name: "White Belt Basics",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/studyGuideFolders entries must include required library fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        studyGuideFolders: [
          { id: "study-folder-restored", name: "White Belt Basics", subject: "Foundations", createdAt: "2026-06-01T10:00:00.000Z" }
        ],
        studyGuideMaterials: [
          {
            id: "study-material-bad-content",
            folderId: "study-folder-restored",
            title: "Front Kick Checklist",
            fileName: "front-kick-notes.pdf",
            mimeType: "application/pdf",
            size: "512",
            fileDataUrl: "",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      }
    }))).toThrow(/studyGuideMaterials entries must include valid uploaded material fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        studyGuideFolders: [
          { id: "study-folder-restored", name: "White Belt Basics", subject: "Foundations", createdAt: "2026-06-01T10:00:00.000Z" }
        ],
        studyGuideMaterials: [
          {
            id: "study-material-unsafe-html",
            folderId: "study-folder-restored",
            title: "Unsafe HTML",
            fileName: "unsafe.html",
            mimeType: "text/html",
            size: 128,
            fileDataUrl: "data:text/html,<script>alert(1)</script>",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/studyGuideMaterials entries must include valid uploaded material fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        studyGuideFolders: [
          { id: "study-folder-restored", name: "White Belt Basics", subject: "Foundations", createdAt: "2026-06-01T10:00:00.000Z" }
        ],
        studyGuideMaterials: [
          {
            id: "study-material-unsafe-mismatch",
            folderId: "study-folder-restored",
            title: "Unsafe Mismatch",
            fileName: "unsafe.pdf",
            mimeType: "application/pdf",
            size: 128,
            fileDataUrl: "data:text/html,<script>alert(1)</script>",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/studyGuideMaterials entries must include valid uploaded material fields/i);
  });

  it("rejects restored library media with hidden whitespace or malformed optional fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        trainingVideoFolders: [
          {
            id: "video-folder-forms",
            name: " Forms ",
            subject: "Beginner Forms",
            description: 42,
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/trainingVideoFolders entries must include valid library fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        trainingVideoFolders: [
          { id: "video-folder-forms", name: "Forms", subject: "Beginner Forms", createdAt: "2026-06-01T10:00:00.000Z" }
        ],
        trainingVideos: [
          {
            id: "video-roundhouse",
            folderId: " video-folder-forms",
            title: "Roundhouse Basics",
            description: 42,
            fileName: "roundhouse.mp4",
            mimeType: "video/mp4",
            size: 512,
            videoDataUrl: "data:video/mp4;base64,AAAA",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/trainingVideos entries must include valid uploaded video fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        studyGuideFolders: [
          {
            id: "study-folder-root",
            name: "White Belt Basics",
            subject: "Foundations",
            parentId: 42,
            createdAt: "2026-06-01T11:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/studyGuideFolders entries must include valid library fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        studyGuideFolders: [
          { id: "study-folder-root", name: "White Belt Basics", subject: "Foundations", createdAt: "2026-06-01T11:00:00.000Z" }
        ],
        studyGuideMaterials: [
          {
            id: "study-material-front-kick",
            folderId: "study-folder-root",
            title: " Front Kick Checklist",
            description: 42,
            fileName: "front-kick.txt",
            mimeType: "text/plain",
            size: 128,
            fileDataUrl: "data:text/plain;base64,SGVscA==",
            createdAt: "2026-06-01T11:15:00.000Z"
          }
        ]
      })
    ))).toThrow(/studyGuideMaterials entries must include valid uploaded material fields/i);
  });

  it("exports library media without stale folder references so backups stay restorable", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        trainingVideoFolders: [
          { id: "video-folder-forms", name: "Forms", subject: "Beginner Forms", createdAt: "2026-06-01T10:00:00.000Z" },
          { id: "video-folder-sparring", name: "Sparring", subject: "Partner Drills", createdAt: "2026-06-01T10:05:00.000Z" }
        ],
        trainingVideos: [
          {
            id: "video-valid",
            folderId: "video-folder-forms",
            title: "Roundhouse Basics",
            fileName: "roundhouse.mp4",
            mimeType: "video/mp4",
            size: 512,
            videoDataUrl: "data:video/mp4;base64,AAAA",
            createdAt: "2026-06-01T10:10:00.000Z"
          },
          {
            id: "video-orphan",
            folderId: "video-folder-missing",
            title: "Orphan Video",
            fileName: "orphan.mp4",
            mimeType: "video/mp4",
            size: 512,
            videoDataUrl: "data:video/mp4;base64,AAAA",
            createdAt: "2026-06-01T10:15:00.000Z"
          }
        ],
        studyGuideFolders: [
          { id: "study-folder-root", name: "White Belt Basics", subject: "Foundations", createdAt: "2026-06-01T11:00:00.000Z" },
          { id: "study-folder-child", name: "Kicks", subject: "Foundations", parentId: "study-folder-root", createdAt: "2026-06-01T11:05:00.000Z" },
          { id: "study-folder-orphan-parent", name: "Unfiled Forms", subject: "Forms", parentId: "study-folder-missing", createdAt: "2026-06-01T11:10:00.000Z" }
        ],
        studyGuideMaterials: [
          {
            id: "study-material-valid",
            folderId: "study-folder-child",
            title: "Front Kick Checklist",
            fileName: "front-kick.txt",
            mimeType: "text/plain",
            size: 128,
            fileDataUrl: "data:text/plain;base64,SGVscA==",
            createdAt: "2026-06-01T11:15:00.000Z"
          },
          {
            id: "study-material-orphan",
            folderId: "study-folder-missing",
            title: "Orphan Notes",
            fileName: "orphan.txt",
            mimeType: "text/plain",
            size: 128,
            fileDataUrl: "data:text/plain;base64,SGVscA==",
            createdAt: "2026-06-01T11:20:00.000Z"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.trainingVideos).toEqual([
      expect.objectContaining({ id: "video-valid", folderId: "video-folder-forms" })
    ]);
    expect(snapshot.data.studyGuideFolders).toEqual([
      expect.objectContaining({ id: "study-folder-root" }),
      expect.objectContaining({ id: "study-folder-child", parentId: "study-folder-root" }),
      expect.objectContaining({ id: "study-folder-orphan-parent" })
    ]);
    expect(snapshot.data.studyGuideFolders[2]).not.toHaveProperty("parentId");
    expect(snapshot.data.studyGuideMaterials).toEqual([
      expect.objectContaining({ id: "study-material-valid", folderId: "study-folder-child" })
    ]);
    expect(snapshot.sections.find((section) => section.id === "trainingVideos")).toEqual(expect.objectContaining({ count: 1 }));
    expect(snapshot.sections.find((section) => section.id === "studyGuideFolders")).toEqual(expect.objectContaining({ count: 3 }));
    expect(snapshot.sections.find((section) => section.id === "studyGuideMaterials")).toEqual(expect.objectContaining({ count: 1 }));
    expect(snapshot.summary.totalRecords).toBe(7);
    const parsed = parseOperationsBackupSnapshot(JSON.stringify(snapshot));
    expect(parsed.data.trainingVideos).toHaveLength(1);
    expect(parsed.data.studyGuideFolders).toHaveLength(3);
    expect(parsed.data.studyGuideMaterials).toHaveLength(1);
  });

  it("exports library media with restorable folder and file fields", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        trainingVideoFolders: [
          { id: " video-folder-forms ", name: " Forms ", subject: " Beginner Forms ", description: " Library basics ", createdAt: " 2026-06-01T10:00:00.000Z " },
          { id: "video-folder-empty-name", name: " ", subject: "Forms", createdAt: "2026-06-01T10:02:00.000Z" },
          { id: "video-folder-duplicate", name: "Duplicate One", subject: "Forms", createdAt: "2026-06-01T10:03:00.000Z" },
          { id: " video-folder-duplicate ", name: "Duplicate Two", subject: "Forms", createdAt: "2026-06-01T10:04:00.000Z" }
        ],
        trainingVideos: [
          {
            id: " video-roundhouse ",
            folderId: " video-folder-forms ",
            title: " Roundhouse Basics ",
            description: " Kicking notes ",
            fileName: " roundhouse.mp4 ",
            mimeType: " video/mp4 ",
            size: "512",
            videoDataUrl: "data:video/mp4;base64,AAAA",
            createdAt: " 2026-06-01T10:10:00.000Z "
          },
          {
            id: "video-blank-title",
            folderId: "video-folder-forms",
            title: " ",
            fileName: "blank.mp4",
            mimeType: "video/mp4",
            size: 512,
            videoDataUrl: "data:video/mp4;base64,AAAA",
            createdAt: "2026-06-01T10:12:00.000Z"
          },
          {
            id: "video-duplicate",
            folderId: "video-folder-forms",
            title: "Duplicate One",
            fileName: "duplicate.mp4",
            mimeType: "video/mp4",
            size: 512,
            videoDataUrl: "data:video/mp4;base64,AAAA",
            createdAt: "2026-06-01T10:13:00.000Z"
          },
          {
            id: " video-duplicate ",
            folderId: "video-folder-forms",
            title: "Duplicate Two",
            fileName: "duplicate-2.mp4",
            mimeType: "video/mp4",
            size: 512,
            videoDataUrl: "data:video/mp4;base64,AAAA",
            createdAt: "2026-06-01T10:14:00.000Z"
          }
        ] as OperationsBackupInput["trainingVideos"],
        studyGuideFolders: [
          { id: " study-folder-root ", name: " White Belt Basics ", subject: " Foundations ", description: " Starter material ", createdAt: " 2026-06-01T11:00:00.000Z " },
          { id: " study-folder-child ", name: " Kicks ", subject: " Foundations ", parentId: " study-folder-root ", createdAt: " 2026-06-01T11:05:00.000Z " },
          { id: "study-folder-orphan", name: "Orphan", subject: "Forms", parentId: " missing-folder ", createdAt: "2026-06-01T11:07:00.000Z" },
          { id: "study-folder-invalid", name: "Invalid", subject: " ", createdAt: "2026-06-01T11:08:00.000Z" },
          { id: "study-folder-duplicate", name: "Duplicate One", subject: "Forms", createdAt: "2026-06-01T11:09:00.000Z" },
          { id: " study-folder-duplicate ", name: "Duplicate Two", subject: "Forms", createdAt: "2026-06-01T11:10:00.000Z" }
        ],
        studyGuideMaterials: [
          {
            id: " study-material-front-kick ",
            folderId: " study-folder-child ",
            title: " Front Kick Checklist ",
            description: " Family practice notes ",
            fileName: " front-kick.txt ",
            mimeType: " text/plain ",
            size: "128",
            fileDataUrl: "data:text/plain;base64,SGVscA==",
            createdAt: " 2026-06-01T11:15:00.000Z "
          },
          {
            id: "study-material-missing-folder",
            folderId: "missing-folder",
            title: "Missing Folder",
            fileName: "missing.txt",
            mimeType: "text/plain",
            size: 128,
            fileDataUrl: "data:text/plain;base64,SGVscA==",
            createdAt: "2026-06-01T11:16:00.000Z"
          },
          {
            id: "study-material-duplicate",
            folderId: "study-folder-root",
            title: "Duplicate One",
            fileName: "duplicate.txt",
            mimeType: "text/plain",
            size: 128,
            fileDataUrl: "data:text/plain;base64,SGVscA==",
            createdAt: "2026-06-01T11:17:00.000Z"
          },
          {
            id: " study-material-duplicate ",
            folderId: "study-folder-root",
            title: "Duplicate Two",
            fileName: "duplicate-2.txt",
            mimeType: "text/plain",
            size: 128,
            fileDataUrl: "data:text/plain;base64,SGVscA==",
            createdAt: "2026-06-01T11:18:00.000Z"
          }
        ] as OperationsBackupInput["studyGuideMaterials"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.trainingVideoFolders).toEqual([
      expect.objectContaining({
        id: "video-folder-forms",
        name: "Forms",
        subject: "Beginner Forms",
        description: "Library basics",
        createdAt: "2026-06-01T10:00:00.000Z"
      }),
      expect.objectContaining({ id: "video-folder-duplicate", name: "Duplicate One" })
    ]);
    expect(snapshot.data.trainingVideos).toEqual([
      expect.objectContaining({
        id: "video-roundhouse",
        folderId: "video-folder-forms",
        title: "Roundhouse Basics",
        description: "Kicking notes",
        fileName: "roundhouse.mp4",
        mimeType: "video/mp4",
        size: 512,
        createdAt: "2026-06-01T10:10:00.000Z"
      }),
      expect.objectContaining({ id: "video-duplicate", title: "Duplicate One" })
    ]);
    expect(snapshot.data.studyGuideFolders).toEqual([
      expect.objectContaining({
        id: "study-folder-root",
        name: "White Belt Basics",
        subject: "Foundations",
        description: "Starter material",
        createdAt: "2026-06-01T11:00:00.000Z"
      }),
      expect.objectContaining({ id: "study-folder-child", parentId: "study-folder-root" }),
      expect.objectContaining({ id: "study-folder-orphan" }),
      expect.objectContaining({ id: "study-folder-duplicate", name: "Duplicate One" })
    ]);
    expect(snapshot.data.studyGuideFolders[2]).not.toHaveProperty("parentId");
    expect(snapshot.data.studyGuideMaterials).toEqual([
      expect.objectContaining({
        id: "study-material-front-kick",
        folderId: "study-folder-child",
        title: "Front Kick Checklist",
        description: "Family practice notes",
        fileName: "front-kick.txt",
        mimeType: "text/plain",
        size: 128,
        createdAt: "2026-06-01T11:15:00.000Z"
      }),
      expect.objectContaining({ id: "study-material-duplicate", title: "Duplicate One" })
    ]);
    expect(snapshot.sections.find((section) => section.id === "trainingVideoFolders")).toEqual(expect.objectContaining({ count: 2 }));
    expect(snapshot.sections.find((section) => section.id === "trainingVideos")).toEqual(expect.objectContaining({ count: 2 }));
    expect(snapshot.sections.find((section) => section.id === "studyGuideFolders")).toEqual(expect.objectContaining({ count: 4 }));
    expect(snapshot.sections.find((section) => section.id === "studyGuideMaterials")).toEqual(expect.objectContaining({ count: 2 }));
    const parsed = parseOperationsBackupSnapshot(JSON.stringify(snapshot));
    expect(parsed.data.trainingVideoFolders).toHaveLength(2);
    expect(parsed.data.trainingVideos).toHaveLength(2);
    expect(parsed.data.studyGuideFolders).toHaveLength(4);
    expect(parsed.data.studyGuideMaterials).toHaveLength(2);
  });

  it("rejects account backup records without usernames", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        accounts: [
          {
            email: "parent@example.com"
          }
        ]
      }
    }))).toThrow(/accounts entries must include required account identity fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        managedAccounts: [
          {
            id: "managed-missing-username",
            displayName: "Jordan Lee",
            role: "staff",
            status: "active",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/managedAccounts entries must include string usernames/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        childAccounts: [
          {
            id: "child-missing-username",
            parentEmail: "parent@example.com",
            name: "Kai Cho",
            age: "7",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      }
    }))).toThrow(/childAccounts entries must include string usernames/i);
  });

  it("rejects login account backups without required identity timestamps", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        managedAccounts: [
          {
            id: "managed-missing-display-name",
            username: "jordan.staff",
            role: "staff",
            status: "active",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/managedAccounts entries must include required identity fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        childAccounts: [
          {
            id: "child-missing-created-at",
            parentEmail: "parent@example.com",
            name: "Kai Cho",
            username: "kai-cho.child",
            age: "7",
            beltSlug: "yellow"
          }
        ]
      }
    }))).toThrow(/childAccounts entries must include required profile fields/i);
  });

  it("rejects duplicate registered account emails in restored login records", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accounts: [
          { email: "parent@example.com", createdAt: "2026-06-01T10:00:00.000Z" },
          { email: "Parent@Example.com", createdAt: "2026-06-01T10:05:00.000Z" }
        ]
      })
    ))).toThrow(/accounts entries must have unique emails/i);
  });

  it("rejects restored identity fields with hidden whitespace", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [
          {
            id: " student-restored",
            firstName: "Ari",
            lastName: "Nguyen",
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          }
        ]
      })
    ))).toThrow(/students entries must use trimmed stable ids/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        managedAccounts: [
          {
            id: "managed-jordan",
            displayName: "Jordan Lee",
            username: " jordan.staff",
            role: "staff",
            status: "active",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/managedAccounts entries must use trimmed usernames/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accounts: [
          { email: "parent@example.com ", createdAt: "2026-06-01T10:00:00.000Z" }
        ]
      })
    ))).toThrow(/accounts entries must use trimmed emails/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accountRoles: [
          { email: " parent@example.com", role: "guardian" }
        ],
        accounts: [
          { email: "parent@example.com", createdAt: "2026-06-01T10:00:00.000Z" }
        ]
      })
    ))).toThrow(/accountRoles entries must use trimmed emails/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accounts: [
          { email: "parent@example.com", createdAt: "2026-06-01T10:00:00.000Z" }
        ],
        childAccounts: [
          {
            id: "child-kai",
            parentEmail: " parent@example.com",
            name: "Kai Cho",
            username: "kai-cho.child",
            age: "7",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/childAccounts entries must use trimmed parent emails/i);
  });

  it("rejects child account backup records without parent emails", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        childAccounts: [
          {
            id: "child-missing-parent",
            name: "Kai Cho",
            username: "kai-cho.child",
            age: "7",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      }
    }))).toThrow(/childAccounts entries must include string parent emails/i);
  });

  it("rejects child account backup records without required profile fields", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        childAccounts: [
          {
            id: "child-missing-belt",
            parentEmail: "parent@example.com",
            name: "Kai Cho",
            username: "kai-cho.child",
            age: "7",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      }
    }))).toThrow(/childAccounts entries must include required profile fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        childAccounts: [
          {
            id: "child-bad-age",
            parentEmail: "parent@example.com",
            name: "Kai Cho",
            username: "kai-cho.child",
            age: 7,
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      }
    }))).toThrow(/childAccounts entries must include required profile fields/i);
  });

  it("rejects managed account backup records without supported roles and statuses", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        managedAccounts: [
          {
            id: "managed-missing-role",
            displayName: "Jordan Lee",
            username: "jordan.staff",
            status: "active",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/managedAccounts entries must use supported roles/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        managedAccounts: [
          {
            id: "managed-missing-status",
            displayName: "Jordan Lee",
            username: "jordan.staff",
            role: "staff",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/managedAccounts entries must use supported statuses/i);
  });

  it("rejects managed account backup records without supported access lists", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        managedAccounts: [
          {
            id: "managed-missing-access",
            displayName: "Jordan Lee",
            username: "jordan.staff",
            role: "staff",
            status: "active",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/managedAccounts entries must include supported access lists/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify({
      schemaVersion: "chos-operations-backup.v1",
      data: {
        managedAccounts: [
          {
            id: "managed-invalid-access",
            displayName: "Jordan Lee",
            username: "jordan.staff",
            role: "staff",
            status: "active",
            access: ["dashboard", "payroll"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    }))).toThrow(/managedAccounts entries must include supported access lists/i);
  });

  it("rejects restored student managed accounts with staff access keys", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [
          {
            id: "student-ari",
            firstName: "Ari",
            lastName: "Nguyen",
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Active",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          }
        ],
        managedAccounts: [
          {
            id: "managed-student-access",
            displayName: "Ari Nguyen",
            username: "ari.student",
            role: "student",
            status: "active",
            access: ["dashboard"],
            studentId: "student-ari",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/student managedAccounts entries cannot include staff access/i);
  });

  it("rejects restored active student logins that are not linked to restored students", () => {
    const inactiveDeletedStudentLogin = parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        managedAccounts: [
          {
            id: "managed-inactive-deleted-student",
            displayName: "Deleted Student",
            username: "deleted.student",
            role: "student",
            status: "inactive",
            access: [],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ));
    expect(inactiveDeletedStudentLogin.data.managedAccounts).toEqual([
      expect.objectContaining({ id: "managed-inactive-deleted-student", status: "inactive" })
    ]);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        managedAccounts: [
          {
            id: "managed-active-orphan-student",
            displayName: "Orphan Student",
            username: "orphan.student",
            role: "student",
            status: "active",
            access: [],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/active student managedAccounts entries must reference restored students/i);
  });

  it("rejects restored active student logins linked to inactive students", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [
          {
            id: "student-inactive",
            firstName: "Ari",
            lastName: "Nguyen",
            phone: "(262) 555-0101",
            email: "ari@example.com",
            status: "Inactive",
            beltRank: "Yellow",
            classesAttended: 12,
            missedClassCount: 0,
            joinedAt: "2026-01-01"
          }
        ],
        managedAccounts: [
          {
            id: "managed-inactive-student",
            displayName: "Ari Nguyen",
            username: "ari.student",
            role: "student",
            status: "active",
            access: [],
            studentId: "student-inactive",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/active student managedAccounts entries can only reference restored active students/i);
  });

  it("exports managed student logins without stale active student links", () => {
    const activeStudent = {
      id: "student-active",
      firstName: "Mina",
      lastName: "Cho",
      phone: "(262) 555-0101",
      email: "mina@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const inactiveStudent = {
      ...activeStudent,
      id: "student-inactive",
      firstName: "Ari",
      email: "ari@example.com",
      status: "Inactive"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent, inactiveStudent],
        managedAccounts: [
          {
            id: "managed-active",
            displayName: "Mina Cho",
            username: "mina.student",
            password: "ActiveSecret123",
            role: "student",
            status: "active",
            access: [],
            studentId: "student-active",
            email: "mina@example.com",
            phone: "(262) 555-0101",
            title: "Student",
            createdAt: "2026-06-01T10:00:00.000Z"
          },
          {
            id: "managed-inactive-link",
            displayName: "Ari Nguyen",
            username: "ari.student",
            password: "InactiveSecret123",
            role: "student",
            status: "active",
            access: [],
            studentId: "student-inactive",
            email: "ari@example.com",
            phone: "(262) 555-0103",
            title: "Student",
            createdAt: "2026-06-01T10:05:00.000Z"
          },
          {
            id: "managed-missing-link",
            displayName: "Noah Woods",
            username: "noah.student",
            password: "MissingSecret123",
            role: "student",
            status: "active",
            access: [],
            studentId: "student-missing",
            email: "noah@example.com",
            phone: "(262) 555-0104",
            title: "Student",
            createdAt: "2026-06-01T10:10:00.000Z"
          },
          {
            id: "managed-orphan-active",
            displayName: "Orphan Student",
            username: "orphan.student",
            password: "OrphanSecret123",
            role: "student",
            status: "active",
            access: [],
            email: "orphan@example.com",
            phone: "(262) 555-0105",
            title: "Student",
            createdAt: "2026-06-01T10:15:00.000Z"
          },
          {
            id: "managed-staff",
            displayName: "Jordan Staff",
            username: "jordan.staff",
            password: "StaffSecret123",
            role: "staff",
            status: "active",
            access: ["reports"],
            studentId: "student-missing",
            email: "jordan@example.com",
            phone: "(262) 555-0106",
            title: "Manager",
            createdAt: "2026-06-01T10:20:00.000Z"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(JSON.stringify(snapshot.data.managedAccounts)).not.toContain("Secret123");
    expect(snapshot.data.managedAccounts).toEqual([
      expect.objectContaining({ id: "managed-active", status: "active", studentId: "student-active" }),
      expect.objectContaining({ id: "managed-inactive-link", status: "inactive", studentId: "student-inactive" }),
      expect.objectContaining({ id: "managed-missing-link", status: "inactive" }),
      expect.objectContaining({ id: "managed-orphan-active", status: "inactive" }),
      expect.objectContaining({ id: "managed-staff", role: "staff", status: "active", access: ["reports"] })
    ]);
    snapshot.data.managedAccounts.forEach((account) => expect(account).not.toHaveProperty("password"));
    expect(snapshot.data.managedAccounts[2]).not.toHaveProperty("studentId");
    expect(snapshot.data.managedAccounts[3]).not.toHaveProperty("studentId");
    expect(snapshot.data.managedAccounts[4]).not.toHaveProperty("studentId");
    expect(snapshot.sections.find((section) => section.id === "managedAccounts")).toEqual(expect.objectContaining({ count: 5 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.managedAccounts).toHaveLength(5);
  });

  it("exports student managed accounts without staff access keys", () => {
    const activeStudent = {
      id: "student-active",
      firstName: "Mina",
      lastName: "Cho",
      phone: "(262) 555-0101",
      email: "mina@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent],
        managedAccounts: [
          {
            id: "managed-student-access",
            displayName: "Mina Cho",
            username: "mina.student",
            password: "StudentSecret123",
            role: "student",
            status: "active",
            access: ["reports", "students"],
            studentId: "student-active",
            email: "mina@example.com",
            phone: "(262) 555-0101",
            title: "Student",
            createdAt: "2026-06-01T10:00:00.000Z"
          },
          {
            id: "managed-staff-access",
            displayName: "Jordan Staff",
            username: "jordan.staff",
            password: "StaffSecret123",
            role: "staff",
            status: "active",
            access: ["reports", "students"],
            email: "jordan@example.com",
            phone: "(262) 555-0102",
            title: "Manager",
            createdAt: "2026-06-01T10:05:00.000Z"
          }
        ],
        accountRoles: [
          { email: "mina.student", role: "student" },
          { email: "jordan.staff", role: "staff" }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.managedAccounts).toEqual([
      expect.objectContaining({ id: "managed-student-access", role: "student", access: [] }),
      expect.objectContaining({ id: "managed-staff-access", role: "staff", access: ["reports", "students"] })
    ]);
    expect(JSON.stringify(snapshot.data)).not.toContain("StudentSecret123");
    expect(JSON.stringify(snapshot.data)).not.toContain("StaffSecret123");
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.managedAccounts).toHaveLength(2);
  });

  it("rejects restored records with broken operational references", () => {
    const student = {
      id: "student-restored",
      firstName: "Ari",
      lastName: "Nguyen",
      phone: "(262) 555-0101",
      email: "ari@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        managedAccounts: [
          {
            id: "managed-student",
            displayName: "Ari Nguyen",
            username: "ari.student",
            role: "student",
            status: "active",
            access: [],
            studentId: "missing-student",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ],
        students: [student]
      })
    ))).toThrow(/managedAccounts entries can only reference restored students/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        scheduledClasses: [
          { id: "schedule-private", title: "Private Lesson", date: "2026-06-03", time: "5:30 PM", type: "private-lesson", studentId: "missing-student" }
        ],
        students: [student]
      })
    ))).toThrow(/scheduledClasses entries can only reference restored students/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        checkIns: [
          { id: "check-restored", studentId: "missing-student", studentName: "Missing Student", date: "2026-06-01", beltRank: "Yellow" }
        ],
        students: [student]
      })
    ))).toThrow(/checkIns entries can only reference restored students/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        trainingVideos: [
          { id: "video-restored", folderId: "missing-video-folder", title: "Roundhouse Basics", fileName: "roundhouse.mp4", mimeType: "video/mp4", size: 512, videoDataUrl: "data:video/mp4;base64,AAAA", createdAt: "2026-06-01T10:00:00.000Z" }
        ]
      })
    ))).toThrow(/trainingVideos entries can only reference restored video folders/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        studyGuideFolders: [
          { id: "study-folder-restored", name: "Basics", subject: "Forms", parentId: "missing-study-folder", createdAt: "2026-06-01T10:00:00.000Z" }
        ]
      })
    ))).toThrow(/studyGuideFolders entries can only reference restored study guide folders/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        studyGuideMaterials: [
          { id: "study-material-restored", folderId: "missing-study-folder", title: "Form One", fileName: "form-one.pdf", mimeType: "application/pdf", size: 512, fileDataUrl: "data:application/pdf;base64,AAAA", createdAt: "2026-06-01T10:00:00.000Z" }
        ]
      })
    ))).toThrow(/studyGuideMaterials entries can only reference restored study guide folders/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        messageCampaigns: [
          { id: "campaign-restored", title: "June reminders", body: "Keep training.", audience: "all-students", createdAt: "2026-06-01T09:00:00.000Z" }
        ],
        messageLogs: [
          { id: "message-restored", kind: "marketing", recipientName: "Ari Nguyen", recipientPhone: "(262) 555-0101", body: "Keep training.", status: "queued", campaignId: "missing-campaign", createdAt: "2026-06-01T10:00:00.000Z" }
        ]
      })
    ))).toThrow(/messageLogs entries can only reference restored message campaigns/i);
  });

  it("rejects restored scheduled classes assigned to inactive students", () => {
    const activeStudent = {
      id: "student-active",
      firstName: "Mina",
      lastName: "Cho",
      phone: "(262) 555-0101",
      email: "mina@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const inactiveStudent = {
      ...activeStudent,
      id: "student-inactive",
      firstName: "Ari",
      email: "ari@example.com",
      status: "Inactive"
    };

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [activeStudent, inactiveStudent],
        scheduledClasses: [
          {
            id: "schedule-inactive-private",
            title: "Private Lesson",
            date: "2026-06-03",
            time: "5:30 PM",
            type: "private-lesson",
            studentId: "student-inactive"
          }
        ]
      })
    ))).toThrow(/scheduledClasses entries can only reference restored active students/i);
  });

  it("rejects restored scheduled classes with malformed optional schedule fields", () => {
    const baseScheduledClass = {
      id: "schedule-private",
      title: "Private Lesson",
      date: "2026-06-03",
      time: "5:30 PM",
      type: "private-lesson"
    };

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        scheduledClasses: [
          {
            ...baseScheduledClass,
            recurring: "yes"
          }
        ]
      })
    ))).toThrow(/scheduledClasses entries must include valid scheduling fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        scheduledClasses: [
          {
            ...baseScheduledClass,
            title: " Private Lesson"
          }
        ]
      })
    ))).toThrow(/scheduledClasses entries must include valid scheduling fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        scheduledClasses: [
          {
            ...baseScheduledClass,
            studentId: 42
          }
        ]
      })
    ))).toThrow(/scheduledClasses entries must include valid scheduling fields/i);
  });

  it("exports scheduled classes without stale student links so backups stay restorable", () => {
    const activeStudent = {
      id: "student-active",
      firstName: "Mina",
      lastName: "Cho",
      phone: "(262) 555-0101",
      email: "mina@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const inactiveStudent = {
      ...activeStudent,
      id: "student-inactive",
      firstName: "Ari",
      email: "ari@example.com",
      status: "Inactive"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent, inactiveStudent],
        scheduledClasses: [
          {
            id: "schedule-active-private",
            title: "Active Private Lesson",
            date: "2026-06-03",
            time: "5:30 PM",
            type: "private-lesson",
            studentId: "student-active"
          },
          {
            id: "schedule-inactive-private",
            title: "Inactive Private Lesson",
            date: "2026-06-04",
            time: "4:30 PM",
            type: "private-lesson",
            studentId: "student-inactive"
          },
          {
            id: "schedule-missing-private",
            title: "Missing Student Private Lesson",
            date: "2026-06-05",
            time: "6:30 PM",
            type: "private-lesson",
            studentId: "student-missing"
          },
          {
            id: "schedule-general-class",
            title: "General Youth Class",
            date: "2026-06-06",
            time: "5:00 PM",
            type: "class"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.scheduledClasses).toEqual([
      expect.objectContaining({ id: "schedule-active-private", studentId: "student-active" }),
      expect.not.objectContaining({ id: "schedule-inactive-private", studentId: expect.any(String) }),
      expect.not.objectContaining({ id: "schedule-missing-private", studentId: expect.any(String) }),
      expect.objectContaining({ id: "schedule-general-class" })
    ]);
    expect(snapshot.sections.find((section) => section.id === "scheduledClasses")).toEqual(expect.objectContaining({ count: 4 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.scheduledClasses).toHaveLength(4);
  });

  it("exports scheduled classes with restorable schedule fields", () => {
    const activeStudent = {
      id: "student-active",
      firstName: "Mina",
      lastName: "Cho",
      phone: "(262) 555-0101",
      email: "mina@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent],
        scheduledClasses: [
          {
            id: " schedule-private ",
            title: " Private Lesson ",
            date: " 2026-06-03 ",
            time: " 5:30 PM ",
            type: " private-lesson ",
            recurring: "yes",
            studentId: " student-active ",
            titleColor: " #ffcc00 ",
            notes: " Board breaking prep "
          },
          {
            id: "schedule-group",
            title: "Group Class",
            date: "2026-06-04",
            time: "6:00 PM",
            type: "group-class",
            recurring: false
          },
          {
            id: "schedule-missing-time",
            title: "No Time",
            date: "2026-06-05",
            time: " ",
            type: "private-lesson"
          },
          {
            id: "schedule-duplicate",
            title: "Duplicate One",
            date: "2026-06-06",
            time: "10:00 AM",
            type: "group-class"
          },
          {
            id: " schedule-duplicate ",
            title: "Duplicate Two",
            date: "2026-06-07",
            time: "11:00 AM",
            type: "group-class"
          }
        ] as OperationsBackupInput["scheduledClasses"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.scheduledClasses).toEqual([
      expect.objectContaining({
        id: "schedule-private",
        title: "Private Lesson",
        date: "2026-06-03",
        time: "5:30 PM",
        type: "private-lesson",
        recurring: true,
        studentId: "student-active",
        titleColor: "#ffcc00",
        notes: "Board breaking prep"
      }),
      expect.objectContaining({
        id: "schedule-group",
        title: "Group Class",
        date: "2026-06-04",
        time: "6:00 PM",
        type: "group-class",
        recurring: false
      }),
      expect.objectContaining({
        id: "schedule-duplicate",
        title: "Duplicate One"
      })
    ]);
    expect(snapshot.sections.find((section) => section.id === "scheduledClasses")).toEqual(expect.objectContaining({ count: 3 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.scheduledClasses).toHaveLength(3);
  });

  it("rejects restored direct messages with missing or inactive student participants", () => {
    const activeStudent = {
      id: "student-active",
      firstName: "Mina",
      lastName: "Cho",
      phone: "(262) 555-0101",
      email: "mina@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const inactiveStudent = {
      ...activeStudent,
      id: "student-inactive",
      firstName: "Ari",
      email: "ari@example.com",
      status: "Inactive"
    };

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [activeStudent],
        directMessages: [
          {
            id: "direct-missing-recipient",
            threadId: "direct-staff-seed__student-missing",
            senderId: "direct-staff-seed",
            senderName: "Instructor Team",
            recipientId: "student-missing",
            recipientName: "Missing Student",
            body: "Practice notes.",
            createdAt: "2026-06-01T10:00:00.000Z",
            status: "sent"
          }
        ]
      })
    ))).toThrow(/directMessages entries can only reference restored active chat participants/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [activeStudent, inactiveStudent],
        directMessages: [
          {
            id: "direct-inactive-parent",
            threadId: "direct-staff-seed__parent-student-inactive",
            senderId: "direct-staff-seed",
            senderName: "Instructor Team",
            recipientId: "parent-student-inactive",
            recipientName: "Ari Cho",
            body: "Practice notes.",
            createdAt: "2026-06-01T10:00:00.000Z",
            status: "sent"
          }
        ]
      })
    ))).toThrow(/directMessages entries can only reference restored active chat participants/i);
  });

  it("rejects restored direct messages with malformed sent message fields", () => {
    const activeStudent = {
      id: "student-active",
      firstName: "Mina",
      lastName: "Cho",
      phone: "(262) 555-0101",
      email: "mina@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const baseDirectMessage = {
      id: "direct-staff-active",
      threadId: "direct-staff-seed__student-active",
      senderId: "direct-staff-seed",
      senderName: "Instructor Team",
      recipientId: "student-active",
      recipientName: "Mina Cho",
      body: "Great work in class.",
      createdAt: "2026-06-01T10:00:00.000Z",
      status: "sent"
    };

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [activeStudent],
        directMessages: [
          {
            ...baseDirectMessage,
            body: " Great work in class."
          }
        ]
      })
    ))).toThrow(/directMessages entries must include valid sent direct message fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [activeStudent],
        directMessages: [
          {
            ...baseDirectMessage,
            senderName: 42
          }
        ]
      })
    ))).toThrow(/directMessages entries must include valid sent direct message fields/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        students: [activeStudent],
        directMessages: [
          {
            ...baseDirectMessage,
            threadId: "student-active__direct-staff-seed"
          }
        ]
      })
    ))).toThrow(/directMessages entries must include valid sent direct message fields/i);
  });

  it("exports direct messages without stale student participants so backups stay restorable", () => {
    const activeStudent = {
      id: "student-active",
      firstName: "Mina",
      lastName: "Cho",
      phone: "(262) 555-0101",
      email: "mina@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };
    const inactiveStudent = {
      ...activeStudent,
      id: "student-inactive",
      firstName: "Ari",
      email: "ari@example.com",
      status: "Inactive"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent, inactiveStudent],
        directMessages: [
          {
            id: "direct-staff-active",
            threadId: "direct-staff-seed__student-active",
            senderId: "direct-staff-seed",
            senderName: "Instructor Team",
            recipientId: "student-active",
            recipientName: "Mina Cho",
            body: "Great work in class.",
            createdAt: "2026-06-01T10:00:00.000Z",
            status: "sent"
          },
          {
            id: "direct-active-parent",
            threadId: "direct-staff-seed__parent-student-active",
            senderId: "parent-student-active",
            senderName: "Mina Family",
            recipientId: "direct-staff-seed",
            recipientName: "Instructor Team",
            body: "Thanks for the update.",
            createdAt: "2026-06-01T10:05:00.000Z",
            status: "sent"
          },
          {
            id: "direct-student-staff",
            threadId: "direct-staff-seed__student-active",
            senderId: "student-active",
            senderName: "Mina Cho",
            recipientId: "direct-staff-seed",
            recipientName: "Instructor Team",
            body: "I practiced forms today.",
            createdAt: "2026-06-01T10:10:00.000Z",
            status: "sent"
          },
          {
            id: "direct-inactive-student",
            threadId: "direct-staff-seed__student-inactive",
            senderId: "direct-staff-seed",
            senderName: "Instructor Team",
            recipientId: "student-inactive",
            recipientName: "Ari Nguyen",
            body: "Inactive student note.",
            createdAt: "2026-06-01T10:15:00.000Z",
            status: "sent"
          },
          {
            id: "direct-inactive-parent",
            threadId: "direct-staff-seed__parent-student-inactive",
            senderId: "parent-student-inactive",
            senderName: "Ari Family",
            recipientId: "direct-staff-seed",
            recipientName: "Instructor Team",
            body: "Inactive parent note.",
            createdAt: "2026-06-01T10:20:00.000Z",
            status: "sent"
          },
          {
            id: "direct-missing-student",
            threadId: "direct-staff-seed__student-missing",
            senderId: "direct-staff-seed",
            senderName: "Instructor Team",
            recipientId: "student-missing",
            recipientName: "Missing Student",
            body: "Missing student note.",
            createdAt: "2026-06-01T10:25:00.000Z",
            status: "sent"
          }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.directMessages).toEqual([
      expect.objectContaining({ id: "direct-staff-active" }),
      expect.objectContaining({ id: "direct-active-parent" }),
      expect.objectContaining({ id: "direct-student-staff" })
    ]);
    expect(snapshot.data.directMessages).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "direct-inactive-student" }),
      expect.objectContaining({ id: "direct-inactive-parent" }),
      expect.objectContaining({ id: "direct-missing-student" })
    ]));
    expect(snapshot.sections.find((section) => section.id === "directMessages")).toEqual(expect.objectContaining({ count: 3 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.directMessages).toHaveLength(3);
  });

  it("exports direct messages with restorable sent message fields", () => {
    const activeStudent = {
      id: "student-active",
      firstName: "Mina",
      lastName: "Cho",
      phone: "(262) 555-0101",
      email: "mina@example.com",
      status: "Active",
      beltRank: "Yellow",
      classesAttended: 12,
      missedClassCount: 0,
      joinedAt: "2026-01-01"
    };

    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        students: [activeStudent],
        directMessages: [
          {
            id: " direct-staff-active ",
            threadId: " student-active__direct-staff-seed ",
            senderId: " direct-staff-seed ",
            senderName: " Instructor Team ",
            recipientId: " student-active ",
            recipientName: " Mina Cho ",
            body: " Great work in class. ",
            createdAt: " 2026-06-01T10:00:00.000Z ",
            status: "sent"
          },
          {
            id: "direct-blank-body",
            threadId: "direct-staff-seed__student-active",
            senderId: "direct-staff-seed",
            senderName: "Instructor Team",
            recipientId: "student-active",
            recipientName: "Mina Cho",
            body: " ",
            createdAt: "2026-06-01T10:05:00.000Z",
            status: "sent"
          },
          {
            id: "direct-duplicate",
            threadId: "direct-staff-seed__student-active",
            senderId: "student-active",
            senderName: "Mina Cho",
            recipientId: "direct-staff-seed",
            recipientName: "Instructor Team",
            body: "I practiced forms today.",
            createdAt: "2026-06-01T10:10:00.000Z",
            status: "sent"
          },
          {
            id: " direct-duplicate ",
            threadId: "direct-staff-seed__student-active",
            senderId: "student-active",
            senderName: "Mina Cho",
            recipientId: "direct-staff-seed",
            recipientName: "Instructor Team",
            body: "Duplicate should not export.",
            createdAt: "2026-06-01T10:15:00.000Z",
            status: "sent"
          },
          {
            id: "direct-draft",
            threadId: "direct-staff-seed__student-active",
            senderId: "direct-staff-seed",
            senderName: "Instructor Team",
            recipientId: "student-active",
            recipientName: "Mina Cho",
            body: "Draft should not export.",
            createdAt: "2026-06-01T10:20:00.000Z",
            status: "draft"
          }
        ] as OperationsBackupInput["directMessages"]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.directMessages).toEqual([
      expect.objectContaining({
        id: "direct-staff-active",
        threadId: "direct-staff-seed__student-active",
        senderId: "direct-staff-seed",
        senderName: "Instructor Team",
        recipientId: "student-active",
        recipientName: "Mina Cho",
        body: "Great work in class.",
        createdAt: "2026-06-01T10:00:00.000Z",
        status: "sent"
      }),
      expect.objectContaining({
        id: "direct-duplicate",
        body: "I practiced forms today."
      })
    ]);
    expect(snapshot.sections.find((section) => section.id === "directMessages")).toEqual(expect.objectContaining({ count: 2 }));
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.directMessages).toHaveLength(2);
  });

  it("rejects duplicate account usernames in restored login records", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        managedAccounts: [
          {
            id: "managed-jordan",
            displayName: "Jordan Lee",
            username: "jordan.staff",
            role: "staff",
            status: "active",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:00:00.000Z"
          },
          {
            id: "managed-jordan-copy",
            displayName: "Jordan Backup",
            username: "Jordan.Staff",
            role: "staff",
            status: "active",
            access: ["reports"],
            createdAt: "2026-06-01T10:05:00.000Z"
          }
        ]
      })
    ))).toThrow(/managedAccounts entries must have unique usernames/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        managedAccounts: [
          {
            id: "managed-kai",
            displayName: "Kai Staff",
            username: "kai.cho",
            role: "staff",
            status: "active",
            access: ["students"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ],
        childAccounts: [
          {
            id: "child-kai",
            parentEmail: "parent@example.com",
            name: "Kai Cho",
            username: "KAI.CHO",
            age: "7",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/account usernames must be unique across restored login records/i);
  });

  it("rejects restored custom login usernames that collide with prototype logins", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        managedAccounts: [
          {
            id: "managed-prototype-collision",
            displayName: "Prototype Collision",
            username: "Manager123",
            role: "staff",
            status: "active",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/custom login usernames cannot collide with built-in prototype logins/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        childAccounts: [
          {
            id: "child-prototype-collision",
            parentEmail: "parent@example.com",
            name: "Kai Cho",
            username: "Parent123",
            age: "7",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/custom login usernames cannot collide with built-in prototype logins/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        managedAccounts: [
          {
            id: "managed-dev-collision",
            displayName: "Developer Collision",
            username: "Dev123",
            role: "staff",
            status: "active",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/custom login usernames cannot collide with built-in prototype logins/i);
  });

  it("exports custom login accounts without duplicate or prototype usernames", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        accounts: [
          {
            email: "family@example.com",
            password: "FamilyPass123",
            createdAt: "2026-06-01T09:00:00.000Z"
          }
        ],
        managedAccounts: [
          {
            id: "managed-primary",
            displayName: "Jordan Lee",
            username: " jordan.staff ",
            password: "PrimaryStaffSecret123",
            role: "staff",
            status: "active",
            access: ["reports"],
            createdAt: "2026-06-01T10:00:00.000Z"
          },
          {
            id: "managed-duplicate",
            displayName: "Jordan Duplicate",
            username: "Jordan.Staff",
            password: "DuplicateStaffSecret123",
            role: "staff",
            status: "active",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:05:00.000Z"
          },
          {
            id: "managed-prototype",
            displayName: "Prototype Collision",
            username: "Manager123",
            password: "PrototypeStaffSecret123",
            role: "staff",
            status: "active",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ],
        childAccounts: [
          {
            id: "child-valid",
            parentEmail: "family@example.com",
            name: "Kai Cho",
            username: " kai.child ",
            password: "KaiSecret123",
            age: "7",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:20:00.000Z"
          },
          {
            id: "child-managed-duplicate",
            parentEmail: "family@example.com",
            name: "Jordan Child",
            username: "JORDAN.STAFF",
            password: "ChildManagedDuplicate123",
            age: "8",
            beltSlug: "white",
            createdAt: "2026-06-01T10:25:00.000Z"
          },
          {
            id: "child-duplicate",
            parentEmail: "family@example.com",
            name: "Kai Duplicate",
            username: "KAI.CHILD",
            password: "ChildDuplicate123",
            age: "9",
            beltSlug: "green",
            createdAt: "2026-06-01T10:30:00.000Z"
          },
          {
            id: "child-prototype",
            parentEmail: "family@example.com",
            name: "Prototype Child",
            username: "Parent123",
            password: "ChildPrototype123",
            age: "10",
            beltSlug: "blue",
            createdAt: "2026-06-01T10:35:00.000Z"
          }
        ],
        accountRoles: [
          { email: "jordan.staff", role: "staff" },
          { email: "kai.child", role: "student" },
          { email: "manager123", role: "staff" },
          { email: "parent123", role: "student" }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.managedAccounts).toEqual([
      expect.objectContaining({ id: "managed-primary", username: "jordan.staff" })
    ]);
    expect(snapshot.data.childAccounts).toEqual([
      expect.objectContaining({ id: "child-valid", username: "kai.child" })
    ]);
    expect(snapshot.data.accountRoles).toEqual([
      { email: "jordan.staff", role: "staff" },
      { email: "kai.child", role: "student" }
    ]);
    expect(snapshot.sections.find((section) => section.id === "managedAccounts")).toEqual(expect.objectContaining({ count: 1 }));
    expect(snapshot.sections.find((section) => section.id === "childAccounts")).toEqual(expect.objectContaining({ count: 1 }));
    expect(JSON.stringify(snapshot.data)).not.toContain("DuplicateStaffSecret123");
    expect(JSON.stringify(snapshot.data)).not.toContain("PrototypeStaffSecret123");
    expect(JSON.stringify(snapshot.data)).not.toContain("ChildManagedDuplicate123");
    expect(JSON.stringify(snapshot.data)).not.toContain("ChildDuplicate123");
    expect(JSON.stringify(snapshot.data)).not.toContain("ChildPrototype123");
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.managedAccounts).toHaveLength(1);
  });

  it("rejects restored registered accounts that collide with prototype identities", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accounts: [
          {
            email: "manager123@chos.prototype",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      })
    ))).toThrow(/registered accounts cannot collide with built-in prototype identities/i);
  });

  it("rejects restored registered accounts that collide with custom login usernames", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accounts: [
          {
            email: "jordan.staff@example.com",
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ],
        managedAccounts: [
          {
            id: "managed-email-shaped-staff",
            displayName: "Jordan Lee",
            username: "jordan.staff@example.com",
            role: "staff",
            status: "active",
            access: ["reports"],
            createdAt: "2026-06-01T10:05:00.000Z"
          }
        ]
      })
    ))).toThrow(/registered accounts cannot collide with restored custom login usernames/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accounts: [
          {
            email: "parent@example.com",
            createdAt: "2026-06-01T10:00:00.000Z"
          },
          {
            email: "kai.child@example.com",
            createdAt: "2026-06-01T10:05:00.000Z"
          }
        ],
        accountRoles: [
          { email: "parent@example.com", role: "guardian" }
        ],
        childAccounts: [
          {
            id: "child-email-shaped-login",
            parentEmail: "parent@example.com",
            name: "Kai Cho",
            username: "kai.child@example.com",
            age: "9",
            beltSlug: "white",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/registered accounts cannot collide with restored custom login usernames/i);
  });

  it("exports registered accounts without stale login identity collisions", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        accounts: [
          {
            email: " family@example.com ",
            password: "FamilyPass123",
            createdAt: "2026-06-01T09:00:00.000Z"
          },
          {
            email: "Family@Example.com",
            password: "DuplicatePass123",
            createdAt: "2026-06-01T09:05:00.000Z"
          },
          {
            email: "manager123@chos.prototype",
            password: "PrototypePass123",
            createdAt: "2026-06-01T09:10:00.000Z"
          },
          {
            email: "jordan.staff@example.com",
            password: "ManagedCollision123",
            createdAt: "2026-06-01T09:15:00.000Z"
          },
          {
            email: "kai.child@example.com",
            password: "ChildCollision123",
            createdAt: "2026-06-01T09:20:00.000Z"
          }
        ],
        managedAccounts: [
          {
            id: "managed-email-shaped-staff",
            displayName: "Jordan Lee",
            username: "jordan.staff@example.com",
            password: "StaffSecret123",
            role: "staff",
            status: "active",
            access: ["reports"],
            createdAt: "2026-06-01T10:05:00.000Z"
          }
        ],
        childAccounts: [
          {
            id: "child-kai",
            parentEmail: "family@example.com",
            name: "Kai Cho",
            username: "kai.child@example.com",
            password: "ChildSecret123",
            age: "9",
            beltSlug: "white",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ],
        accountRoles: [
          { email: "family@example.com", role: "guardian" },
          { email: "jordan.staff@example.com", role: "staff" },
          { email: "kai.child@example.com", role: "student" }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.accounts).toEqual([
      expect.objectContaining({ email: "family@example.com" })
    ]);
    expect(snapshot.data.accounts[0]).not.toHaveProperty("password");
    expect(snapshot.data.accountRoles).toEqual([
      { email: "family@example.com", role: "guardian" },
      { email: "jordan.staff@example.com", role: "staff" },
      { email: "kai.child@example.com", role: "student" }
    ]);
    expect(snapshot.sections.find((section) => section.id === "accounts")).toEqual(expect.objectContaining({ count: 1 }));
    expect(snapshot.sections.find((section) => section.id === "childAccounts")).toEqual(expect.objectContaining({ count: 1 }));
    expect(JSON.stringify(snapshot.data)).not.toContain("FamilyPass123");
    expect(JSON.stringify(snapshot.data)).not.toContain("DuplicatePass123");
    expect(JSON.stringify(snapshot.data)).not.toContain("PrototypePass123");
    expect(JSON.stringify(snapshot.data)).not.toContain("ManagedCollision123");
    expect(JSON.stringify(snapshot.data)).not.toContain("ChildCollision123");
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.accounts).toHaveLength(1);
  });

  it("rejects restored child accounts without restored guardian parents", () => {
    const prototypeParentChild = parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        childAccounts: [
          {
            id: "child-prototype-parent",
            parentEmail: "parent123@chos.prototype",
            name: "Kai Cho",
            username: "kai-cho.child",
            age: "7",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ));
    expect(prototypeParentChild.data.childAccounts).toHaveLength(1);

    const restoredGuardianChild = parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accounts: [
          { email: "parent@example.com", createdAt: "2026-06-01T09:00:00.000Z" }
        ],
        accountRoles: [
          { email: "parent@example.com", role: "guardian" },
          { email: "nora.child", role: "student" }
        ],
        childAccounts: [
          {
            id: "child-restored-parent",
            parentEmail: "parent@example.com",
            name: "Nora Cho",
            username: "nora.child",
            age: "8",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ));
    expect(restoredGuardianChild.data.childAccounts).toHaveLength(1);

    const restoredRegisteredParentChild = parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accounts: [
          { email: "registered.parent@example.com", createdAt: "2026-06-01T09:00:00.000Z" }
        ],
        childAccounts: [
          {
            id: "child-registered-parent",
            parentEmail: "registered.parent@example.com",
            name: "Mina Cho",
            username: "mina.child",
            age: "7",
            beltSlug: "white",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ));
    expect(restoredRegisteredParentChild.data.childAccounts).toHaveLength(1);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        childAccounts: [
          {
            id: "child-orphaned-parent",
            parentEmail: "missing.parent@example.com",
            name: "Mina Cho",
            username: "mina.child",
            age: "7",
            beltSlug: "white",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/childAccounts entries can only reference restored guardian parent identities/i);
  });

  it("exports child accounts only when their parent login is restorable", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        accounts: [
          {
            email: "family@example.com",
            password: "FamilyPass123",
            createdAt: "2026-06-01T09:00:00.000Z"
          }
        ],
        childAccounts: [
          {
            id: "child-registered-parent",
            parentEmail: "family@example.com",
            name: "Kai Cho",
            username: "kai.child",
            password: "ChildSecret123",
            age: "7",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          },
          {
            id: "child-padded-parent",
            parentEmail: " family@example.com ",
            name: "Mina Cho",
            username: "mina.child",
            password: "MinaSecret123",
            age: "8",
            beltSlug: "white",
            createdAt: "2026-06-01T10:20:00.000Z"
          },
          {
            id: "child-prototype-parent",
            parentEmail: "parent123@chos.prototype",
            name: "Nora Cho",
            username: "nora.child",
            age: "9",
            beltSlug: "green",
            createdAt: "2026-06-01T10:30:00.000Z"
          },
          {
            id: "child-orphaned-parent",
            parentEmail: "missing.parent@example.com",
            name: "Orphan Child",
            username: "orphan.child",
            password: "OrphanSecret123",
            age: "10",
            beltSlug: "blue",
            createdAt: "2026-06-01T10:40:00.000Z"
          }
        ],
        accountRoles: [
          { email: "kai.child", role: "student" },
          { email: "mina.child", role: "student" },
          { email: "nora.child", role: "student" },
          { email: "orphan.child", role: "student" }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.childAccounts).toEqual([
      expect.objectContaining({ id: "child-registered-parent", parentEmail: "family@example.com", hasSavedPassword: true }),
      expect.objectContaining({ id: "child-padded-parent", parentEmail: "family@example.com", hasSavedPassword: true }),
      expect.objectContaining({ id: "child-prototype-parent", parentEmail: "parent123@chos.prototype", hasSavedPassword: false })
    ]);
    expect(snapshot.data.childAccounts).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "child-orphaned-parent" })
    ]));
    expect(snapshot.data.accountRoles).toEqual([
      { email: "kai.child", role: "student" },
      { email: "mina.child", role: "student" },
      { email: "nora.child", role: "student" }
    ]);
    expect(snapshot.sections.find((section) => section.id === "childAccounts")).toEqual(expect.objectContaining({ count: 3 }));
    expect(snapshot.sections.find((section) => section.id === "accountRoles")).toEqual(expect.objectContaining({ count: 3 }));
    expect(JSON.stringify(snapshot.data)).not.toContain("FamilyPass123");
    expect(JSON.stringify(snapshot.data)).not.toContain("ChildSecret123");
    expect(JSON.stringify(snapshot.data)).not.toContain("MinaSecret123");
    expect(JSON.stringify(snapshot.data)).not.toContain("OrphanSecret123");
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.childAccounts).toHaveLength(3);
  });

  it("exports account roles from restored login identities so backups stay restorable", () => {
    const snapshot = buildOperationsBackupSnapshot(
      makeBackupInput({
        accounts: [
          {
            email: "family@example.com",
            password: "FamilyPass123",
            createdAt: "2026-06-01T09:00:00.000Z"
          }
        ],
        managedAccounts: [
          {
            id: "managed-jordan",
            displayName: "Jordan Lee",
            username: "jordan.staff",
            password: "StaffSecret123",
            role: "staff",
            status: "active",
            access: ["reports"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ],
        childAccounts: [
          {
            id: "child-kai",
            parentEmail: "family@example.com",
            name: "Kai Cho",
            username: "kai.child",
            password: "ChildSecret123",
            age: "7",
            beltSlug: "yellow",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ],
        accountRoles: [
          { email: " family@example.com ", role: "staff" },
          { email: "jordan.staff", role: "guardian" },
          { email: "kai.child", role: "guardian" },
          { email: "manager123@chos.prototype", role: "guardian" },
          { email: "dev123@chos.prototype", role: "guardian" },
          { email: "missing.login@example.com", role: "staff" }
        ]
      }),
      "2026-06-02T12:00:00.000Z"
    );

    expect(snapshot.data.accountRoles).toEqual([
      { email: "family@example.com", role: "guardian" },
      { email: "jordan.staff", role: "staff" },
      { email: "kai.child", role: "student" },
      { email: "manager123@chos.prototype", role: "staff" },
      { email: "dev123@chos.prototype", role: "staff" }
    ]);
    expect(snapshot.sections.find((section) => section.id === "accountRoles")).toEqual(expect.objectContaining({ count: 5 }));
    expect(JSON.stringify(snapshot.data)).not.toContain("FamilyPass123");
    expect(JSON.stringify(snapshot.data)).not.toContain("StaffSecret123");
    expect(JSON.stringify(snapshot.data)).not.toContain("ChildSecret123");
    expect(parseOperationsBackupSnapshot(JSON.stringify(snapshot)).data.accountRoles).toHaveLength(5);
  });

  it("rejects malformed account role records", () => {
    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accountRoles: [
          { role: "staff" }
        ]
      })
    ))).toThrow(/accountRoles entries must include string emails/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accountRoles: [
          { email: "jordan.staff", role: "owner" }
        ]
      })
    ))).toThrow(/accountRoles entries must use supported roles/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accountRoles: [
          { email: "jordan.staff", role: "staff" },
          { email: "Jordan.Staff", role: "student" }
        ]
      })
    ))).toThrow(/accountRoles entries must have unique emails/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accountRoles: [
          { email: "student123@chos.prototype", role: "staff" }
        ]
      })
    ))).toThrow(/built-in prototype accountRoles must match their reserved roles/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accountRoles: [
          { email: "dev123@chos.prototype", role: "guardian" }
        ]
      })
    ))).toThrow(/built-in prototype accountRoles must match their reserved roles/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        managedAccounts: [
          {
            id: "managed-jordan",
            displayName: "Jordan Lee",
            username: "jordan.staff",
            role: "staff",
            status: "active",
            access: ["dashboard"],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ],
        accountRoles: [
          { email: "missing-login@example.com", role: "staff" }
        ]
      })
    ))).toThrow(/accountRoles entries can only reference restored login identities/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accounts: [
          { email: "family@example.com", createdAt: "2026-06-01T09:00:00.000Z" }
        ],
        accountRoles: [
          { email: "family@example.com", role: "staff" }
        ]
      })
    ))).toThrow(/accountRoles entries must match restored login account roles/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        accounts: [
          { email: "parent@example.com", createdAt: "2026-06-01T09:00:00.000Z" }
        ],
        accountRoles: [
          { email: "parent@example.com", role: "guardian" },
          { email: "kai.child", role: "staff" }
        ],
        childAccounts: [
          {
            id: "child-kai",
            parentEmail: "parent@example.com",
            name: "Kai Cho",
            username: "kai.child",
            age: "9",
            beltSlug: "white",
            createdAt: "2026-06-01T10:10:00.000Z"
          }
        ]
      })
    ))).toThrow(/accountRoles entries must match restored login account roles/i);

    expect(() => parseOperationsBackupSnapshot(JSON.stringify(
      makeBackupPayload({
        managedAccounts: [
          {
            id: "managed-avery",
            displayName: "Avery Kim",
            username: "avery.student",
            role: "student",
            status: "inactive",
            access: [],
            createdAt: "2026-06-01T10:00:00.000Z"
          }
        ],
        accountRoles: [
          { email: "avery.student", role: "staff" }
        ]
      })
    ))).toThrow(/accountRoles entries must match restored login account roles/i);
  });
});
