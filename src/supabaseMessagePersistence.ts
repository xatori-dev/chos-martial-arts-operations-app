import type { DirectMessage, MessageLog } from "./types";
import { getSupabaseBrowserConfig, isSupabaseAuthConfigured, readSupabaseAuthSession } from "./supabaseAccounts";

type SupabasePersistenceResult<T = undefined> =
  | { status: "ok"; data: T }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

type DirectMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string;
  recipient_name: string;
  body: string;
  status: "sent";
  created_at: string;
};

type MessageLogRow = {
  id: string;
  kind: MessageLog["kind"];
  recipient_name: string;
  recipient_phone: string;
  recipient_role: MessageLog["recipientRole"] | null;
  recipient_id: string | null;
  body: string;
  status: MessageLog["status"];
  created_at: string;
  sent_at: string | null;
  campaign_id: string | null;
  delivery_channel: MessageLog["deliveryChannel"] | null;
  delivery_provider: MessageLog["deliveryProvider"] | null;
  delivery_mode: MessageLog["deliveryMode"] | null;
  delivery_status: MessageLog["deliveryStatus"] | null;
  delivery_detail: string | null;
  delivery_provider_message_id: string | null;
};

const directMessageColumns = "id,thread_id,sender_id,sender_name,recipient_id,recipient_name,body,status,created_at";
const messageLogColumns = [
  "id",
  "kind",
  "recipient_name",
  "recipient_phone",
  "recipient_role",
  "recipient_id",
  "body",
  "status",
  "created_at",
  "sent_at",
  "campaign_id",
  "delivery_channel",
  "delivery_provider",
  "delivery_mode",
  "delivery_status",
  "delivery_detail",
  "delivery_provider_message_id"
].join(",");

function remotePersistenceUnavailableMessage() {
  if (!isSupabaseAuthConfigured()) return "Supabase is not configured for message persistence.";
  if (!readSupabaseAuthSession()) return "Supabase sign-in required for message persistence.";
  return undefined;
}

export function isSupabaseMessagePersistenceAvailable() {
  return !remotePersistenceUnavailableMessage();
}

function buildRestUrl(table: "direct_messages" | "message_logs", query?: Record<string, string>) {
  const { url } = getSupabaseBrowserConfig();
  const restUrl = new URL(`${url.replace(/\/+$/, "")}/rest/v1/${table}`);
  Object.entries(query ?? {}).forEach(([key, value]) => restUrl.searchParams.set(key, value));
  return restUrl.toString();
}

function authHeaders(extraHeaders?: HeadersInit) {
  const session = readSupabaseAuthSession();
  const { publicKey } = getSupabaseBrowserConfig();
  if (!session || !publicKey) return undefined;
  return {
    apikey: publicKey,
    Authorization: `Bearer ${session.accessToken}`,
    ...extraHeaders
  };
}

function postgrestInFilter(values: readonly string[]) {
  return `in.(${values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`;
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function restRequest<T>(table: "direct_messages" | "message_logs", query: Record<string, string>, init?: RequestInit): Promise<SupabasePersistenceResult<T>> {
  const unavailable = remotePersistenceUnavailableMessage();
  if (unavailable) return { status: "unavailable", message: unavailable };

  const headers = authHeaders(init?.headers);
  if (!headers) return { status: "unavailable", message: "Supabase sign-in required for message persistence." };

  try {
    const response = await fetch(buildRestUrl(table, query), { ...init, headers });
    if (!response.ok) return { status: "error", message: await readErrorMessage(response) };
    if (response.status === 204) return { status: "ok", data: undefined as T };
    return { status: "ok", data: (await response.json()) as T };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Supabase message persistence failed." };
  }
}

function toDirectMessageRow(message: DirectMessage): DirectMessageRow {
  return {
    id: message.id,
    thread_id: message.threadId,
    sender_id: message.senderId,
    sender_name: message.senderName,
    recipient_id: message.recipientId,
    recipient_name: message.recipientName,
    body: message.body,
    status: message.status,
    created_at: message.createdAt
  };
}

function fromDirectMessageRow(row: DirectMessageRow): DirectMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    recipientId: row.recipient_id,
    recipientName: row.recipient_name,
    body: row.body,
    status: row.status,
    createdAt: row.created_at
  };
}

