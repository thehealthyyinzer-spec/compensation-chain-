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
