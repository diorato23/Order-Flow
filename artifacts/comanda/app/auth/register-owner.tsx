import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
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

export default function RegisterOwnerScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  // Estados do Cadastro
  const [nomeDono, setNomeDono] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nit, setNit] = useState("");
  const [nomeRestaurante, setNomeRestaurante] = useState("");
  const [endereco, setEndereco] = useState("");

  const validatePhone = (text: string) => text.length === 10;
  const validateNit = (text: string) => text.length === 10;

  const handleRegister = async () => {
    if (!nomeDono || !email || !senha || !telefone || !nit || !nomeRestaurante) {
      Alert.alert("Erro", "Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (!validatePhone(telefone)) {
      Alert.alert("Erro", "O telefone deve ter exatamente 10 números.");
      return;
    }

    if (!validateNit(nit)) {
      Alert.alert("Erro", "O N.T.I. deve ter exatamente 10 números.");
      return;
    }

    setLoading(true);
    try {
      // 1. Criar Usuário no Auth do Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: senha,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário.");

      // 2. Criar Restaurante
      const { data: restData, error: restError } = await (supabase as any)
        .from("comanda_restaurantes")
        .insert({
          nome: nomeRestaurante,
          endereco: endereco,
          telefone: telefone,
          nit: nit,
        })
        .select()
        .single();

      if (restError) throw restError;

      // 3. Criar Perfil do Usuário (Dono/Admin)
      const { error: userError } = await (supabase as any)
        .from("comanda_usuarios")
        .insert({
          nome: nomeDono,
          restaurante_id: restData.id,
          auth_user_id: authData.user.id,
          funcao: "admin",
          ativo: true,
        });

      if (userError) throw userError;

      // Recarrega o perfil recém-criado na memória global
      await refreshProfile();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const onSuccess = () => router.replace("/auth/login");

      if (Platform.OS === 'web') {
        alert("Sucesso! Cadastro realizado com sucesso. Bem-vindo!");
        onSuccess();
      } else {
        Alert.alert("Sucesso!", "Cadastro realizado com sucesso. Bem-vindo!", [
          { text: "OK", onPress: onSuccess }
        ]);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erro no Cadastro", e.message || "Ocorreu um erro inesperado.");
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Cadastro de Proprietário</Text>
          <Text style={styles.subtitle}>Crie sua conta e registre seu restaurante</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Dados Pessoais</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Nome Completo"
              placeholderTextColor={Colors.textMuted}
              value={nomeDono}
              onChangeText={setNomeDono}
            />
          </View>

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

          <Text style={styles.sectionTitle}>Dados do Restaurante</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="restaurant-outline" size={20} color={Colors.textMuted} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Nome do Restaurante"
              placeholderTextColor={Colors.textMuted}
              value={nomeRestaurante}
              onChangeText={setNomeRestaurante}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color={Colors.textMuted} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Telefone (10 dígitos)"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={10}
              value={telefone}
              onChangeText={setTelefone}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="document-text-outline" size={20} color={Colors.textMuted} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="N.T.I. (10 dígitos)"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={10}
              value={nit}
              onChangeText={setNit}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={20} color={Colors.textMuted} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Endereço"
              placeholderTextColor={Colors.textMuted}
              value={endereco}
              onChangeText={setEndereco}
            />
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, loading && styles.disabledBtn]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.espresso} />
            ) : (
              <Text style={styles.registerBtnText}>Finalizar Cadastro</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scrollContent: { 
    width: "100%",
    maxWidth: 500, // Limite para Desktop
    padding: 24, 
    paddingTop: Platform.OS === "ios" ? 60 : 40 
  },
  header: { marginBottom: 32 },
  backBtn: { marginBottom: 16 },
  title: { 
    fontFamily: "Inter_700Bold", 
    fontSize: 28, 
    color: Colors.textPrimary, 
    marginBottom: 8 
  },
  subtitle: { 
    fontFamily: "Inter_400Regular", 
    fontSize: 16, 
    color: Colors.textSecondary 
  },
  form: { gap: 16 },
  sectionTitle: { 
    fontFamily: "Inter_600SemiBold", 
    fontSize: 18, 
    color: Colors.amber, 
    marginTop: 12, 
    marginBottom: 4 
  },
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
  registerBtn: {
    backgroundColor: Colors.amber,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    shadowColor: Colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: { opacity: 0.7 },
  registerBtnText: { 
    fontFamily: "Inter_700Bold", 
    fontSize: 18, 
    color: Colors.espresso 
  },
});
