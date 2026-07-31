import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { AGENTS, setPendingAgent } from '@/lib/agentStore';

export default function PeraturanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTopPad = Platform.OS === 'web' ? 67 : 0;
  const webBottomPad = Platform.OS === 'web' ? 34 : 0;

  function handleAgentTap(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingAgent(key);
    router.navigate('/(tabs)');
  }

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
        <View style={[styles.logoMark, { backgroundColor: colors.secondary }]}>
          <Ionicons name="library-outline" size={14} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Agen Hukum</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + webBottomPad + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Pilih spesialis untuk konsultasi langsung
        </Text>

        {AGENTS.map((agent) => (
          <Pressable
            key={agent.key}
            onPress={() => handleAgentTap(agent.key)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: pressed ? agent.color : colors.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            testID={`agent-${agent.key}`}
          >
            {/* Color bar */}
            <View style={[styles.colorBar, { backgroundColor: agent.color }]} />
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={[styles.agentDot, { backgroundColor: agent.color }]} />
                <Text style={[styles.agentArea, { color: agent.color }]}>
                  {agent.area}
                </Text>
              </View>
              <Text style={[styles.agentName, { color: colors.foreground }]}>
                {agent.name}
              </Text>
              <Text style={[styles.agentDesc, { color: colors.mutedForeground }]}>
                {agent.description}
              </Text>
              <View style={[styles.consultBtn, { borderColor: agent.color }]}>
                <Text style={[styles.consultBtnText, { color: agent.color }]}>
                  Konsultasi
                </Text>
                <Ionicons name="arrow-forward" size={12} color={agent.color} />
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
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
  content: { paddingHorizontal: 16, paddingTop: 12 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  colorBar: { width: 4 },
  cardContent: { flex: 1, padding: 14 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  agentDot: { width: 6, height: 6, borderRadius: 3 },
  agentArea: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.3, textTransform: 'uppercase' as const },
  agentName: { fontSize: 16, fontWeight: '700' as const, marginBottom: 4 },
  agentDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  consultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  consultBtnText: { fontSize: 12, fontWeight: '600' as const },
});
