package dev.derek.daysthatmatter.utils

import dev.gitlive.firebase.storage.Data
import platform.Foundation.NSData
import platform.Foundation.create
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.usePinned

actual fun ByteArray.toFirebaseData(): Data {
    return this.usePinned { pinned ->
        NSData.create(bytes = pinned.addressOf(0), length = this.size.toULong())
    }
}

