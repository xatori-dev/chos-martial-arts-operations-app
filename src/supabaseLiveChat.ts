import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig, isSupabaseAuthConfigured, readSupabaseAuthSession, type SupabaseStoredSession } from "./supabaseAccounts";

export const liveChatRoomKey = "manager-global";
export const liveChatMessageLimit = 80;
export const liveChatMessageMaxLength = 500;

export type LiveChatMessageKind = "user" | "notice" | "system" | "reward";

export type LiveChatMessage = {
  id: string;
  roomKey: string;
  senderUserId: string | null;
  senderName: string;
  senderRole: "staff" | "system";
  senderAvatarPath: string | null;
  messageKind: LiveChatMessageKind;
  body: string;
  createdAt: string;
};

export type LiveChatMessageRow = {
  id: string;
  room_key: string;
  sender_user_id: string | null;
  sender_name: string;
  sender_role: "staff" | "system";
  sender_avatar_path: string | null;
  message_kind: LiveChatMessageKind;
  body: string;
  created_at: string;
};

type LiveChatProfileRow = {
  id: string;
  display_name: string;
  role: "staff" | "student" | "guardian";
  status: "active" | "inactive";
};

type SupabaseErrorLike = {
  message: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseErrorLike | null;
};

type LiveChatQuery = {
  select: (columns: string) => LiveChatQuery;
  eq: (column: string, value: unknown) => LiveChatQuery;
  order: (column: string, options: { ascending: boolean }) => LiveChatQuery;
  insert: (values: Record<string, unknown>) => LiveChatQuery;
  limit: (count: number) => Promise<SupabaseResult<LiveChatMessageRow[]>>;
  maybeSingle: () => Promise<SupabaseResult<LiveChatProfileRow | null>>;
  single: () => Promise<SupabaseResult<LiveChatMessageRow>>;
};

export type LiveChatChannel = {
  on: (
    type: "postgres_changes",
    filter: { event: "INSERT"; schema: "public"; table: "live_chat_messages"; filter: string },
    callback: (payload: { new: LiveChatMessageRow }) => void
  ) => LiveChatChannel;
  subscribe: (callback?: (status: string, error?: SupabaseErrorLike) => void) => LiveChatChannel;
  unsubscribe: () => unknown;
};

export type LiveChatClient = {
  from: (table: string) => LiveChatQuery;
  channel: (name: string) => LiveChatChannel;
  removeChannel: (channel: LiveChatChannel) => unknown;
};

export type LiveChatResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export type LiveChatSubscription = {
  status: "subscribed" | "unavailable";
  message?: string;
  cleanup: () => void;
};

const liveChatMessageColumns = "id,room_key,sender_user_id,sender_name,sender_role,sender_avatar_path,message_kind,body,created_at";
let cachedClient: LiveChatClient | undefined;

export function getSupabaseLiveChatClient() {
  if (!readSupabaseAuthSession()) return undefined;
  if (cachedClient) return cachedClient;
  const { url, publicKey } = getSupabaseBrowserConfig();
  if (!url || !publicKey) return undefined;

  cachedClient = createClient(url, publicKey, {
    accessToken: async () => readSupabaseAuthSession()?.accessToken ?? null,
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  }) as unknown as LiveChatClient;

  return cachedClient;
}

export function getLiveChatAvailability(session: SupabaseStoredSession | undefined = readSupabaseAuthSession()) {
  if (!session) {
    return { available: false, message: "Supabase sign-in required for live messages." };
  }

  if (!isSupabaseAuthConfigured()) {
    return { available: false, message: "Supabase is not configured for live chat." };
  }

  return { available: true, message: "Connected to Supabase live chat." };
}

export function mapLiveChatMessageRow(row: LiveChatMessageRow): LiveChatMessage {
  return {
    id: row.id,
    roomKey: row.room_key,
    senderUserId: row.sender_user_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    senderAvatarPath: row.sender_avatar_path,
    messageKind: row.message_kind,
    body: row.body,
    createdAt: row.created_at
  };
}

