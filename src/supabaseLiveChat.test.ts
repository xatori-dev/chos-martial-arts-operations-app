import { describe, expect, it, vi } from "vitest";
import {
  fetchLiveChatMessages,
  liveChatMessageMaxLength,
  liveChatRoomKey,
  sendLiveChatMessage,
  subscribeToLiveChatInserts,
  type LiveChatChannel,
  type LiveChatClient,
  type LiveChatMessage,
  type LiveChatMessageRow
} from "./supabaseLiveChat";
import type { SupabaseStoredSession } from "./supabaseAccounts";

function liveChatRow(overrides: Partial<LiveChatMessageRow> = {}): LiveChatMessageRow {
  return {
    id: "message-1",
    room_key: liveChatRoomKey,
    sender_user_id: "staff-user-id",
    sender_name: "Coach Jordan",
    sender_role: "staff",
    sender_avatar_path: "assets/CheetahProfilePic/Cheetah.png",
    message_kind: "user",
    body: "Ready for tonight.",
    created_at: "2026-06-12T23:00:00.000Z",
    ...overrides
  };
}

function liveChatQuery({
  limitData = [],
  maybeSingleData = null,
  singleData = liveChatRow()
}: {
  limitData?: LiveChatMessageRow[];
  maybeSingleData?: unknown;
  singleData?: LiveChatMessageRow;
} = {}) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.insert = vi.fn(() => query);
  query.limit = vi.fn(async () => ({ data: limitData, error: null }));
  query.maybeSingle = vi.fn(async () => ({ data: maybeSingleData, error: null }));
  query.single = vi.fn(async () => ({ data: singleData, error: null }));
  return query;
}

function testSession(): SupabaseStoredSession {
  return {
    accessToken: "staff-access-token",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    userId: "staff-user-id"
  };
}

describe("supabase live chat adapter", () => {
  it("returns unavailable when no Supabase client or session exists", async () => {
    await expect(fetchLiveChatMessages({ client: undefined })).resolves.toMatchObject({
      status: "unavailable",
      message: expect.stringContaining("Supabase sign-in required")
    });

    await expect(sendLiveChatMessage({ body: "Hello team", client: undefined, session: undefined })).resolves.toMatchObject({
      status: "unavailable",
      message: expect.stringContaining("Supabase sign-in required")
    });
  });

  it("fetches latest rows and maps them into chronological UI messages", async () => {
    const newer = liveChatRow({ id: "message-2", body: "Doors are open.", created_at: "2026-06-12T23:02:00.000Z" });
    const older = liveChatRow({ id: "message-1", body: "Ready for tonight.", created_at: "2026-06-12T23:00:00.000Z" });
    const messagesQuery = liveChatQuery({ limitData: [newer, older] });
    const client = {
      from: vi.fn(() => messagesQuery),
      channel: vi.fn(),
      removeChannel: vi.fn()
    } as unknown as LiveChatClient;

    const result = await fetchLiveChatMessages({ client, limit: 2 });

    expect(result.status).toBe("ok");
    expect(result).toMatchObject({
      data: [
        { id: "message-1", body: "Ready for tonight.", roomKey: liveChatRoomKey },
        { id: "message-2", body: "Doors are open.", roomKey: liveChatRoomKey }
      ]
    });
    expect(messagesQuery.select).toHaveBeenCalledWith(expect.stringContaining("sender_name"));
    expect(messagesQuery.eq).toHaveBeenCalledWith("room_key", liveChatRoomKey);
    expect(messagesQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(messagesQuery.limit).toHaveBeenCalledWith(2);
  });

  it("sends trimmed staff messages and rejects empty or overlong bodies", async () => {
    const profileQuery = liveChatQuery({
      maybeSingleData: {
        id: "staff-user-id",
        display_name: "Coach Jordan",
        role: "staff",
        status: "active"
      }
    });
    const insertQuery = liveChatQuery({
      singleData: liveChatRow({ id: "message-3", body: "Line up by 6:00." })
    });
    const client = {
      from: vi.fn((table: string) => (table === "profiles" ? profileQuery : insertQuery)),
      channel: vi.fn(),
      removeChannel: vi.fn()
    } as unknown as LiveChatClient;

    await expect(sendLiveChatMessage({ body: "   ", client, session: testSession() })).resolves.toMatchObject({
      status: "error",
      message: "Enter a message before sending."
    });
    await expect(sendLiveChatMessage({ body: "x".repeat(liveChatMessageMaxLength + 1), client, session: testSession() })).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining(`${liveChatMessageMaxLength} characters`)
    });

    const result = await sendLiveChatMessage({
      body: "  Line up by 6:00.  ",
      client,
      session: testSession(),
      senderAvatarPath: "assets/CheetahProfilePic/Cheetah.png"
    });

    expect(result).toMatchObject({ status: "ok", data: { id: "message-3", body: "Line up by 6:00." } });
    expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      sender_user_id: "staff-user-id",
      sender_name: "Coach Jordan",
      sender_role: "staff",
      message_kind: "user",
      body: "Line up by 6:00."
    }));
  });

  it("subscribes to inserts and removes the realtime channel on cleanup", () => {
    let insertCallback: ((payload: { new: LiveChatMessageRow }) => void) | undefined;
    let statusCallback: ((status: string) => void) | undefined;
    const channel: LiveChatChannel = {
      on: vi.fn((_, __, callback) => {
        insertCallback = callback;
        return channel;
      }),
      subscribe: vi.fn((callback) => {
        statusCallback = callback;
        return channel;
      }),
      unsubscribe: vi.fn()
    };
    const client = {
      from: vi.fn(),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      realtime: {
        setAuth: vi.fn()
      }
    } as unknown as LiveChatClient;
    const receivedMessages: LiveChatMessage[] = [];
    const receivedStatuses: string[] = [];

    const subscription = subscribeToLiveChatInserts({
      client,
      session: testSession(),
      onMessage: (message) => receivedMessages.push(message),
      onStatus: (status) => receivedStatuses.push(status)
    });

    statusCallback?.("SUBSCRIBED");
    insertCallback?.({ new: liveChatRow({ id: "message-4", body: "New check-in at front desk." }) });
    subscription.cleanup();

    expect(subscription.status).toBe("subscribed");
    expect(client.realtime?.setAuth).toHaveBeenCalledWith("staff-access-token");
    expect(client.channel).toHaveBeenCalledWith(`live-chat:${liveChatRoomKey}`);
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `room_key=eq.${liveChatRoomKey}` },
      expect.any(Function)
    );
    expect(receivedStatuses).toEqual(["SUBSCRIBED"]);
    expect(receivedMessages).toEqual([expect.objectContaining({ id: "message-4", body: "New check-in at front desk." })]);
    expect(channel.unsubscribe).toHaveBeenCalled();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
