import { describe, expect, it } from "vitest";
import { liveChatRoomKey, type LiveChatMessage } from "./supabaseLiveChat";
import {
  buildLiveChatNotificationPlan,
  enabledWebPushNotificationChannels
} from "./notificationRouting";
import type { MessageNotificationSettings } from "./types";

function liveChatMessage(overrides: Partial<LiveChatMessage> = {}): LiveChatMessage {
  return {
    id: "live-message-1",
    roomKey: liveChatRoomKey,
    senderUserId: "other-staff-user-id",
    senderName: "Coach Jordan",
    senderRole: "staff",
    senderAvatarPath: null,
    messageKind: "user",
    body: "Please check the front desk.",
    createdAt: "2026-06-17T16:30:00.000Z",
    ...overrides
  };
}

describe("notification routing", () => {
  it("routes live-chat messages to mention notifications before general live-chat alerts", () => {
    const settings: MessageNotificationSettings = {
      browserNotificationsEnabled: false,
      liveChatNotificationsEnabled: true,
      mentionNotificationsEnabled: true,
      browserPermission: "granted"
    };

    const plan = buildLiveChatNotificationPlan({
      message: liveChatMessage({ body: "@Cho please check the front desk." }),
      settings,
      browserPermission: "granted",
      currentUserId: "manager-user-id",
      profileName: "Cho's Manager",
      notificationUrl: "https://cho.example.com/live-chat"
    });

    expect(plan).toEqual({
      channel: "mentions",
      settingsPatch: {
        browserPermission: "granted",
        lastBrowserNotifiedMentionAt: "2026-06-17T16:30:00.000Z"
      },
      title: "Coach Jordan mentioned you in Live Chat",
      options: expect.objectContaining({
        body: "@Cho please check the front desk.",
        tag: "chos-live-chat-mention-live-message-1",
        data: {
          url: "https://cho.example.com/live-chat",
          liveChatMessageId: "live-message-1",
          notificationChannel: "mentions"
        }
      })
    });
  });

  it("suppresses self, duplicate, and disabled live-chat browser notifications", () => {
    const settings: MessageNotificationSettings = {
      browserNotificationsEnabled: true,
      liveChatNotificationsEnabled: true,
      mentionNotificationsEnabled: false,
      browserPermission: "granted",
      lastBrowserNotifiedLiveChatAt: "2026-06-17T16:30:00.000Z"
    };

    expect(buildLiveChatNotificationPlan({
      message: liveChatMessage({ senderUserId: "manager-user-id", createdAt: "2026-06-17T16:31:00.000Z" }),
      settings,
      browserPermission: "granted",
      currentUserId: "manager-user-id",
      profileName: "Cho's Manager",
      notificationUrl: "https://cho.example.com/live-chat"
    })).toBeUndefined();

    expect(buildLiveChatNotificationPlan({
      message: liveChatMessage(),
      settings,
      browserPermission: "granted",
      currentUserId: "manager-user-id",
      profileName: "Cho's Manager",
      notificationUrl: "https://cho.example.com/live-chat"
    })).toBeUndefined();

    expect(buildLiveChatNotificationPlan({
      message: liveChatMessage({ createdAt: "2026-06-17T16:31:00.000Z" }),
      settings: { ...settings, liveChatNotificationsEnabled: false },
      browserPermission: "granted",
      currentUserId: "manager-user-id",
      profileName: "Cho's Manager",
      notificationUrl: "https://cho.example.com/live-chat"
    })).toBeUndefined();
  });

  it("carries selected profile toggles into Web Push subscription channel preferences", () => {
    expect(enabledWebPushNotificationChannels({
      browserNotificationsEnabled: true,
      liveChatNotificationsEnabled: true,
      mentionNotificationsEnabled: false
    })).toEqual(["messages", "liveChats"]);

    expect(enabledWebPushNotificationChannels({
      browserNotificationsEnabled: false,
      liveChatNotificationsEnabled: false,
      mentionNotificationsEnabled: true
    })).toEqual(["mentions"]);
  });
});
