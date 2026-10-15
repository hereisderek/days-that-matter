export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/** Sends one plain-text email: an HTTP mail API by default, SMTP on self-host (design D2). */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
