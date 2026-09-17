package me.yardapp.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

public class YardApplication extends Application {
    public static final String NOTIFICATION_CHANNEL_ID = "yard-v2";

    @Override
    public void onCreate() {
        super.onCreate();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Yard notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Comments and activity on your Yard posts");
            channel.setSound(
                android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
                null
            );
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
}
