import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Colors from "@/constants/colors";
import { i18n } from "../../constants/i18n";
import { useAuth } from "../../context/auth";

export default function TabLayout() {
  const { profile, loading } = useAuth();
  const isDono = profile?.funcao === "admin" || profile?.funcao === "gerente";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.amber,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Inter_500Medium",
        },
        tabBarStyle: {
          backgroundColor: Colors.charcoal,
          borderTopWidth: 0,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.charcoal }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: i18n.tabs.mesas,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: i18n.tabs.cozinha,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: i18n.tabs.cardapio,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
          // Esconde a aba do menu para quem não é dono/gerente
          href: isDono ? "/(tabs)/menu" : null,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: i18n.tabs.relatorios,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
          // Esconde a aba do dashboard para quem não é dono/gerente
          href: isDono ? "/(tabs)/dashboard" : null,
        }}
      />
    </Tabs>
  );
}
