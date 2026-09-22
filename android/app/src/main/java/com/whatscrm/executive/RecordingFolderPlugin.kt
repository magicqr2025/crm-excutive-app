package com.whatscrm.executive

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.media.MediaPlayer
import android.net.Uri
import androidx.activity.result.ActivityResult
import androidx.documentfile.provider.DocumentFile
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
        context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        prefs().edit().putString(KEY_TREE_URI, uri.toString()).apply()
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

    @PluginMethod
    fun findRecording(call: PluginCall) {
        val number = call.getString("number")
        val callTimeMs = call.getLong("callTimeMs")
        val durationSeconds = call.getInt("durationSeconds") ?: 0
        if (number == null || callTimeMs == null) {
            call.reject("number and callTimeMs are required")
            return
        }
        val treeUriString = prefs().getString(KEY_TREE_URI, null)
        if (treeUriString == null) {
            call.resolve(JSObject().apply { put("match", null) })
            return
        }
        val tree = DocumentFile.fromTreeUri(context, Uri.parse(treeUriString))
        val files = tree?.listFiles()?.filter { it.isFile } ?: emptyList()
        val normalizedNumber = number.filter { it.isDigit() }.takeLast(10)

        val byName = if (normalizedNumber.length == 10) {
            files.find { (it.name ?: "").filter { c -> c.isDigit() }.takeLast(10) == normalizedNumber }
        } else null

        val match = byName ?: run {
            val expectedEnd = callTimeMs + durationSeconds * 1000L
            files.filter { abs(it.lastModified() - expectedEnd) <= MATCH_WINDOW_MS }
                .minByOrNull { abs(it.lastModified() - expectedEnd) }
        }

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

    @PluginMethod
    fun play(call: PluginCall) {
        val uriString = call.getString("uri")
        if (uriString == null) {
            call.reject("uri is required")
            return
        }
        stopPlayback()
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
