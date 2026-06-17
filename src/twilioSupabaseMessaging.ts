import type { TwilioRelayHealthReadinessChecks } from "./twilioRelayContract";

export const choStagingSupabaseProjectRef = "zfuwbbepsnmmlpgfkmhz";
export const twilioMessagingFunctionName = "twilio-messaging";

export type TwilioSupabaseMessagingUrls = {
  baseUrl: string;
  healthUrl: string;
  sendUrl: string;
  consentUrl: string;
  inboundWebhookUrl: string;
  statusCallbackUrlTemplate: string;
};

function cleanSupabaseUrl(supabaseUrl?: string) {
  const cleanUrl = supabaseUrl?.trim().replace(/\/+$/, "");
  return cleanUrl || `https://${choStagingSupabaseProjectRef}.supabase.co`;
}

export function buildTwilioSupabaseMessagingUrls(supabaseUrl?: string): TwilioSupabaseMessagingUrls {
  const baseUrl = `${cleanSupabaseUrl(supabaseUrl)}/functions/v1/${twilioMessagingFunctionName}`;
  return {
    baseUrl,
    healthUrl: `${baseUrl}/health`,
    sendUrl: `${baseUrl}/send`,
    consentUrl: `${baseUrl}/consent`,
    inboundWebhookUrl: `${baseUrl}/inbound`,
    statusCallbackUrlTemplate: `${baseUrl}/status/{messageId}`
  };
}

export function isSupabaseTwilioMessagingEndpoint(endpoint: string, supabaseUrl?: string) {
  try {
    const endpointUrl = new URL(endpoint.trim());
    const expectedUrl = new URL(buildTwilioSupabaseMessagingUrls(supabaseUrl).baseUrl);
    return endpointUrl.origin === expectedUrl.origin && endpointUrl.pathname.startsWith(expectedUrl.pathname);
  } catch {
    return false;
  }
}

export function twilioConsentSyncUrlForRelayEndpoint(endpoint: string, fallbackSupabaseUrl?: string) {
  if (!isSupabaseTwilioMessagingEndpoint(endpoint, fallbackSupabaseUrl)) {
    return buildTwilioSupabaseMessagingUrls(fallbackSupabaseUrl).consentUrl;
  }
  try {
    const endpointUrl = new URL(endpoint.trim());
    endpointUrl.pathname = endpointUrl.pathname.replace(/\/(?:send|health)\/?$/i, "/consent");
    if (!endpointUrl.pathname.endsWith("/consent")) endpointUrl.pathname = `${endpointUrl.pathname.replace(/\/+$/g, "")}/consent`;
    endpointUrl.search = "";
    endpointUrl.hash = "";
    return endpointUrl.toString();
  } catch {
    return buildTwilioSupabaseMessagingUrls(fallbackSupabaseUrl).consentUrl;
  }
}

export function isTwilioRelayHealthReady(status: string, checks?: TwilioRelayHealthReadinessChecks) {
  return status === "ready" && Boolean(checks) && Object.values(checks ?? {}).every(Boolean);
}
