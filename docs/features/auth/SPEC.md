# Feature Specification: Authentication & User Accounts

Normative requirements: the [`accounts`](../../../openspec/changes/pluggable-backend-live-sharing/specs/accounts/spec.md) spec. Backend side: [`BACKEND.md`](../../architecture/BACKEND.md) section 8.

## 1. Overview & Goals
Users start immediately as a guest with full local use. Anything online needs an account: sync, sharing, accepting invites. Accounts are run by our own backend, so they work the same on every backend provider; there is no Firebase Auth.

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
4. **Create account = first sign-in:** the first sign-in with a Google or Apple identity creates the account. There is no separate registration form.
5. **First sign-in on a device:** the guest's local events and memos upload to the account. If the account already has data from another device, both are kept.
6. **Sessions:** opaque session token, valid until 90 days after last use. Stored in Keychain (iOS) and EncryptedSharedPreferences (Android). On the web, an HttpOnly cookie.
7. **Later:** email sign-in with one-time codes, for people without Google or Apple accounts (needs an email provider). Email and password is not planned.

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
    val linkedProviders: Set<String>,   // "google", "apple"
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
- "Continue with Apple" and "Continue with Google" buttons, equal prominence. The same buttons sign in or create an account.
- "Skip for now (Continue as Guest)" option clearly visible to avoid drop-off.

### 4.2 Sign-In Prompt (`SignInPromptSheet`)
- Shown to guests on Sync, Share, Invite, opening an invite, and once after the first saved event.
- Text: "Sign in or create an account to sync your events and share them." Buttons: Apple, Google, "Not now".

### 4.3 Account Settings Sheet
- Display name (editable), email, linked providers, plan and "Restore purchases".
- Sync status: last synced time, pending changes, Sync button.
- "Sign Out": ends this device's session only. Warns when pending changes have not synced.
- "Delete Account": deletes owned events, memos, links, invites and backdrops on the backend and removes access to events shared with the user (App Store and Google Play account deletion rules). Explains how to cancel an active subscription in the store first.

---

## 5. Security & Error Handling
- Never log ID tokens, session tokens or emails.
- Offline: the app keeps working with the cached session and local data.
- `401 unauthorized` from the backend: ask the user to sign in again, keep local data and pending changes.
- Provider errors (cancelled, no credentials, network) map to short localized messages.
