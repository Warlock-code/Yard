package me.yardapp.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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
	}
}
