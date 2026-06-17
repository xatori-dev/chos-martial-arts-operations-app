import type { LiveChatMessage } from "./supabaseLiveChat";
import type { MessageNotificationSettings } from "./types";

export type BrowserNotificationPermission = NotificationPermission | "unsupported";
export type WebPushNotificationChannel = "messages" | "liveChats" | "mentions";

export type LiveChatNotificationPlan = {
  channel: "liveChats" | "mentions";
  title: string;
  options: NotificationOptions;
  settingsPatch: Partial<MessageNotificationSettings>;
};

function trimmed(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function mentionsProfile(message: LiveChatMessage, profileName?: string) {
  const body = message.body.toLowerCase();
  const normalizedProfileName = trimmed(profileName).toLowerCase();
  return body.includes("@cho") || (normalizedProfileName ? body.includes(`@${normalizedProfileName}`) : false);
}

function shouldSuppressByTimestamp(createdAt: string, lastNotifiedAt?: string) {
  return Boolean(lastNotifiedAt && createdAt <= lastNotifiedAt);
}

export function enabledWebPushNotificationChannels(settings: Pick<MessageNotificationSettings, "browserNotificationsEnabled" | "liveChatNotificationsEnabled" | "mentionNotificationsEnabled">): WebPushNotificationChannel[] {
  const channels: WebPushNotificationChannel[] = [];
  if (settings.browserNotificationsEnabled) channels.push("messages");
  if (settings.liveChatNotificationsEnabled) channels.push("liveChats");
  if (settings.mentionNotificationsEnabled) channels.push("mentions");
  return channels;
}

export function buildLiveChatNotificationPlan({
  browserPermission,
  currentUserId,
  message,
  notificationUrl,
  profileName,
  settings
}: {
  browserPermission: BrowserNotificationPermission;
  currentUserId?: string;
  message: LiveChatMessage;
  notificationUrl: string;
  profileName?: string;
  settings: MessageNotificationSettings;
}): LiveChatNotificationPlan | undefined {
  if (browserPermission !== "granted") return undefined;
  if (currentUserId && message.senderUserId === currentUserId) return undefined;

  const isMention = mentionsProfile(message, profileName);
  const channel = isMention && settings.mentionNotificationsEnabled
    ? "mentions"
    : settings.liveChatNotificationsEnabled
      ? "liveChats"
      : undefined;
  if (!channel) return undefined;

  const lastNotifiedAt = channel === "mentions" ? settings.lastBrowserNotifiedMentionAt : settings.lastBrowserNotifiedLiveChatAt;
  if (shouldSuppressByTimestamp(message.createdAt, lastNotifiedAt)) return undefined;

  const senderName = trimmed(message.senderName) || "Live Chat";
  const isMentionNotification = channel === "mentions";
  return {
    channel,
    title: isMentionNotification ? `${senderName} mentioned you in Live Chat` : `New Live Chat from ${senderName}`,
    options: {
      body: trimmed(message.body) || "Open Cho's Martial Arts to view the latest live chat message.",
      tag: isMentionNotification ? `chos-live-chat-mention-${message.id}` : `chos-live-chat-${message.id}`,
      data: {
        url: notificationUrl,
        liveChatMessageId: message.id,
        notificationChannel: channel
      }
    },
    settingsPatch: {
      browserPermission: "granted",
      ...(isMentionNotification
        ? { lastBrowserNotifiedMentionAt: message.createdAt }
        : { lastBrowserNotifiedLiveChatAt: message.createdAt })
    }
  };
}
