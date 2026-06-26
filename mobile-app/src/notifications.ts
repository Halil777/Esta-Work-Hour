import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { BASE_URL, getToken } from './api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushToken(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    // Get Expo push token (works with Expo Push Service)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'esta-workforce', // matches expo slug
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Habarlar',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    return tokenData.data;
  } catch {
    return null;
  }
}

export async function savePushTokenToServer(pushToken: string): Promise<void> {
  const jwt = getToken();
  if (!jwt) return;
  try {
    await fetch(`${BASE_URL}/mobile/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ pushToken }),
    });
  } catch {}
}

export function showLocalNotification(title: string, body: string) {
  Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // immediate
  });
}
