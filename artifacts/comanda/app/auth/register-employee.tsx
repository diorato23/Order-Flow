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
import { useAuth } from "../../context/auth";
import { i18n } from "../../constants/i18n";

export default function RegisterEmployeeScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Validar Código, 2: Dados Pessoais

  // Estados
  const [inviteCode, setInviteCode] = useState("");
  const [inviteData, setInviteData] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const handleValidateCode = async () => {
    if (!inviteCode) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("comanda_convites")
        .select("*, comanda_restaurantes(nome)")
        .eq("codigo", inviteCode.trim())
        .eq("usado", false)
        .single();

      if (error || !data) {
        throw new Error(i18n.auth.errorInvalidCode);
      }

      setInviteData(data);
      setStep(2);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: any) {
      Alert.alert(i18n.common.error, e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!nome || !email || !senha) {
      Alert.alert(i18n.common.error, i18n.auth.errorFields);
      return;
    }

    setLoading(true);
    try {
      // 1. Criar Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: senha,
      });

      if (authError) throw authError;

      // 2. Criar Perfil de Usuário
      const { error: userError } = await supabase
        .from("comanda_usuarios")
        .insert({
          nome,
          restaurante_id: inviteData.restaurante_id,
          auth_user_id: authData.user?.id,
          funcao: inviteData.funcao || "mesero",
          ativo: true,
        });

      if (userError) throw userError;

      // 3. Marcar convite como usado
      await supabase
        .from("comanda_convites")
        .update({ usado: true })
        .eq("id", inviteData.id);

      await refreshProfile();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const onSuccess = () => router.replace("/auth/login");

      if (Platform.OS === 'web') {
        alert(i18n.auth.teamWelcomeMsg);
        onSuccess();
      } else {
        Alert.alert(i18n.auth.teamSuccess, i18n.auth.teamWelcomeMsg, [
          { text: "OK", onPress: onSuccess }
        ]);
      }
    } catch (e: any) {
      Alert.alert("Erro no Cadastro", e.message);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>{i18n.auth.teamTitle}</Text>
        
        {step === 1 ? (
          <View style={styles.form}>
            <Text style={styles.subtitle}>{i18n.auth.teamSubtitle}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color={Colors.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={i18n.auth.teamPlaceholderCode}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                value={inviteCode}
                onChangeText={setInviteCode}
              />
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleValidateCode} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.espresso} /> : <Text style={styles.primaryBtnText}>{i18n.auth.teamValidate}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.subtitle}>
              {i18n.auth.teamWelcome} <Text style={styles.highlight}>{inviteData?.comanda_restaurantes?.nome}</Text>
            </Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={i18n.auth.teamName}
                placeholderTextColor={Colors.textMuted}
                value={nome}
                onChangeText={setNome}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={i18n.auth.teamEmail}
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
                placeholder={i18n.auth.teamPassword}
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                value={senha}
                onChangeText={setSenha}
              />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.espresso} /> : <Text style={styles.primaryBtnText}>{i18n.auth.teamFinish}</Text>}
            </TouchableOpacity>
          </View>
        )}
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
    paddingTop: 60 
  },
  backBtn: { marginBottom: 24 },
  title: { 
    fontFamily: "Inter_700Bold", 
    fontSize: 28, 
    color: Colors.textPrimary, 
    marginBottom: 8 
  },
  subtitle: { 
    fontFamily: "Inter_400Regular", 
    fontSize: 16, 
    color: Colors.textSecondary, 
    marginBottom: 32 
  },
  highlight: { 
    color: Colors.amber, 
    fontFamily: "Inter_600SemiBold" 
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
  primaryBtn: {
    backgroundColor: Colors.amber,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: Colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: { 
    fontFamily: "Inter_700Bold", 
    fontSize: 18, 
    color: Colors.espresso 
  },
});
