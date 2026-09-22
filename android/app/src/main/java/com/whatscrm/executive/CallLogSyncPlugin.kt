package com.whatscrm.executive

import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.provider.CallLog
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission

private const val PREFS_NAME = "call_log_sync"
private const val KEY_LAST_SYNCED_ID = "last_synced_id"

@CapacitorPlugin(
    name = "CallLogSync",
    permissions = [
        Permission(
            strings = [android.Manifest.permission.READ_CALL_LOG, android.Manifest.permission.READ_PHONE_STATE],
            alias = "callLog"
        )
    ]
)
class CallLogSyncPlugin : Plugin() {
    private var listenerRegistered = false

    override fun load() {
        super.load()
        maybeRegisterCallStateListener()
    }

    @PluginMethod
    fun getNewCalls(call: PluginCall) {
        if (getPermissionState("callLog") != PermissionState.GRANTED) {
            call.reject("READ_CALL_LOG permission not granted")
            return
        }
        val lastId = prefs().getLong(KEY_LAST_SYNCED_ID, 0L)
        val results = JSArray()
        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION
        )
        val cursor = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            projection,
            "${CallLog.Calls._ID} > ?",
            arrayOf(lastId.toString()),
            "${CallLog.Calls._ID} ASC"
        )
        cursor?.use {
            val idCol = it.getColumnIndexOrThrow(CallLog.Calls._ID)
            val numberCol = it.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
            val typeCol = it.getColumnIndexOrThrow(CallLog.Calls.TYPE)
            val dateCol = it.getColumnIndexOrThrow(CallLog.Calls.DATE)
            val durationCol = it.getColumnIndexOrThrow(CallLog.Calls.DURATION)
            while (it.moveToNext()) {
                val type = when (it.getInt(typeCol)) {
                    CallLog.Calls.INCOMING_TYPE -> "incoming"
                    CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                    CallLog.Calls.MISSED_TYPE -> "missed"
                    else -> "missed"
                }
                val entry = JSObject()
                entry.put("id", it.getString(idCol))
                entry.put("number", it.getString(numberCol) ?: "")
                entry.put("type", type)
                entry.put("date", it.getLong(dateCol))
                entry.put("duration", it.getLong(durationCol))
                results.put(entry)
            }
        }
        val ret = JSObject()
        ret.put("calls", results)
        call.resolve(ret)
    }

    @PluginMethod
    fun markSynced(call: PluginCall) {
        val lastId = call.getString("lastId")
        if (lastId.isNullOrBlank()) {
            call.reject("lastId is required")
            return
        }
        prefs().edit().putLong(KEY_LAST_SYNCED_ID, lastId.toLong()).apply()
        call.resolve()
    }

    @PluginMethod
    fun startBackgroundSync(call: PluginCall) {
        maybeRegisterCallStateListener()
        call.resolve()
    }

    private fun prefs(): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun maybeRegisterCallStateListener() {
        if (listenerRegistered) return
        if (context.checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) return
        val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        var wasConnected = false
        telephonyManager.listen(object : PhoneStateListener() {
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                when (state) {
                    TelephonyManager.CALL_STATE_OFFHOOK -> wasConnected = true
                    TelephonyManager.CALL_STATE_IDLE -> {
                        if (wasConnected) {
                            wasConnected = false
                            notifyListeners("callEnded", JSObject())
                        }
                    }
                }
            }
        }, PhoneStateListener.LISTEN_CALL_STATE)
        listenerRegistered = true
    }
}
