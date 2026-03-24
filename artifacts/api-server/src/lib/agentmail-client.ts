// AgentMail integration — Replit connector: agentmail
// Docs: https://docs.agentmail.to
// Inbox: bills-prismclone@agentmail.to

const AGENTMAIL_BASE = "https://api.agentmail.to/v0";

function getApiKey(): string {
  const key = process.env.AGENTMAIL_API_KEY;
  if (!key) throw new Error("AGENTMAIL_API_KEY is not configured");
  return key;
}

export function getBillsInbox(): string {
  return process.env.AGENTMAIL_BILLS_INBOX || "bills-prismclone@agentmail.to";
}

async function agentmailFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${AGENTMAIL_BASE}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  return res;
}

export interface AgentMailMessage {
  message_id: string;
  thread_id: string;
  inbox_id: string;
  from: string;
  to: string[];
  subject: string;
  preview: string;
  labels: string[];
  timestamp: string;
}

export interface AgentMailMessageFull extends AgentMailMessage {
  text?: string;
  html?: string;
  attachments?: { filename: string; content_type: string; size: number; attachment_id: string }[];
}

export async function listMessages(inboxId: string, limit = 50): Promise<AgentMailMessage[]> {
  const encoded = encodeURIComponent(inboxId);
  const res = await agentmailFetch(`/inboxes/${encoded}/messages?limit=${limit}`);
  const data = await res.json() as any;
  return data.messages || [];
}

export async function getMessage(inboxId: string, messageId: string): Promise<AgentMailMessageFull | null> {
  try {
    const encoded = encodeURIComponent(inboxId);
    const encodedMsg = encodeURIComponent(messageId);
    const res = await agentmailFetch(`/inboxes/${encoded}/messages/${encodedMsg}`);
    if (!res.ok) return null;
    return await res.json() as AgentMailMessageFull;
  } catch {
    return null;
  }
}

export async function getInboxInfo() {
  const inbox = getBillsInbox();
  const encoded = encodeURIComponent(inbox);
  const res = await agentmailFetch(`/inboxes/${encoded}`);
  if (!res.ok) return null;
  return await res.json() as any;
}
