import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import supabase from "../../lib/supabase/client";
import { i18n } from "../../constants/i18n";

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const handleLogin = async () => {
    if (!email || !senha) {
      Alert.alert(i18n.common.error, i18n.auth.errorFields);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      console.error(e);
      Alert.alert(i18n.common.error, e.message || i18n.auth.errorInvalidCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="restaurant" size={40} color={Colors.amber} />
          </View>
          <Text style={styles.title}>Comanda App</Text>
          <Text style={styles.subtitle}>{i18n.auth.loginMarketing}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={Colors.espresso} /> : <Text style={styles.loginBtnText}>{i18n.auth.loginBtn}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push("/auth/register-owner")}>
            <Text style={styles.footerText}>
              {i18n.auth.isOwner} <Text style={styles.linkText}>{i18n.auth.registerRestaurant}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push("/auth/register-employee")}
            style={styles.inviteBtn}
          >
            <Text style={styles.footerText}>
              {i18n.auth.hasInvite} <Text style={styles.linkText}>{i18n.auth.joinTeam}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.espresso,
    justifyContent: "center",
    alignItems: "center",
  },
  content: { 
    width: "100%",
    maxWidth: 450, // Limite para Desktop
    padding: 32, 
    justifyContent: "center" 
  },
  header: { alignItems: "center", marginBottom: 40 },
  logoCircle: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: Colors.charcoal, 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: Colors.surface 
  },
  title: { 
    fontFamily: "Inter_700Bold", 
    fontSize: 32, 
    color: Colors.textPrimary, 
    marginBottom: 8 
  },
  subtitle: { 
    fontFamily: "Inter_400Regular", 
    fontSize: 16, 
    color: Colors.textSecondary, 
    textAlign: "center",
    lineHeight: 22,
  },
  form: { gap: 16 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.charcoal,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  icon: { marginRight: 12 },
  input: { 
    flex: 1, 
    fontFamily: "Inter_400Regular", 
    fontSize: 16, 
    color: Colors.textPrimary 
  },
  loginBtn: {
    backgroundColor: Colors.amber,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: Colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: { opacity: 0.7 },
  loginBtnText: { 
    fontFamily: "Inter_700Bold", 
    fontSize: 18, 
    color: Colors.espresso 
  },
  footer: { 
    marginTop: 40, 
    alignItems: "center", 
    gap: 16 
  },
  footerText: { 
    fontFamily: "Inter_400Regular", 
    fontSize: 14, 
    color: Colors.textSecondary 
  },
  linkText: { 
    color: Colors.amber, 
    fontFamily: "Inter_600SemiBold" 
  },
  inviteBtn: { marginTop: 4 }
});
