/**
 * GHL CRM integration via HighLevel MCP connector.
 * Calls manus-mcp-cli as a child process since the MCP connector
 * is only available in the sandbox runtime environment.
 *
 * Location ID: XsuvpBNyF0TxrGgrYU1T (The Healthy Yinzer)
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const GHL_LOCATION_ID = "XsuvpBNyF0TxrGgrYU1T";

async function callMcp(tool: string, input: Record<string, unknown>): Promise<any> {
  const inputJson = JSON.stringify(input).replace(/'/g, "'\\''");
  const cmd = `manus-mcp-cli tool call ${tool} --server highlevel --input '${inputJson}'`;
  try {
    const { stdout } = await execAsync(cmd, { timeout: 15000 });
    // Parse the JSON result from stdout
    const match = stdout.match(/Tool execution result:\n([\s\S]+)/);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    return null;
  } catch (e) {
    console.error(`[GHL] MCP call failed for ${tool}:`, e);
    return null;
  }
}

/**
 * Upsert a contact in GHL CRM.
 * Returns the contact ID if successful.
 */
export async function ghlUpsertContact(params: {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  source?: string;
}): Promise<string | null> {
  const result = await callMcp("contacts_upsert-contact", {
    body_locationId: GHL_LOCATION_ID,
    body_email: params.email,
    body_firstName: params.firstName,
    ...(params.lastName && { body_lastName: params.lastName }),
    ...(params.phone && { body_phone: params.phone }),
    ...(params.source && { body_source: params.source }),
  });

  if (result?.success && result?.data?.contact?.id) {
    return result.data.contact.id;
  }
  console.error("[GHL] Upsert failed:", result);
  return null;
}

/**
 * Add tags to a GHL contact.
 */
export async function ghlAddTags(contactId: string, tags: string[]): Promise<boolean> {
  const result = await callMcp("contacts_add-tags", {
    path_contactId: contactId,
    body_tags: tags,
  });

  if (result?.success) {
    console.log(`[GHL] Tags added to ${contactId}:`, tags);
    return true;
  }
  console.error("[GHL] Add tags failed:", result);
  return false;
}

// GHL email template ID for the Chain Check magic link
const MAGIC_LINK_TEMPLATE_ID = "6a314a23067939512325405f";

/**
 * Send the magic link login email to a client via GHL.
 * Uses the Chain Check Magic Link HTML template stored in GHL.
 * The login URL is injected directly into the HTML before sending.
 */
export async function ghlSendMagicLinkEmail(params: {
  email: string;
  firstName: string;
  loginUrl: string;
}): Promise<boolean> {
  try {
    // Upsert contact to get their GHL ID
    const contactId = await ghlUpsertContact({
      email: params.email,
      firstName: params.firstName,
      source: "chain-check-paid",
    });

    if (!contactId) {
      console.error("[GHL] Cannot send email — contact upsert failed");
      return false;
    }

    // Build the branded HTML with the actual login URL injected
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px"><tr><td align="center"><table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden"><tr><td style="background:#1A1F3A;padding:28px 32px"><p style="margin:0;font-family:Arial,sans-serif;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#ffffff">THE HEALTHY <span style="color:#00B4D8">YINZER</span></p></td></tr><tr><td style="padding:32px"><h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1A1F3A">Hey ${params.firstName},</h2><p style="margin:0 0 28px;color:#555555;line-height:1.7;font-size:15px">Coach Nick sent you a login link for your Chain Check dashboard. Click the button below to access your movement assessment.</p><table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#00B4D8"><a href="${params.loginUrl}" style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#1A1F3A;text-decoration:none">OPEN MY DASHBOARD</a></td></tr></table><p style="margin:28px 0 0;color:#888888;font-size:12px;line-height:1.6">This link expires in 24 hours. If you did not expect this email, you can ignore it.</p></td></tr><tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eeeeee"><p style="margin:0;color:#aaaaaa;font-size:11px">Chain Check by The Healthy Yinzer &middot; Pittsburgh, PA</p></td></tr></table></td></tr></table></body></html>`;

    const result = await callMcp("conversations_send-a-new-message", {
      body_type: "Email",
      body_contactId: contactId,
      body_subject: "Your Chain Check Login Link",
      body_html: html,
      body_message: `Your Chain Check login link: ${params.loginUrl}`,
    });

    if (result?.success) {
      console.log(`[GHL] Magic link email sent to ${params.email}`);
      return true;
    }
    console.error("[GHL] Email send failed:", result);
    return false;
  } catch (e) {
    console.error("[GHL] sendMagicLinkEmail error:", e);
    return false;
  }
}

/**
 * Full upsert + tag flow in one call.
 */
export async function ghlUpsertAndTag(params: {
  email: string;
  firstName: string;
  lastName?: string;
  source?: string;
  tags: string[];
}): Promise<boolean> {
  try {
    const contactId = await ghlUpsertContact({
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      source: params.source || "chain-check",
    });

    if (!contactId) return false;

    await ghlAddTags(contactId, params.tags);
    return true;
  } catch (e) {
    console.error("[GHL] upsertAndTag error:", e);
    return false;
  }
}
