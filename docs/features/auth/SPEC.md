# Feature Specification: Authentication & User Accounts

## 1. Overview & Goals
Provides frictionless onboarding and secure identity management across all platforms. Users can start immediately as a guest or sign in to synchronize their events, custom themes, and media across devices.

---

## 2. Supported Auth Providers & Methods
1. **Anonymous / Guest Mode:**
   - Instant access on first launch without mandatory registration.
   - All events and assets are persisted locally via Room SQLite.
   - Seamless account upgrade: when a guest later signs in with Google or Email, their local events are automatically linked to their authenticated account.
2. **Google Sign-In:**
   - Android: Native Google Credential Manager API.
   - iOS / Web / Desktop: OAuth 2.0 / Firebase Auth token exchange.
3. **Email & Password:**
   - Standard sign-up and login with password strength validation.
   - Password reset flow via Firebase Auth email triggers.
4. **Session Persistence:**
   - Secure token storage using EncryptedSharedPreferences (Android) / Keychain (iOS) / Secure Storage (Desktop/Web).

---

## 3. Data Models

```kotlin
package dev.derek.daysthatmatter.features.auth.domain.model

import kotlinx.datetime.Instant

data class UserSession(
    val userId: String,
    val email: String?,
    val displayName: String?,
    val photoUrl: String?,
    val isAnonymous: Boolean,
    val isPremium: Boolean,
    val lastSyncAt: Instant?
)

sealed interface AuthState {
    data object Unauthenticated : AuthState
    data object Loading : AuthState
    data class Authenticated(val session: UserSession) : AuthState
    data class Error(val message: String, val cause: Throwable? = null) : AuthState
}
```

---

## 4. UI/UX Flow & Screens

### 4.1 Onboarding & Login Screen (`LoginScreen`)
- Welcoming splash visual with subtle countdown animation.
- One-tap "Continue with Google" button (prominent primary action).
- Email & password form fields with clear validation errors.
- "Skip for now (Continue as Guest)" option clearly visible to avoid drop-off.

### 4.2 Account Settings Sheet
- Displays current user profile avatar, name, and email.
- Account link status (e.g., "Linked to Google", "Guest Account - Tap to Link").
- "Sign Out" with confirmation dialogue warning if guest data is unbacked.
- "Delete Account" button complying with App Store / Google Play account deletion guidelines.

---

## 5. Security & Error Handling
- Never log plain credentials or auth tokens.
- Graceful handling of network timeouts with offline fallback: if offline, use cached user session credentials.
- Firebase Auth exceptions must be mapped to user-friendly localized messages (e.g., `ERROR_INVALID_EMAIL` &rarr; "Please enter a valid email address").
