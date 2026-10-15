# Feature Specification: Authentication & User Accounts

Normative requirements: the [`accounts`](../../../openspec/changes/pluggable-backend-live-sharing/specs/accounts/spec.md) spec. Backend side: [`BACKEND.md`](../../architecture/BACKEND.md) section 8.

## 1. Overview & Goals
Users can start at once in local mode, with full local use on the device and no account, within the free plan's limits (see the [`local-mode`](../../../openspec/changes/pluggable-backend-live-sharing/specs/local-mode/spec.md) spec). Anything online needs an account: sync, creating links, joining through invites. Opening a public link does not. Accounts are run by our own backend, so they work the same on every backend provider; there is no Firebase Auth.

---

## 2. Account States & Sign-In Methods
1. **Local mode (no account):**
   - Chosen on the first-launch screen. All data stays in the local database on the device; the app sends only the remote configuration request, with no identifier.
   - When the user taps Sync, Share or Invite, opens an invite, or taps an online-only row in Settings, the app shows "Sign in or create an account" with "Not now" where the action can wait. There is no prompt after the first saved event; a calm suggestion after heavy use comes from remote configuration.
2. **Sign in with Google:**
   - Android: Credential Manager. iOS: Google Sign-In SDK.
3. **Sign in with Apple:**
   - iOS: AuthenticationServices. Android: Apple's web sign-in in an in-app browser tab; the backend's callback hands the result to the app and keeps no browser session.
   - Required on iOS because Google sign-in is offered (App Store Review Guideline 4.8).
4. **Email code:** the user enters an email address and the 6-digit code sent to it (valid 10 minutes, 5 attempts). No passwords.
5. **Create account = first sign-in:** the first sign-in with any method creates the account. There is no separate registration form.
6. **More methods later:** sign-in methods are plug-ins on the backend. Each deployment lists the enabled ones (`GET /config`) and the app shows only those. WeChat and phone codes are candidates for a China region (see [`CHINA.md`](../../architecture/CHINA.md)).
7. **One account per verified email:** a method whose verified email matches an existing account joins it. Users can add methods in settings.
8. **Signing in on a device with local events:** nothing is sent by itself. The app asks whether to import the local events into the account (permanent, confirmed twice). An import adds them to the account's events, none dropped; it is all or nothing, through `POST /api/v1/events/import`. If the user declines, Settings keeps "Import events from this device". Sign-out returns to local mode.
9. **Sessions:** opaque session token, valid until 90 days after last use. Stored in Keychain (iOS) and EncryptedSharedPreferences (Android).
10. **No sign-in on the web:** share web pages are read-only and set no cookies (design D17). Sign-in happens in the app.
11. **Not planned:** email and password.
12. **Inactive accounts:** an account with no signed-in use for 24 months (placeholder, owner to confirm) gets two emails 3 months apart, each with a data download link, and is deleted 3 months after the second, like a user-requested deletion. Any signed-in use stops this. Accounts with an active subscription or plan grant are never inactive. Details: [`BACKEND.md`](../../architecture/BACKEND.md) section 17.

---

## 3. Data Models

```kotlin
package dev.derek.daysthatmatter.features.auth.domain.model

import kotlinx.datetime.Instant

enum class Plan { Free, Premium, PremiumPlus }   // see docs/features/premium/SPEC.md

data class UserSession(
    val accountId: String,
    val displayName: String,
    val email: String?,                 // verified email from Google or Apple, shown to the user only
    val linkedProviders: Set<String>,   // "google", "apple", "email"
    val plan: Plan,
    val planExpiresAt: Instant?,
    val lastSyncAt: Instant?
)

sealed interface AuthState {
    data object Local : AuthState                              // no account, local mode, on this device only
    data object Loading : AuthState
    data class Authenticated(val session: UserSession) : AuthState
    data class Error(val message: String, val cause: Throwable? = null) : AuthState
}
```

---

## 4. UI/UX Flow & Screens

### 4.1 Onboarding & Login Screen (`LoginScreen`)
- Welcoming splash visual with subtle countdown animation.
- "Continue with Apple", "Continue with Google" and "Continue with email" buttons (only those the region enables). The same buttons sign in or create an account.
- The first-launch choice screen offers two equal choices, "Use on this device" and "Sign in or create an account", and says in plain words that sharing, sync, history and invites need an account and everything else works on this device. It does not mention plan limits.
- Below the buttons: "By continuing you agree to the Terms of Service and Privacy Policy", both linked ([`docs/legal/`](../../legal/README.md)). Changed terms that need new consent are shown again after the next app start.

### 4.2 Sign-In Prompt (`SignInPromptSheet`)
- Shown in local mode on Sync, Share, Invite, opening an invite and online-only Settings rows. Not shown after the first saved event.
- Text: "Sign in or create an account to sync your events and share them." Buttons: the enabled sign-in methods and "Not now".

### 4.3 Account Settings Sheet
- Display name (editable), email, sign-in methods ("Add sign-in method"), plan, limits used and "Restore purchases".
- "Download my data": emails a link to a page with `data.json` (account, days, memos, history the user wrote, sharing settings, audio library list) and each uploaded file. At most 1 request per day; the link works for 30 days.
- Sync status: last synced time, pending changes, Sync button.
- "Sign Out": syncs first, then ends this device's session and returns to local mode. Offline or with unsynced changes it says that not everything has been sent and the rest will be sent the next time the device is online; the account's data then stays hidden on the device until it has been sent.
- "Delete Account": deletes owned events, memos, links, invites and backdrops on the backend and removes access to events shared with the user (App Store and Google Play account deletion rules). Explains how to cancel an active subscription in the store first.

---

## 5. Security & Error Handling
- Never log ID tokens, session tokens, email codes or emails.
- Offline: the app keeps working with the cached session and local data.
- `401 unauthorized` from the backend: ask the user to sign in again, keep the account's data and pending changes.
- Provider errors (cancelled, no credentials, network) map to short localized messages.
