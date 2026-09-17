package me.yardapp.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
	private static final String TAG = "YardPush";
	private final Handler pushHandler = new Handler(Looper.getMainLooper());
	private volatile boolean pushSyncActive;
	private final Runnable pushSyncTask = this::syncPushToken;

	@Override
	public void onCreate(Bundle savedInstanceState) {
		registerPlugin(YardPushPlugin.class);
		super.onCreate(savedInstanceState);
	}

	private static final int NOTIFICATION_PERMISSION_REQUEST = 7001;

	@Override
	public void onStart() {
		super.onStart();

		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
			&& checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
			requestPermissions(
				new String[] { Manifest.permission.POST_NOTIFICATIONS },
				NOTIFICATION_PERMISSION_REQUEST
			);
		}

		startPushTokenSync();
	}

	@Override
	public void onStop() {
		pushSyncActive = false;
		pushHandler.removeCallbacks(pushSyncTask);
		super.onStop();
	}

	private void startPushTokenSync() {
		if (pushSyncActive) return;
		pushSyncActive = true;
		pushHandler.post(pushSyncTask);
	}

	private void syncPushToken() {
		if (!pushSyncActive) return;

		new Thread(() -> {
			try {
				String token = Tasks.await(FirebaseMessaging.getInstance().getToken(), 15, TimeUnit.SECONDS);
				String cookie = CookieManager.getInstance().getCookie("https://yardapp.me");
				if (cookie == null || cookie.isEmpty()) {
					cookie = CookieManager.getInstance().getCookie("https://www.yardapp.me");
				}

				if (cookie != null && !cookie.isEmpty() && registerToken(token, cookie)) {
					Log.i(TAG, "FCM token registered natively");
					pushSyncActive = false;
					return;
				}
			} catch (Exception error) {
				Log.w(TAG, "FCM token sync attempt failed: " + error.getMessage());
			}

			if (pushSyncActive) pushHandler.postDelayed(pushSyncTask, 1000);
		}).start();
	}

	private boolean registerToken(String token, String cookie) throws Exception {
		HttpURLConnection connection = (HttpURLConnection) new URL(
			"https://www.yardapp.me/api/notifications/register"
		).openConnection();
		connection.setRequestMethod("POST");
		connection.setConnectTimeout(10000);
		connection.setReadTimeout(10000);
		connection.setDoOutput(true);
		connection.setRequestProperty("Cookie", cookie);
		connection.setRequestProperty("Content-Type", "application/json");
		byte[] body = ("{\"token\":\"" + token + "\"}").getBytes(StandardCharsets.UTF_8);
		try (OutputStream output = connection.getOutputStream()) {
			output.write(body);
		}
		int status = connection.getResponseCode();
		connection.disconnect();
		return status >= 200 && status < 300;
	}
}