export function validateLiveChatBody(body: string) {
  const trimmedBody = body.trim();
  if (!trimmedBody) return { ok: false as const, message: "Enter a message before sending." };
  if (trimmedBody.length > liveChatMessageMaxLength) {
    return { ok: false as const, message: `Messages must be ${liveChatMessageMaxLength} characters or fewer.` };
  }
  return { ok: true as const, body: trimmedBody };
}

export async function fetchLiveChatMessages({
  client = getSupabaseLiveChatClient(),
  roomKey = liveChatRoomKey,
  limit = liveChatMessageLimit
}: {
  client?: LiveChatClient;
  roomKey?: string;
  limit?: number;
} = {}): Promise<LiveChatResult<LiveChatMessage[]>> {
  if (!client) return { status: "unavailable", message: "Supabase sign-in required for live messages." };

  const response = await client
    .from("live_chat_messages")
    .select(liveChatMessageColumns)
    .eq("room_key", roomKey)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (response.error) return { status: "error", message: response.error.message };

  return {
    status: "ok",
    data: [...(response.data ?? [])].reverse().map(mapLiveChatMessageRow)
  };
}

async function fetchLiveChatProfile(client: LiveChatClient, session: SupabaseStoredSession) {
  const response = await client
    .from("profiles")
    .select("id,display_name,role,status")
    .eq("id", session.userId)
    .maybeSingle();

  if (response.error) return { status: "error" as const, message: response.error.message };
  const profile = response.data;
  if (!profile || profile.role !== "staff" || profile.status !== "active") {
    return { status: "error" as const, message: "Only active staff accounts can send live chat messages." };
  }

  return { status: "ok" as const, data: profile };
}

export async function sendLiveChatMessage({
  body,
  senderAvatarPath,
  client = getSupabaseLiveChatClient(),
  session = readSupabaseAuthSession(),
  roomKey = liveChatRoomKey
}: {
  body: string;
  senderAvatarPath?: string;
  client?: LiveChatClient;
  session?: SupabaseStoredSession;
  roomKey?: string;
}): Promise<LiveChatResult<LiveChatMessage>> {
  const validation = validateLiveChatBody(body);
  if (!validation.ok) return { status: "error", message: validation.message };
  if (!client || !session) return { status: "unavailable", message: "Supabase sign-in required to send live chat messages." };

  const profileResult = await fetchLiveChatProfile(client, session);
  if (profileResult.status !== "ok") return { status: "error", message: profileResult.message };

  const response = await client
    .from("live_chat_messages")
    .insert({
      room_key: roomKey,
      sender_user_id: session.userId,
      sender_name: profileResult.data.display_name,
      sender_role: "staff",
      sender_avatar_path: senderAvatarPath ?? null,
      message_kind: "user",
      body: validation.body
    })
    .select(liveChatMessageColumns)
    .single();

  if (response.error) return { status: "error", message: response.error.message };
  if (!response.data) return { status: "error", message: "Live chat message was not returned after sending." };
  return { status: "ok", data: mapLiveChatMessageRow(response.data) };
}

export function subscribeToLiveChatInserts({
  onMessage,
  onStatus,
  client = getSupabaseLiveChatClient(),
  roomKey = liveChatRoomKey
}: {
  onMessage: (message: LiveChatMessage) => void;
  onStatus?: (status: string, message?: string) => void;
  client?: LiveChatClient;
  roomKey?: string;
}): LiveChatSubscription {
  if (!client) {
    return {
      status: "unavailable",
      message: "Supabase sign-in required for live messages.",
      cleanup: () => undefined
    };
  }

  const channel = client
    .channel(`live-chat:${roomKey}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `room_key=eq.${roomKey}` },
      (payload) => onMessage(mapLiveChatMessageRow(payload.new))
    )
    .subscribe((status, error) => onStatus?.(status, error?.message));

  return {
    status: "subscribed",
    cleanup: () => {
      void channel.unsubscribe();
      void client.removeChannel(channel);
    }
  };
}
