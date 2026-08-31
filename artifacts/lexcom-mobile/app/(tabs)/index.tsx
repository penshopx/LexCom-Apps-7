import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  Text,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import ChatMessage, { type Message, type AgentInfo } from '@/components/ChatMessage';
import TypingIndicator from '@/components/TypingIndicator';
import { consumePendingAgent, AGENTS } from '@/lib/agentStore';
import ConversationDrawer, { type ConversationItem } from '@/components/ConversationDrawer';

const CONV_ID_KEY = 'lexcom_conv_id';

let _msgCounter = 0;
function generateId(): string {
  _msgCounter++;
  return `m-${Date.now()}-${_msgCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

function getApiBase() {
  return `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
}

type Status = 'idle' | 'orchestrating' | 'streaming' | 'synthesizing';

interface SseEvent {
  type: string;
  content?: string;
  agents?: AgentInfo[];
  agent?: string;
  agentName?: string;
  color?: string;
  message?: string;
}

interface DbMessage {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
}

export default function LexBotScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, isLoading: authLoading } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [showTyping, setShowTyping] = useState(false);
  const [activeAgents, setActiveAgents] = useState<AgentInfo[]>([]);
  const [pendingAgent, setPendingAgentState] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Conversation history drawer
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  // Stored conversation ID read from AsyncStorage (populated on mount)
  const [storedConvId, setStoredConvId] = useState<number | null>(null);
  const hasRestoredRef = useRef(false);

  const isStreaming = status !== 'idle';

  // Capture token in a ref so async callbacks always see the latest value
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  function getAuthHeaders(): Record<string, string> {
    const t = tokenRef.current;
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  // Step 1: Read stored conversation ID from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(CONV_ID_KEY).then((val) => {
      if (val) setStoredConvId(parseInt(val));
    });
  }, []);

  // Step 2: Once auth settles, a session exists, and we have a stored ID,
  // hydrate messages. Keep the stored pointer while logged out so a later
  // login in the same app start can still restore the conversation.
  useEffect(() => {
    if (!authLoading && token && storedConvId !== null && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      restoreConversationFromId(storedConvId);
    }
  }, [authLoading, token, storedConvId]);

  // Fetch conversation list from server (only when authenticated)
  const fetchConversationList = useCallback(async () => {
    if (!token) {
      setConversations([]);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${getApiBase()}/agentic/conversations`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json() as ConversationItem[];
        setConversations(data);
      }
    } catch {
      // ignore — history is best-effort
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token]);

  // Pick up pending agent set from Peraturan tab
  useFocusEffect(
    useCallback(() => {
      const agent = consumePendingAgent();
      if (agent) {
        setPendingAgentState(agent);
        setMessages([]);
        setConversationId(null);
        AsyncStorage.removeItem(CONV_ID_KEY);
        const meta = AGENTS.find((a) => a.key === agent);
        if (meta) {
          setMessages([{
            id: generateId(),
            role: 'assistant',
            content: `Halo! Saya ${meta.name} dari LexCom. Silakan tanyakan seputar ${meta.area}.`,
            agents: [{ key: agent, name: meta.name, color: meta.color }],
          }]);
        }
      }
    }, []),
  );

  async function openDrawer() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDrawerVisible(true);
    fetchConversationList();
  }

  async function startNewChat() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages([]);
    setConversationId(null);
    setStoredConvId(null);
    setPendingAgentState(null);
    hasRestoredRef.current = true; // prevent auto-restore from firing again
    await AsyncStorage.removeItem(CONV_ID_KEY);
  }

  /**
   * Fetches messages for a conversation ID and hydrates the chat view.
   * Called automatically on mount (to restore last session) and from the drawer.
   * Clears the stored ID on 403/404 to avoid a stuck invalid state.
   */
  async function fetchAndDisplayMessages(id: number): Promise<boolean> {
    try {
      const res = await fetch(
        `${getApiBase()}/agentic/conversations/${id}/messages`,
        { headers: getAuthHeaders() },
      );
      if (res.ok) {
        const dbMessages = await res.json() as DbMessage[];
        const loaded: Message[] = dbMessages.map((m) => ({
          id: generateId(),
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        setMessages(loaded);
        return true;
      } else if (res.status === 403 || res.status === 404) {
        // Conversation doesn't exist or doesn't belong to this user — clear it
        setConversationId(null);
        setStoredConvId(null);
        await AsyncStorage.removeItem(CONV_ID_KEY);
      }
    } catch {
      // Network error — keep conversation ID but leave messages empty so user can retry
    }
    return false;
  }

  /**
   * Auto-restore: called on startup once auth settles.
   */
  async function restoreConversationFromId(id: number) {
    setConversationId(id);
    setIsLoadingConversation(true);
    await fetchAndDisplayMessages(id);
    setIsLoadingConversation(false);
  }

  async function loadConversation(conv: ConversationItem) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoadingConversation(true);
    setMessages([]);
    setConversationId(conv.id);
    setStoredConvId(conv.id);
    await AsyncStorage.setItem(CONV_ID_KEY, String(conv.id));
    await fetchAndDisplayMessages(conv.id);
    setIsLoadingConversation(false);
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: generateId(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setShowTyping(true);
    setStatus('orchestrating');
    setActiveAgents([]);

    let convId = conversationId;
    const forcedAgents = pendingAgent ? [pendingAgent] : undefined;

    try {
      if (!convId) {
        const res = await fetch(`${getApiBase()}/agentic/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ title: trimmed.slice(0, 60) }),
        });
        if (!res.ok) {
          if (res.status === 401) throw new Error('AUTH_REQUIRED');
          throw new Error('Failed to create conversation');
        }
        const conv = await res.json() as { id: number };
        convId = conv.id;
        setConversationId(convId);
        await AsyncStorage.setItem(CONV_ID_KEY, String(convId));
        // Refresh history list so new conversation appears immediately
        fetchConversationList();
      }

      const response = await expoFetch(`${getApiBase()}/agentic/conversations/${convId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ content: trimmed, ...(forcedAgents ? { forcedAgents } : {}) }),
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('AUTH_REQUIRED');
        throw new Error('Chat request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentAgents: AgentInfo[] = [];
      let fullContent = '';
      let assistantMsgId = generateId();
      let assistantAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          try {
            const event = JSON.parse(raw) as SseEvent;

            if (event.type === 'orchestrating') {
              // typing indicator visible
            } else if (event.type === 'agents_selected') {
              currentAgents = (event.agents ?? []) as AgentInfo[];
              setActiveAgents(currentAgents);
              setShowTyping(false);
            } else if (event.type === 'agent_start') {
              setStatus('streaming');
            } else if (event.type === 'agent_chunk') {
              fullContent += event.content ?? '';
              if (!assistantAdded) {
                setMessages((prev) => [
                  ...prev,
                  { id: assistantMsgId, role: 'assistant', content: fullContent, agents: currentAgents, isStreaming: true },
                ]);
                assistantAdded = true;
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.id === assistantMsgId) {
                    updated[updated.length - 1] = { ...last, content: fullContent };
                  }
                  return updated;
                });
              }
            } else if (event.type === 'synthesis_start') {
              setStatus('synthesizing');
              fullContent = '';
              assistantAdded = false;
              assistantMsgId = generateId();
            } else if (event.type === 'synthesis_chunk') {
              fullContent += event.content ?? '';
              if (!assistantAdded) {
                setMessages((prev) => [
                  ...prev,
                  { id: assistantMsgId, role: 'assistant', content: fullContent, agents: currentAgents, isStreaming: true },
                ]);
                assistantAdded = true;
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.id === assistantMsgId) {
                    updated[updated.length - 1] = { ...last, content: fullContent };
                  }
                  return updated;
                });
              }
            } else if (event.type === 'agent_done' || event.type === 'synthesis_done' || event.type === 'done') {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.id === assistantMsgId) {
                  updated[updated.length - 1] = { ...last, isStreaming: false };
                }
                return updated;
              });
            } else if (event.type === 'error') {
              setShowTyping(false);
              setMessages((prev) => [
                ...prev,
                { id: generateId(), role: 'assistant', content: event.message ?? 'Terjadi kesalahan.' },
              ]);
            }
          } catch { /* skip parse errors */ }
        }
      }
    } catch (error) {
      setShowTyping(false);
      const errorMessage =
        error instanceof Error && error.message === 'AUTH_REQUIRED'
          ? 'Silakan masuk terlebih dahulu untuk menyimpan percakapan.'
          : 'Maaf, tidak dapat terhubung ke server. Coba lagi.';
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: 'assistant', content: errorMessage },
      ]);
    } finally {
      setStatus('idle');
      setShowTyping(false);
      setActiveAgents([]);
      inputRef.current?.focus();
    }
  }

  const statusLabel =
    status === 'orchestrating'
      ? 'Menganalisis pertanyaan...'
      : status === 'synthesizing'
        ? 'Menyintesis jawaban...'
        : activeAgents.length > 0
          ? `${activeAgents.map((a) => a.name.replace(' Lawyer AI', '').replace(' AI', '')).join(', ')} sedang menjawab...`
          : null;

  const reversedMessages = [...messages].reverse();
  const webTopPad = Platform.OS === 'web' ? 67 : 0;
  const webBottomPad = Platform.OS === 'web' ? 34 : 0;

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
        <View style={styles.headerLeft}>
          {token ? (
            <Pressable
              onPress={openDrawer}
              style={({ pressed }) => [styles.headerIconBtn, { opacity: pressed ? 0.6 : 1 }]}
              testID="history-btn"
            >
              <Ionicons name="menu-outline" size={24} color={colors.primary} />
            </Pressable>
          ) : null}
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Ionicons name="scale-outline" size={14} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>LexBot</Text>
        </View>
        <Pressable
          onPress={startNewChat}
          style={({ pressed }) => [styles.newChatBtn, { opacity: pressed ? 0.6 : 1 }]}
          testID="new-chat-btn"
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {isLoadingConversation ? (
          <View style={styles.loadingConvContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingConvText, { color: colors.mutedForeground }]}>
              Memuat percakapan...
            </Text>
          </View>
        ) : (
          <FlatList
            data={reversedMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatMessage message={item} />}
            inverted={messages.length > 0}
            ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
            contentContainerStyle={styles.listContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="scale" size={48} color={colors.muted} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>LexBot</Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  Tanyakan apa saja seputar hukum Indonesia
                </Text>
                <View style={styles.suggestions}>
                  {['Apa syarat mendirikan PT?', 'Berapa pesangon PHK 5 tahun?', 'Bagaimana proses perceraian?'].map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => handleSend(s)}
                      style={({ pressed }) => [
                        styles.suggestion,
                        { borderColor: colors.border, backgroundColor: pressed ? colors.muted : 'transparent' },
                      ]}
                    >
                      <Text style={[styles.suggestionText, { color: colors.mutedForeground }]}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            }
          />
        )}

        {/* Status bar */}
        {statusLabel && (
          <View style={[styles.statusBar, { backgroundColor: colors.muted }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>{statusLabel}</Text>
          </View>
        )}

        {/* Input */}
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + webBottomPad + 8,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            placeholder="Tanya pertanyaan hukum..."
            placeholderTextColor={colors.mutedForeground}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            blurOnSubmit={false}
            onSubmitEditing={() => handleSend(inputText)}
            testID="chat-input"
          />
          <Pressable
            onPress={() => {
              handleSend(inputText);
              inputRef.current?.focus();
            }}
            disabled={isStreaming || !inputText.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: inputText.trim() && !isStreaming ? colors.primary : colors.muted,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            testID="send-btn"
          >
            {isStreaming ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Ionicons name="arrow-up" size={18} color={inputText.trim() ? colors.primaryForeground : colors.mutedForeground} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Conversation history drawer */}
      <ConversationDrawer
        visible={drawerVisible}
        conversations={conversations}
        activeConversationId={conversationId}
        isLoading={isLoadingHistory}
        onClose={() => setDrawerVisible(false)}
        onSelectConversation={loadConversation}
        onNewChat={startNewChat}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: { padding: 4 },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700' as const },
  newChatBtn: { padding: 4 },
  listContent: { paddingVertical: 12 },
  loadingConvContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingConvText: {
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyTitle: { fontSize: 24, fontWeight: '700' as const, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  suggestions: { width: '100%', gap: 8 },
  suggestion: { borderWidth: 1, borderRadius: 12, padding: 12 },
  suggestionText: { fontSize: 14 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusText: { fontSize: 13, fontStyle: 'italic' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
});
