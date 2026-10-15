# User Copy

Rules for every text a user reads: screens, buttons, dialogs, notifications, widgets, store listings and error messages. Policy documents have their own process ([`docs/legal/README.md`](../legal/README.md)).

## Rules

1. **Plain words.** Write for someone who does not know how the app works. No jargon: not "sync token", "config", "API", "database", "payload", "server error 409", "timeout". Say "sent", "saved", "could not reach the service".
2. **Say what happened and what the user can do next.** Every error message has both: the situation, then one action ("Try again", "Open Settings"). Never show an error code.
3. **No claims we cannot prove.** Say what stays on the device ("Your events stay on this device"). Do not say "nothing traceable", "anonymous", "private" or "secure" as a promise: a server always sees an IP address, and the policy text decides what is promised.
4. **Consistent terms.** One word per thing: "event" or "day" (decision open in [`TODO.md`](../plans/TODO.md)), "account", "sign in", "sign out", "import", "export", "Premium". Do not mix "log in" and "sign in".
5. **Numbers come from configuration.** A limit, a size or a count that is a remote-config value is never typed into copy. Build the sentence from the current value, or leave the number out ("You reached the limit for the Free plan").
6. **Short.** One idea per sentence. No marketing language, no exclamation marks, no blame ("You must", "Invalid").
7. **Do not mention plan limits** on onboarding screens.

## Before and after

| Situation | Before | After |
| :--- | :--- | :--- |
| Local mode fetches the remote configuration | "Anonymous config request sent" | Nothing is shown. It is not a user action. |
| Import fails, can try again | "Import failed: HTTP 503" | "The import did not work, and none of your events were moved. Try again." |
| Import cannot work with this service version | "invalid_payload: unknown field backdrop.dimLevel" | "This version of the service cannot take your events yet. They are still on this device. We will fix this in an update." |
| Sign out while offline with unsent changes | "Pending sync queue not empty" | "Not everything has been sent yet. The rest will be sent the next time this device is online." |
| Widget whose event is not in the active database | "Error: event not found (404)" | "Event not available. Tap to open the app." |
| Onboarding, online features | "No account: offline mode with limited functionality" | "Sharing, sync, history and invites need an account. Everything else works on this device." |
| Free limit reached | "You have used 20 of 20 events" typed into the string | "You reached the limit for the Free plan" (the count comes from configuration) |
