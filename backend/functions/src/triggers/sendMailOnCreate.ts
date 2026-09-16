import { Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { Resend } from "resend";

const resendApiKey = defineSecret("RESEND_API_KEY");
const defaultFromEmail = defineSecret("DEFAULT_FROM_EMAIL");
const MAIL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type RecipientField = string | string[];

interface MailMessage {
  subject: string;
  text?: string;
  html?: string;
}

interface MailDocument {
  to: RecipientField;
  cc?: RecipientField;
  bcc?: RecipientField;
  from?: string;
  replyTo?: string;
  message: MailMessage;
}

function recipients(value: unknown, field: string): string[] | undefined {
  const values = Array.isArray(value) ? value : [value];
  const result = values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  if (result.length === 0 && field === "to") {
    throw new Error(
      "Mail document must contain at least one recipient in 'to'",
    );
  }
  return result.length > 0 ? result : undefined;
}

function parseMailDocument(data: FirebaseFirestore.DocumentData): {
  to: string[];
  cc?: string[];
  bcc?: string[];
  from?: string;
  replyTo?: string;
  message: MailMessage;
} {
  const mail = data as Partial<MailDocument>;
  const to = recipients(mail.to, "to");
  const message = mail.message;

  if (!to)
    throw new Error(
      "Mail document must contain at least one recipient in 'to'",
    );
  if (!message || typeof message !== "object") {
    throw new Error("Mail document must contain a message");
  }
  if (typeof message.subject !== "string" || !message.subject.trim()) {
    throw new Error("Mail message must contain a subject");
  }
  if (typeof message.text !== "string" && typeof message.html !== "string") {
    throw new Error("Mail message must contain text or html");
  }

  return {
    to,
    cc: recipients(mail.cc, "cc"),
    bcc: recipients(mail.bcc, "bcc"),
    from:
      typeof mail.from === "string" && mail.from.trim()
        ? mail.from.trim()
        : undefined,
    replyTo:
      typeof mail.replyTo === "string" && mail.replyTo.trim()
        ? mail.replyTo.trim()
        : undefined,
    message: {
      subject: message.subject,
      text: message.text,
      html: message.html,
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Sends mail documents through Resend and keeps delivery state on the source document. */
export const sendMailOnCreate = onDocumentCreated(
  {
    document: "mail/{docId}",
    region: "europe-west9",
    retry: false,
    secrets: [resendApiKey, defaultFromEmail],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const startTime = Timestamp.now();
    const expireAt = Timestamp.fromMillis(
      startTime.toMillis() + MAIL_RETENTION_MS,
    );
    await snapshot.ref.update({
      expireAt,
      delivery: { state: "PENDING", startTime },
    });

    try {
      const mail = parseMailDocument(snapshot.data() ?? {});
      const resend = new Resend(resendApiKey.value());
      const email = {
        to: mail.to,
        from: mail.from ?? defaultFromEmail.value(),
        subject: mail.message.subject,
        ...(mail.cc ? { cc: mail.cc } : {}),
        ...(mail.bcc ? { bcc: mail.bcc } : {}),
        ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
        ...(mail.message.text ? { text: mail.message.text } : {}),
        ...(mail.message.html ? { html: mail.message.html } : {}),
      } as Parameters<typeof resend.emails.send>[0];
      const { data, error } = await resend.emails.send(email);

      if (error) throw new Error(error.message);

      const endTime = Timestamp.now();
      await snapshot.ref.update({
        delivery: {
          state: "SUCCESS",
          startTime,
          endTime,
          id: data?.id,
        },
      });
      logger.info("Mail sent", {
        docId: event.params.docId,
        resendId: data?.id,
      });
    } catch (error) {
      const message = errorMessage(error);
      logger.error("Mail delivery failed", {
        docId: event.params.docId,
        error: message,
      });
      await snapshot.ref.update({
        delivery: {
          state: "ERROR",
          startTime,
          endTime: Timestamp.now(),
          error: message,
        },
      });
    }
  },
);
