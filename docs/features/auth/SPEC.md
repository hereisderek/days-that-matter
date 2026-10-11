# Feature Specification: Authentication & User Accounts

Normative requirements: the [`accounts`](../../../openspec/changes/pluggable-backend-live-sharing/specs/accounts/spec.md) spec. Backend side: [`BACKEND.md`](../../architecture/BACKEND.md) section 8.

## 1. Overview & Goals
Users start immediately as a guest with full local use, within the free plan's limits. Anything online needs an account: sync, creating links, joining through invites. Opening a public link does not. Accounts are run by our own backend, so they work the same on every backend provider; there is no Firebase Auth.

---

## 2. Account States & Sign-In Methods
1. **Guest (no account):**
   - Instant access on first launch without registration. All data stays in Room on the device.
   - When the guest taps Sync, Share or Invite, opens an invite, or saves their first event (once), the app shows "Sign in or create an account" with "Not now" where the action can wait.
2. **Sign in with Google:**
   - Android: Credential Manager. iOS: Google Sign-In SDK. Web: redirect (authorization code flow, handled by the backend).
3. **Sign in with Apple:**
   - iOS: AuthenticationServices. Android: Apple's web sign-in in an in-app browser tab. Web: redirect.
   - Required on iOS because Google sign-in is offered (App Store Review Guideline 4.8).
4. **Email code:** the user enters an email address and the 6-digit code sent to it (valid 10 minutes, 5 attempts). No passwords.
5. **Create account = first sign-in:** the first sign-in with any method creates the account. There is no separate registration form.
6. **More methods later:** sign-in methods are plug-ins on the backend. Each deployment lists the enabled ones (`GET /config`) and the app shows only those. WeChat and phone codes are candidates for a China region (see [`CHINA.md`](../../architecture/CHINA.md)).
7. **One account per verified email:** a method whose verified email matches an existing account joins it. Users can add methods in settings.
8. **First sign-in on a device:** the guest's local events and memos upload to the account. If the account already has data from another device, both are kept.
9. **Sessions:** opaque session token, valid until 90 days after last use. Stored in Keychain (iOS) and EncryptedSharedPreferences (Android). On the web, an HttpOnly cookie.
10. **Not planned:** email and password.

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
    data object Guest : AuthState                              // no account, local only
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
- "Skip for now (Continue as Guest)" option clearly visible to avoid drop-off.
- Below the buttons: "By continuing you agree to the Terms of Service and Privacy Policy", both linked ([`docs/legal/`](../../legal/README.md)). Changed terms that need new consent are shown again after the next app start.

### 4.2 Sign-In Prompt (`SignInPromptSheet`)
- Shown to guests on Sync, Share, Invite, opening an invite, and once after the first saved event.
- Text: "Sign in or create an account to sync your events and share them." Buttons: the enabled sign-in methods and "Not now".

### 4.3 Account Settings Sheet
- Display name (editable), email, sign-in methods ("Add sign-in method"), plan, limits used and "Restore purchases".
- Sync status: last synced time, pending changes, Sync button.
- "Sign Out": ends this device's session only. Warns when pending changes have not synced.
- "Delete Account": deletes owned events, memos, links, invites and backdrops on the backend and removes access to events shared with the user (App Store and Google Play account deletion rules). Explains how to cancel an active subscription in the store first.

---

## 5. Security & Error Handling
- Never log ID tokens, session tokens, email codes or emails.
- Offline: the app keeps working with the cached session and local data.
- `401 unauthorized` from the backend: ask the user to sign in again, keep local data and pending changes.
- Provider errors (cancelled, no credentials, network) map to short localized messages.
