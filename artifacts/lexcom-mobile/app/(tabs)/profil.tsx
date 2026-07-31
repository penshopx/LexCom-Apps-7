import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

export default function ProfilScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, isLoading, login, logout } = useAuth();
  const webTopPad = Platform.OS === 'web' ? 67 : 0;
  const webBottomPad = Platform.OS === 'web' ? 34 : 0;

  function handleLogin() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    login();
  }

  function handleLogout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Keluar', 'Yakin ingin keluar dari akun?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: logout },
    ]);
  }

  const displayName =
    user
      ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Pengguna'
      : null;

  const initials = displayName
    ? displayName
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: insets.top + webTopPad + 4,
          },
        ]}
      >
        <View style={[styles.logoMark, { backgroundColor: colors.accent }]}>
          <Ionicons name="person-outline" size={14} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profil</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + webBottomPad + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : user ? (
          <>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              {user.profileImageUrl ? (
                <Image
                  source={{ uri: user.profileImageUrl }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
                    {initials}
                  </Text>
                </View>
              )}
              <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            </View>

            <Text style={[styles.displayName, { color: colors.foreground }]}>{displayName}</Text>
            {user.email && (
              <Text style={[styles.email, { color: colors.mutedForeground }]}>{user.email}</Text>
            )}

            {/* Info card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <InfoRow icon="shield-checkmark-outline" label="Status Akun" value="Terverifikasi" color={colors.foreground} muted={colors.mutedForeground} accent="#10b981" />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <InfoRow icon="lock-closed-outline" label="Autentikasi" value="Replit OIDC" color={colors.foreground} muted={colors.mutedForeground} accent={colors.primary} />
            </View>

            {/* Features */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>FITUR AKTIF</Text>
              <FeatureRow icon="chatbox-ellipses-outline" label="LexBot Agentic AI" color={colors.foreground} muted={colors.mutedForeground} primary={colors.primary} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <FeatureRow icon="library-outline" label="19 Agen Spesialis" color={colors.foreground} muted={colors.mutedForeground} primary={colors.primary} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <FeatureRow icon="calculator-outline" label="Kalkulator Hukum" color={colors.foreground} muted={colors.mutedForeground} primary={colors.primary} />
            </View>

            {/* Logout */}
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logoutBtn,
                { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
              <Text style={[styles.logoutText, { color: colors.destructive }]}>Keluar</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Not logged in */}
            <View style={styles.loginSection}>
              <View style={[styles.bigIcon, { backgroundColor: colors.muted }]}>
                <Ionicons name="scale" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.loginTitle, { color: colors.foreground }]}>LexCom Mobile</Text>
              <Text style={[styles.loginSubtitle, { color: colors.mutedForeground }]}>
                Masuk untuk menyimpan riwayat konsultasi dan mengakses fitur lengkap.
              </Text>

              <Pressable
                onPress={handleLogin}
                style={({ pressed }) => [
                  styles.loginBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
                testID="login-btn"
              >
                <Ionicons name="log-in-outline" size={20} color={colors.primaryForeground} />
                <Text style={[styles.loginBtnText, { color: colors.primaryForeground }]}>
                  Masuk dengan Replit
                </Text>
              </Pressable>

              <Text style={[styles.loginNote, { color: colors.mutedForeground }]}>
                Tanpa akun? Anda tetap bisa menggunakan LexBot.
              </Text>
            </View>

            {/* Features preview */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>FITUR TERSEDIA</Text>
              <FeatureRow icon="chatbox-ellipses-outline" label="LexBot — Agentic AI" color={colors.foreground} muted={colors.mutedForeground} primary={colors.primary} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <FeatureRow icon="library-outline" label="11 Agen Spesialis Hukum" color={colors.foreground} muted={colors.mutedForeground} primary={colors.primary} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <FeatureRow icon="calculator-outline" label="Kalkulator Pesangon & BPHTB" color={colors.foreground} muted={colors.mutedForeground} primary={colors.primary} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, color, muted, accent }: {
  icon: string; label: string; value: string; color: string; muted: string; accent: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={16} color={accent} />
      <Text style={[styles.infoLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color }]}>{value}</Text>
    </View>
  );
}

function FeatureRow({ icon, label, color, muted, primary }: {
  icon: string; label: string; color: string; muted: string; primary: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIconBg, { backgroundColor: primary + '22' }]}>
        <Ionicons name={icon as any} size={14} color={primary} />
      </View>
      <Text style={[styles.featureLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700' as const },
  content: { paddingHorizontal: 16, paddingTop: 24, alignItems: 'center' },
  loadingState: { paddingTop: 80 },
  avatarSection: { position: 'relative', marginBottom: 16 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '700' as const },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: { fontSize: 22, fontWeight: '700' as const, marginBottom: 4 },
  email: { fontSize: 14, marginBottom: 24 },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoLabel: { flex: 1, fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600' as const },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  featureIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: { fontSize: 14 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '600' as const },
  loginSection: { alignItems: 'center', paddingBottom: 32, width: '100%' },
  bigIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loginTitle: { fontSize: 24, fontWeight: '700' as const, marginBottom: 8 },
  loginSubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 8 },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  loginBtnText: { fontSize: 16, fontWeight: '700' as const },
  loginNote: { fontSize: 13, textAlign: 'center' },
});
