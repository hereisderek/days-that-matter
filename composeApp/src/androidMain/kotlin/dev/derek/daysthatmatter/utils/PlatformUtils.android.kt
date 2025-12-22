package dev.derek.daysthatmatter.utils

import dev.gitlive.firebase.storage.Data

actual fun ByteArray.toFirebaseData(): Data = Data(this)

