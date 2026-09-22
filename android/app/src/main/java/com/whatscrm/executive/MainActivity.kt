package com.whatscrm.executive

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(CallLogSyncPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
