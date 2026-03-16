import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import Colors from "@/constants/colors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "fork.knife", selected: "fork.knife" }} />
        <Label>Mesas</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="kitchen">
        <Icon sf={{ default: "flame", selected: "flame.fill" }} />
        <Label>Cozinha</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menu">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet" }} />
        <Label>Cardápio</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="dashboard">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Relatórios</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.amber,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.charcoal,
          borderTopWidth: 0,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: Colors.charcoal }]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Mesas",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="fork.knife" tintColor={color} size={22} />
            ) : (
              <Ionicons name="restaurant-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: "Cozinha",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="flame" tintColor={color} size={22} />
            ) : (
              <Ionicons name="flame-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Cardápio",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="list.bullet" tintColor={color} size={22} />
            ) : (
              <Ionicons name="list-outline" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Relatórios",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar" tintColor={color} size={22} />
            ) : (
              <Ionicons name="bar-chart-outline" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