function toMessageLogRow(message: MessageLog): MessageLogRow {
  return {
    id: message.id,
    kind: message.kind,
    recipient_name: message.recipientName,
    recipient_phone: message.recipientPhone,
    recipient_role: message.recipientRole ?? null,
    recipient_id: message.recipientId ?? null,
    body: message.body,
    status: message.status,
    created_at: message.createdAt,
    sent_at: message.sentAt ?? null,
    campaign_id: message.campaignId ?? null,
    delivery_channel: message.deliveryChannel ?? null,
    delivery_provider: message.deliveryProvider ?? null,
    delivery_mode: message.deliveryMode ?? null,
    delivery_status: message.deliveryStatus ?? null,
    delivery_detail: message.deliveryDetail ?? null,
    delivery_provider_message_id: message.deliveryProviderMessageId ?? null
  };
}

function fromMessageLogRow(row: MessageLogRow): MessageLog {
  return {
    id: row.id,
    kind: row.kind,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    ...(row.recipient_role ? { recipientRole: row.recipient_role } : {}),
    ...(row.recipient_id ? { recipientId: row.recipient_id } : {}),
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    ...(row.sent_at ? { sentAt: row.sent_at } : {}),
    ...(row.campaign_id ? { campaignId: row.campaign_id } : {}),
    ...(row.delivery_channel ? { deliveryChannel: row.delivery_channel } : {}),
    ...(row.delivery_provider ? { deliveryProvider: row.delivery_provider } : {}),
    ...(row.delivery_mode ? { deliveryMode: row.delivery_mode } : {}),
    ...(row.delivery_status ? { deliveryStatus: row.delivery_status } : {}),
    ...(row.delivery_detail ? { deliveryDetail: row.delivery_detail } : {}),
    ...(row.delivery_provider_message_id ? { deliveryProviderMessageId: row.delivery_provider_message_id } : {})
  };
}

export async function fetchSupabaseDirectMessages(): Promise<SupabasePersistenceResult<DirectMessage[]>> {
  const result = await restRequest<DirectMessageRow[]>("direct_messages", { select: directMessageColumns, order: "created_at.asc" });
  if (result.status !== "ok") return result;
  return { status: "ok", data: result.data.map(fromDirectMessageRow) };
}

export async function fetchSupabaseMessageLogs(): Promise<SupabasePersistenceResult<MessageLog[]>> {
  const result = await restRequest<MessageLogRow[]>("message_logs", { select: messageLogColumns, order: "created_at.asc" });
  if (result.status !== "ok") return result;
  return { status: "ok", data: result.data.map(fromMessageLogRow) };
}

export async function persistSupabaseDirectMessages(messages: readonly DirectMessage[]): Promise<SupabasePersistenceResult> {
  if (!messages.length) return { status: "ok", data: undefined };
  return restRequest("direct_messages", { on_conflict: "id" }, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(messages.map(toDirectMessageRow))
  });
}

export async function persistSupabaseMessageLogs(messages: readonly MessageLog[]): Promise<SupabasePersistenceResult> {
  if (!messages.length) return { status: "ok", data: undefined };
  return restRequest("message_logs", { on_conflict: "id" }, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(messages.map(toMessageLogRow))
  });
}

export async function deleteSupabaseDirectMessages(ids: readonly string[]): Promise<SupabasePersistenceResult> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return { status: "ok", data: undefined };
  return restRequest("direct_messages", { id: postgrestInFilter(uniqueIds) }, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  });
}

export async function deleteSupabaseMessageLogs(ids: readonly string[]): Promise<SupabasePersistenceResult> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return { status: "ok", data: undefined };
  return restRequest("message_logs", { id: postgrestInFilter(uniqueIds) }, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  });
}
