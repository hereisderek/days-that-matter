package dev.derek.daysthatmatter.core.database

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase

/** The on-disk database in the app's database directory. */
fun appDatabaseBuilder(context: Context): RoomDatabase.Builder<AppDatabase> {
    val appContext = context.applicationContext
    return Room.databaseBuilder<AppDatabase>(
        context = appContext,
        name = appContext.getDatabasePath(AppDatabase.FILE_NAME).absolutePath,
    )
}
