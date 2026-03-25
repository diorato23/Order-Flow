import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, StyleSheet, Platform, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider } from "../context/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";
import OfflineBanner from "../components/OfflineBanner";
import { offlineStore } from "../lib/offline/store";

// ─── Sync TanStack Query com NetInfo ────────────────────────────────────────
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    const isOnline = !!(state.isConnected && state.isInternetReachable !== false);
    setOnline(isOnline);

    // Quando voltar online, sincronizar fila offline
    if (isOnline) {
      offlineStore.sync();
    }
  });
});

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de "vfresh" antes de tentar revalidar
      gcTime: 1000 * 60 * 60 * 24, // 24 horas de persistência
      retry: 2, // Tentar um pouco mais em caso de oscilação
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always', // Revalidar assim que a rede voltar
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

import { useAuth } from "../context/auth";
import { useRouter, useSegments } from "expo-router";
import { registerForPushNotificationsAsync, updatePushTokenInSupabase } from "../lib/notifications";

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth";

    if (!session && !inAuthGroup) {
      router.replace("/auth/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments]);

  // ─── Push Notifications Setup ─────────────────────────────────────────────
  useEffect(() => {
    if (session?.user?.id) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          updatePushTokenInSupabase(session.user.id, token);
        }
      });
    }
  }, [session?.user?.id]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.espresso },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="table/[id]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="order/new" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
      <Stack.Screen name="auth/register-owner" options={{ headerShown: false }} />
      <Stack.Screen name="auth/register-employee" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: asyncStoragePersister }}
          >
            <View style={styles.outerContainer}>
              <View style={styles.innerContainer}>
                <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.espresso }}>
                  <KeyboardProvider>
                    <StatusBar style="light" />
                    <OfflineBanner />
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </View>
            </View>
          </PersistQueryClientProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#000', // Fundo preto fora do "iPad"
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 1024 : undefined, // Tamanho iPad
    maxHeight: Platform.OS === 'web' ? 1366 : undefined,
    backgroundColor: Colors.espresso,
    // Sombra para dar efeito de dispositivo na web
    ...(Platform.OS === 'web' ? {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.58,
      shadowRadius: 16.00,
      elevation: 24,
    } : {}),
  },
});
