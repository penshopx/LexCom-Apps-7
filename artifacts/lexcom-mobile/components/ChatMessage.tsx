import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';

export interface AgentInfo {
  key: string;
  name: string;
  color: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agents?: AgentInfo[];
  isStreaming?: boolean;
  statusText?: string;
}

interface Props {
  message: Message;
}

export default function ChatMessage({ message }: Props) {
  const colors = useColors();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && message.agents && message.agents.length > 0 && (
        <View style={styles.agentBadges}>
          {message.agents.map((agent) => (
            <View
              key={agent.key}
              style={[styles.agentDot, { backgroundColor: agent.color }]}
            />
          ))}
          <Text style={[styles.agentLabel, { color: colors.mutedForeground }]}>
            {message.agents.map((a) => a.name.replace(' Lawyer AI', '').replace(' AI', '')).join(' + ')}
          </Text>
        </View>
      )}

      {message.statusText ? (
        <View style={[styles.statusBubble, { backgroundColor: colors.muted }]}>
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            {message.statusText}
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.userBubble, { backgroundColor: colors.primary }]
              : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}
        >
          <Text
            style={[
              styles.content,
              { color: isUser ? colors.primaryForeground : colors.foreground },
            ]}
          >
            {message.content}
            {message.isStreaming && (
              <Text style={{ color: colors.primary }}> ▍</Text>
            )}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  rowAssistant: {
    alignItems: 'flex-start',
  },
  agentBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    paddingLeft: 2,
  },
  agentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  agentLabel: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Inter_500Medium' : undefined,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  userBubble: {
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  statusBubble: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '80%',
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Inter_400Regular' : undefined,
  },
  statusText: {
    fontSize: 13,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Inter_400Regular' : undefined,
  },
});
