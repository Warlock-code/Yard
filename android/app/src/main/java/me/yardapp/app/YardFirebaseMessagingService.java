package me.yardapp.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class YardFirebaseMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        RemoteMessage.Notification notification = message.getNotification();
        if (notification == null) return;

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = launchIntent == null ? null : PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, "yard-v2")
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(notification.getTitle() == null ? "Yard" : notification.getTitle())
            .setContentText(notification.getBody() == null ? "You have a new notification." : notification.getBody())
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true);

        if (contentIntent != null) builder.setContentIntent(contentIntent);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify((int) System.currentTimeMillis(), builder.build());
    }
}
