# Feature Specification: Authentication & User Accounts

Normative requirements: the [`accounts`](../../../openspec/changes/pluggable-backend-live-sharing/specs/accounts/spec.md) spec. Backend side: [`BACKEND.md`](../../architecture/BACKEND.md) section 8.

## 1. Overview & Goals
Users start immediately as a guest. Nothing is sent to the backend until they share an event or sign in. Signing in syncs their events across devices and is required to invite people. Accounts are run by our own backend, so they work the same on every backend provider; there is no Firebase Auth.

---

## 2. Account Kinds & Sign-In Methods
1. **Guest (no account):**
   - Instant access on first launch without registration. All data stays in Room on the device.
2. **Anonymous account:**
   - Created silently when a guest creates their first public link, after a one-time warning that guest links cannot be managed from another device or after the app is deleted.
   - Bound to a 256-bit install secret generated on the device and kept in secure storage.
3. **Sign in with Google:**
   - Android: Credential Manager. iOS: Google Sign-In SDK. Web: redirect (authorization code flow, handled by the backend).
4. **Sign in with Apple:**
   - iOS: AuthenticationServices. Android: Apple's web sign-in in an in-app browser tab. Web: redirect.
   - Required on iOS because Google sign-in is offered (App Store Review Guideline 4.8).
5. **Upgrade:** signing in on a device with an anonymous account keeps its events, links and history. If the Google or Apple identity already has an account, the anonymous account's data moves into it.
6. **Sessions:** opaque session token, valid until 90 days after last use. Stored in Keychain (iOS) and EncryptedSharedPreferences (Android). On the web, an HttpOnly cookie.
7. **Later:** email sign-in with one-time codes (needs an email provider). Email and password is not planned.

---

## 3. Data Models

```kotlin
package dev.derek.daysthatmatter.features.auth.domain.model

import kotlinx.datetime.Instant

enum class AccountKind { Anonymous, Full }

data class UserSession(
    val accountId: String,
    val kind: AccountKind,
    val displayName: String,            // "Guest" for anonymous accounts
    val email: String?,                 // verified email from Google or Apple, shown to the user only
    val linkedProviders: Set<String>,   // "google", "apple"
    val syncEnabled: Boolean,
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
- "Continue with Apple" and "Continue with Google" buttons, equal prominence.
- "Skip for now (Continue as Guest)" option clearly visible to avoid drop-off.

### 4.2 Account Settings Sheet
- Display name (editable), email, linked providers.
- Account status ("Guest", "Guest with shared links - sign in to keep them", "Signed in with Apple").
- Sync on/off switch for signed-in users.
- "Sign Out": ends this device's session only. Warns when pending changes have not synced.
- "Delete Account": deletes owned events, links, invites and backdrops on the backend and removes access to events shared with the user (App Store and Google Play account deletion rules).

---

## 5. Security & Error Handling
- Never log ID tokens, session tokens, install secrets or emails.
- Offline: the app keeps working with the cached session and local data.
- `401 unauthorized` from the backend: ask the user to sign in again, keep local data and pending changes.
- Provider errors (cancelled, no credentials, network) map to short localized messages.
