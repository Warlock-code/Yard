package me.yardapp.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(name = "YardPush")
public class YardPushPlugin extends Plugin {
    @PluginMethod
    public void getToken(PluginCall call) {
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null || task.getResult().isEmpty()) {
                String message = task.getException() == null
                    ? "Firebase did not return a token"
                    : task.getException().getMessage();
                call.reject(message == null ? "Firebase token request failed" : message);
                return;
            }

            JSObject result = new JSObject();
            result.put("token", task.getResult());
            call.resolve(result);
        });
    }
}
