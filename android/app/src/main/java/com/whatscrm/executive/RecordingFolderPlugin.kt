package com.whatscrm.executive

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.media.MediaPlayer
import android.net.Uri
import android.provider.DocumentsContract
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlin.math.abs

private const val PREFS_NAME = "recording_folder"
private const val KEY_TREE_URI = "tree_uri"
private const val MATCH_WINDOW_MS = 2 * 60 * 1000L
private const val NAME_MATCH_WINDOW_MS = 30 * 60 * 1000L
private const val LIST_CACHE_MS = 20 * 1000L
private val AUDIO_EXTENSIONS = listOf(".m4a", ".mp3", ".amr", ".aac", ".wav", ".ogg", ".opus", ".3gp")

@CapacitorPlugin(name = "RecordingFolder")
class RecordingFolderPlugin : Plugin() {
    private var mediaPlayer: MediaPlayer? = null

    @PluginMethod
    fun pick(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        startActivityForResult(call, intent, "pickResult")
    }

    @ActivityCallback
    private fun pickResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            call.reject("Folder selection cancelled")
            return
        }
        try {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (e: SecurityException) {
            call.reject("Could not keep access to that folder: ${e.message}")
            return
        }
        prefs().edit().putString(KEY_TREE_URI, uri.toString()).apply()
        cachedTree = null
        val ret = JSObject()
        ret.put("uri", uri.toString())
        call.resolve(ret)
    }

    @PluginMethod
    fun getSelected(call: PluginCall) {
        val ret = JSObject()
        ret.put("uri", prefs().getString(KEY_TREE_URI, null))
        call.resolve(ret)
    }

    // Recorders name files inconsistently ("Call recording 98266 96132_210926_104812.m4a",
    // "Vijay_20260921104812.m4a", "+919826696132 (2026-09-21).amr"), so a file is a
    // candidate if its name contains the number's last 10 digits or the contact's
    // name, and the closest candidate in time wins — a number called several times
    // has one recording per call. Only when nothing matches by name does a bare
    // time match (much tighter window) apply.
    @PluginMethod
    fun findRecording(call: PluginCall) {
        val number = call.getString("number")
        val callTimeMs = call.getLong("callTimeMs")
        val durationSeconds = call.getInt("durationSeconds") ?: 0
        val contactName = call.getString("contactName")?.trim()?.lowercase()
        if (number == null || callTimeMs == null) {
            call.reject("number and callTimeMs are required")
            return
        }
        val treeUriString = prefs().getString(KEY_TREE_URI, null)
        if (treeUriString == null) {
            call.resolve(JSObject().apply { put("match", null) })
            return
        }
        // The saved folder grant can be gone (folder deleted, app reinstalled and
        // allowBackup restored the prefs but not the URI permission) — that throws
        // SecurityException, which Capacitor would turn into an app crash.
        val files = try {
            listRecordings(Uri.parse(treeUriString))
        } catch (e: Exception) {
            call.resolve(JSObject().apply { put("match", null) })
            return
        }
        val normalizedNumber = number.filter { it.isDigit() }.takeLast(10)
        val expectedEnd = callTimeMs + durationSeconds * 1000L
        fun distance(f: RecordingFile) = abs(f.lastModified - expectedEnd)

        val byName = files.filter { f ->
            val lower = f.name.lowercase()
            (normalizedNumber.length == 10 && f.name.filter { it.isDigit() }.contains(normalizedNumber)) ||
                (contactName != null && contactName.length >= 3 && lower.contains(contactName))
        }
        val match = byName.filter { distance(it) <= NAME_MATCH_WINDOW_MS }.minByOrNull(::distance)
            ?: files.filter { distance(it) <= MATCH_WINDOW_MS }.minByOrNull(::distance)

        val ret = JSObject()
        if (match != null) {
            val entry = JSObject()
            entry.put("uri", match.uri.toString())
            entry.put("fileName", match.name)
            ret.put("match", entry)
        } else {
            ret.put("match", null)
        }
        call.resolve(ret)
    }

    private data class RecordingFile(val uri: Uri, val name: String, val lastModified: Long)

    private var cachedTree: String? = null
    private var cachedAt = 0L
    private var cachedFiles: List<RecordingFile> = emptyList()

    // One ContentResolver query for the whole folder, cached briefly — the Call
    // Logs page asks once per row, and DocumentFile.listFiles() + per-file
    // name/lastModified lookups cost an IPC round-trip each.
    @Synchronized
    private fun listRecordings(treeUri: Uri): List<RecordingFile> {
        val now = System.currentTimeMillis()
        if (cachedTree == treeUri.toString() && now - cachedAt < LIST_CACHE_MS) return cachedFiles

        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            treeUri, DocumentsContract.getTreeDocumentId(treeUri)
        )
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
        )
        val result = mutableListOf<RecordingFile>()
        context.contentResolver.query(childrenUri, projection, null, null, null)?.use { c ->
            while (c.moveToNext()) {
                val mime = c.getString(3) ?: ""
                if (mime == DocumentsContract.Document.MIME_TYPE_DIR) continue
                val name = c.getString(1) ?: continue
                val isAudio = mime.startsWith("audio/") || AUDIO_EXTENSIONS.any { name.lowercase().endsWith(it) }
                if (!isAudio) continue
                result += RecordingFile(
                    uri = DocumentsContract.buildDocumentUriUsingTree(treeUri, c.getString(0)),
                    name = name,
                    lastModified = c.getLong(2),
                )
            }
        }
        cachedTree = treeUri.toString()
        cachedAt = now
        cachedFiles = result
        return result
    }

    @PluginMethod
    fun play(call: PluginCall) {
        val uriString = call.getString("uri")
        if (uriString == null) {
            call.reject("uri is required")
            return
        }
        stopPlayback()
        try {
            val afd = context.contentResolver.openAssetFileDescriptor(Uri.parse(uriString), "r")
            if (afd == null) {
                call.reject("Could not open recording")
                return
            }
            mediaPlayer = MediaPlayer().apply {
                setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                afd.close()
                setOnCompletionListener { notifyListeners("playbackEnded", JSObject()) }
                prepare()
                start()
            }
            call.resolve()
        } catch (e: Exception) {
            stopPlayback()
            call.reject("Could not play recording: ${e.message}")
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        stopPlayback()
        call.resolve()
    }

    private fun stopPlayback() {
        mediaPlayer?.apply {
            if (isPlaying) stop()
            release()
        }
        mediaPlayer = null
    }

    private fun prefs(): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
