import { describe, expect, it } from "vitest";
import {
  buildTwilioSupabaseMessagingUrls,
  choStagingSupabaseProjectRef,
  isSupabaseTwilioMessagingEndpoint,
  isTwilioRelayHealthReady,
  twilioConsentSyncUrlForRelayEndpoint
} from "./twilioSupabaseMessaging";

describe("twilio Supabase messaging URLs", () => {
  it("builds the staging Twilio relay, health, consent, and webhook URLs", () => {
    expect(choStagingSupabaseProjectRef).toBe("zfuwbbepsnmmlpgfkmhz");
    expect(buildTwilioSupabaseMessagingUrls()).toEqual({
      baseUrl: "https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging",
      healthUrl: "https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging/health",
      sendUrl: "https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging/send",
      consentUrl: "https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging/consent",
      inboundWebhookUrl: "https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging/inbound",
      statusCallbackUrlTemplate: "https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging/status/{messageId}"
    });
  });

  it("recognizes only the configured Supabase Twilio function endpoint for auth headers", () => {
    const supabaseUrl = "https://zfuwbbepsnmmlpgfkmhz.supabase.co";

    expect(isSupabaseTwilioMessagingEndpoint("https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging/send", supabaseUrl)).toBe(true);
    expect(isSupabaseTwilioMessagingEndpoint("https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging-evil/send", supabaseUrl)).toBe(false);
    expect(isSupabaseTwilioMessagingEndpoint("https://relay.example.test/functions/v1/twilio-messaging/send", supabaseUrl)).toBe(false);
    expect(isSupabaseTwilioMessagingEndpoint("https://zfuwbbepsnmmlpgfkmhz.supabase.co/rest/v1/message_logs", supabaseUrl)).toBe(false);
  });

  it("derives consent sync from a Supabase send URL and falls back for custom relays", () => {
    const supabaseUrl = "https://zfuwbbepsnmmlpgfkmhz.supabase.co";

    expect(twilioConsentSyncUrlForRelayEndpoint("https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging/send", supabaseUrl))
      .toBe("https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging/consent");
    expect(twilioConsentSyncUrlForRelayEndpoint("https://relay.example.test/api/messages/send", supabaseUrl))
      .toBe("https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging/consent");
  });

  it("requires every relay health readiness check before live sends", () => {
    expect(isTwilioRelayHealthReady("ready", {
      managerAuth: true,
      twilioCredentials: true,
      senderConfigured: true,
      complianceReady: true,
      webhookSignatureValidation: true,
      relayCanSend: true
    })).toBe(true);
    expect(isTwilioRelayHealthReady("ready", {
      managerAuth: true,
      twilioCredentials: true,
      senderConfigured: true,
      complianceReady: false,
      webhookSignatureValidation: true,
      relayCanSend: false
    })).toBe(false);
  });
});
