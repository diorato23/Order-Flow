import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import supabase from './supabase/client';
import type { Database } from './supabase/types';

// Configuração básica do comportamento da notificação (quando o app está aberto)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'web') {
    return null;
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Falha ao obter permissão para notificações push!');
      return null;
    }
    
    // O ID do projeto Expo é necessário para o EAS
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    if (!projectId) {
      console.warn('Expo Project ID não encontrado. As notificações push exigem configuração do EAS (app.json).');
      return null;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;
    } catch (e) {
      console.error('Erro ao obter Expo Push Token:', e);
      return null;
    }
  } else {
    // Caso seja emulador
    // console.warn('Notificações físicas não funcionam em emuladores.');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

export async function updatePushTokenInSupabase(userId: string, token: string) {
  if (!userId || !token) return;
  
  const updateData: Database['public']['Tables']['comanda_usuarios']['Update'] = { push_token: token };
  const { error } = await supabase
    .from('comanda_usuarios')
    .update(updateData)
    .eq('auth_user_id', userId);

  if (error) {
    console.error('Erro ao salvar push token:', error);
  } else {
    console.log('Push token salvo com sucesso.');
  }
}
