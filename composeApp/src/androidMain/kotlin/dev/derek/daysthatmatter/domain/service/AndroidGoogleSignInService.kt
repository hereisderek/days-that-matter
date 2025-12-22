package dev.derek.daysthatmatter.domain.service

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import dev.derek.daysthatmatter.AndroidContext
import dev.derek.daysthatmatter.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AndroidGoogleSignInService(private val context: Context) : GoogleSignInService {
    override suspend fun signIn(): Result<GoogleAuthCredentials> = withContext(Dispatchers.Main) {
        try {
            val activity = AndroidContext.activity ?: return@withContext Result.failure(Exception("No activity found"))
            val credentialManager = CredentialManager.create(context)

            val webClientId = context.getString(R.string.default_web_client_id)

            val googleIdOption = GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(webClientId)
                .setAutoSelectEnabled(false)
                .build()

            val request = GetCredentialRequest.Builder()
                .addCredentialOption(googleIdOption)
                .build()

            val result = credentialManager.getCredential(
                request = request,
                context = activity
            )

            val credential = result.credential
            if (credential is GoogleIdTokenCredential) {
                Result.success(GoogleAuthCredentials(credential.idToken, null))
            } else {
                Result.failure(Exception("Received unknown credential type"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

