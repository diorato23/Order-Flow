import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs, useRouter, usePathname, Slot, useSegments } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState, useEffect, useMemo } from "react";
import { Platform, StyleSheet, View, Text, TouchableOpacity, useColorScheme, ScrollView, useWindowDimensions, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { i18n } from "../../constants/i18n";
import { useAuth } from "../../context/auth";

// Importação dos componentes das telas para o Pager
import MesasScreen from "./index";
import KitchenScreen from "./kitchen";
import MenuScreen from "./menu";
import DashboardScreen from "./dashboard";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "fork.knife", selected: "fork.knife" }} />
        <Label>{i18n.tabs.mesas}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="kitchen">
        <Icon sf={{ default: "flame", selected: "flame.fill" }} />
        <Label>{i18n.tabs.cozinha}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menu">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet" }} />
        <Label>{i18n.tabs.cardapio}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="dashboard">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>{i18n.tabs.relatorios}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function SwipeableTabLayout() {
  const isIOS = Platform.OS === "ios";
  const { profile, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const currentOffset = useRef(0);
  
  const isDono = profile?.funcao === "admin" || profile?.funcao === "gerente";

  // Define as abas disponíveis baseadas na permissão
  const tabs = useMemo(() => {
    // Definimos as abas base mesmo em loading para ter uma UI inicial
    const base = [
      { name: "index", label: i18n.tabs.mesas, icon: "restaurant-outline", iosIcon: "fork.knife", component: MesasScreen, path: "/(tabs)" },
      { name: "kitchen", label: i18n.tabs.cozinha, icon: "flame-outline", iosIcon: "flame", component: KitchenScreen, path: "/(tabs)/kitchen" },
    ];
    if (isDono) {
      base.push(
        { name: "menu", label: i18n.tabs.cardapio, icon: "list-outline", iosIcon: "list.bullet", component: MenuScreen, path: "/(tabs)/menu" },
        { name: "dashboard", label: i18n.tabs.relatorios, icon: "bar-chart-outline", iosIcon: "chart.bar", component: DashboardScreen, path: "/(tabs)/dashboard" }
      );
    }
    return base;
  }, [isDono]);

  // Sincroniza o estado com as rotas atuais (segments)
  const activeIndex = useMemo(() => {
    const currentSegment = segments[segments.length - 1] as string | undefined;
    if (!currentSegment) return 0;

    const idx = tabs.findIndex(t => {
      // Ajuste para rota raiz do grupo
      if (t.name === "index") return currentSegment === "(tabs)" || currentSegment === "index";
      return t.name === currentSegment;
    });
    return idx === -1 ? 0 : idx;
  }, [segments, tabs]);

  useEffect(() => {
    if (loading) return;
    const targetOffset = activeIndex * width;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ x: targetOffset, animated: true });
    }
  }, [activeIndex, width, loading]);

  const handleTabPress = (index: number) => {
    if (index === activeIndex) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace(tabs[index].path as any);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.amber} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false} // Não precisa mais de paging se não há swipe
        scrollEnabled={false} // DESABILITA O DESLIZE COM O DEDO
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {tabs.map((tab) => (
          <View key={tab.name} style={[styles.page, { width }]}>
            <tab.component />
          </View>
        ))}
      </ScrollView>

      {/* Custom Bottom Tab Bar */}
      <View style={styles.tabBarContainer}>
        {isIOS && (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        {!isIOS && <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.charcoal }]} />}
        
        <View style={styles.tabBar}>
          {tabs.map((tab, index) => {
            const isActive = activeIndex === index;
            const color = isActive ? Colors.amber : Colors.textMuted;
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tabItem}
                onPress={() => handleTabPress(index)}
              >
                {isIOS ? (
                  <SymbolView name={tab.iosIcon as any} tintColor={color} size={22} />
                ) : (
                  <Ionicons name={tab.icon as any} size={22} color={color} />
                )}
                <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <SwipeableTabLayout />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.espresso },
  pager: { flex: 1 },
  page: { flex: 1 },
  tabBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 88 : 64,
    borderTopWidth: 0,
    overflow: "hidden",
  },
  tabBar: {
    flexDirection: "row",
    height: "100%",
    paddingBottom: Platform.OS === "ios" ? 28 : 0,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
});


