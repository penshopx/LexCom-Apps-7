import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Animated,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export interface ConversationItem {
  id: number;
  title: string;
  createdAt: string;
}

interface ConversationDrawerProps {
  visible: boolean;
  conversations: ConversationItem[];
  activeConversationId: number | null;
  isLoading: boolean;
  onClose: () => void;
  onSelectConversation: (conv: ConversationItem) => void;
  onNewChat: () => void;
}

const DRAWER_WIDTH = 300;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ConversationDrawer({
  visible,
  conversations,
  activeConversationId,
  isLoading,
  onClose,
  onSelectConversation,
  onNewChat,
}: ConversationDrawerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -DRAWER_WIDTH,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  const webTopPad = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.overlay,
            { opacity: overlayAnim },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: colors.background,
            borderRightColor: colors.border,
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top + webTopPad,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Drawer header */}
        <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.drawerTitle, { color: colors.foreground }]}>Riwayat Chat</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="close" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        {/* New Chat button */}
        <Pressable
          onPress={() => { onNewChat(); onClose(); }}
          style={({ pressed }) => [
            styles.newChatItem,
            {
              borderColor: colors.primary,
              backgroundColor: pressed ? colors.muted : 'transparent',
              marginHorizontal: 12,
              marginTop: 12,
              marginBottom: 8,
            },
          ]}
        >
          <Ionicons name="create-outline" size={18} color={colors.primary} />
          <Text style={[styles.newChatText, { color: colors.primary }]}>Chat Baru</Text>
        </Pressable>

        {/* Conversation list */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbox-outline" size={32} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Belum ada riwayat chat
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isActive = item.id === activeConversationId;
              return (
                <Pressable
                  onPress={() => { onSelectConversation(item); onClose(); }}
                  style={({ pressed }) => [
                    styles.convItem,
                    {
                      backgroundColor: isActive
                        ? colors.primary + '20'
                        : pressed
                          ? colors.muted
                          : 'transparent',
                      borderRadius: 10,
                      marginHorizontal: 8,
                    },
                  ]}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={16}
                    color={isActive ? colors.primary : colors.mutedForeground}
                    style={styles.convIcon}
                  />
                  <View style={styles.convTextContainer}>
                    <Text
                      style={[
                        styles.convTitle,
                        { color: isActive ? colors.primary : colors.foreground },
                      ]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.convDate, { color: colors.mutedForeground }]}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  drawerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  closeBtn: { padding: 4 },
  newChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  newChatText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  listContent: {
    paddingVertical: 8,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    marginVertical: 2,
  },
  convIcon: {
    marginTop: 2,
    marginRight: 8,
    flexShrink: 0,
  },
  convTextContainer: { flex: 1 },
  convTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  convDate: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
