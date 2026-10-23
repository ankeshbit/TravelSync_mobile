import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { chatWithAiGuide } from '@/api/trips';
import { Theme } from '@/constants/theme';
import { ExploreDestination } from '@/types/trip';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  destinations?: ExploreDestination[];
  structuredFollowUps?: {
    field: string;
    question: string;
    options: { label: string; value: any }[];
  }[];
}

const SAMPLE_PROMPTS = [
  'Relaxing beach vacation for 5 days',
  'Mountain trekking adventure on a budget',
  'Cultural city break with great food',
  'Romantic weekend getaway in Europe',
];

const INITIAL_WELCOME: ChatMessage = {
  id: 'welcome_0',
  sender: 'bot',
  text: 'Welcome to TravelSync AI Guide! Tell me what kind of journey you have in mind (e.g. "Relaxing beach trip for 5 days on a moderate budget"), and I will find ideal destinations with grounded recommendations.',
};

let msgCounter = 0;
function createMessageId(role: string) {
  msgCounter += 1;
  return `${role}_${msgCounter}`;
}

interface AiTravelChatbotProps {
  visible: boolean;
  onClose: () => void;
}

export function AiTravelChatbot({ visible, onClose }: AiTravelChatbotProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<any>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput('');
    const userMsg: ChatMessage = {
      id: createMessageId('user'),
      sender: 'user',
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await chatWithAiGuide(query, history);

      const botMsg: ChatMessage = {
        id: createMessageId('bot'),
        sender: 'bot',
        text: res?.reply || res?.message || 'Here are some recommendations based on your preferences.',
        destinations: res?.destinations || res?.recommendations || [],
        structuredFollowUps: res?.structuredFollowUps || [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: createMessageId('bot_error'),
        sender: 'bot',
        text: 'Sorry, I encountered an issue connecting to the TravelSync AI recommendation service. Please ensure the backend is running.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanDestination = (dest: ExploreDestination | any) => {
    onClose();
    router.push({
      pathname: '/trip/create',
      params: {
        destination: dest.name || dest.destination || '',
      },
    });
  };

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: 'Conversation reset. What destination or adventure would you like to explore next?',
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalWindow}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="sparkles" size={18} color={Theme.colors.accent} />
              </View>
              <View>
                <Text style={styles.title}>TravelSync AI Guide</Text>
                <Text style={styles.subtitle}>Grounded Destination Recommendations</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleReset}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.iconBtn}
              >
                <Ionicons name="refresh" size={18} color={Theme.colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.iconBtn}
              >
                <Ionicons name="close" size={20} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages Body */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageBubbleWrapper,
                  msg.sender === 'user' ? styles.userWrapper : styles.botWrapper,
                ]}
              >
                {msg.sender === 'bot' && (
                  <View style={styles.botAvatar}>
                    <Ionicons name="compass" size={14} color={Theme.colors.accent} />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View
                    style={[
                      styles.messageBubble,
                      msg.sender === 'user' ? styles.userBubble : styles.botBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        msg.sender === 'user' ? styles.userText : styles.botText,
                      ]}
                    >
                      {msg.text}
                    </Text>
                  </View>

                  {/* Destination Cards */}
                  {msg.destinations && msg.destinations.length > 0 && (
                    <View style={styles.destinationList}>
                      {msg.destinations.map((dest: any, idx: number) => (
                        <View key={idx} style={styles.destinationCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.destName}>{dest.name || dest.destination}</Text>
                            {dest.country ? (
                              <Text style={styles.destCountry}>{dest.country}</Text>
                            ) : null}
                            {dest.description || dest.explanation ? (
                              <Text style={styles.destDesc} numberOfLines={2}>
                                {dest.description || dest.explanation}
                              </Text>
                            ) : null}
                          </View>
                          <TouchableOpacity
                            style={styles.planBtn}
                            onPress={() => handlePlanDestination(dest)}
                          >
                            <Text style={styles.planBtnText}>Plan Trip</Text>
                            <Ionicons name="arrow-forward" size={12} color={Theme.colors.accentText} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Structured Follow-Up Options */}
                  {msg.structuredFollowUps && msg.structuredFollowUps.length > 0 && (
                    <View style={styles.followUpBox}>
                      <Text style={styles.followUpTitle}>Refine recommendations:</Text>
                      {msg.structuredFollowUps.map((q, qIdx) => (
                        <View key={qIdx} style={{ marginTop: 6 }}>
                          <Text style={styles.followUpQuestion}>{q.question}</Text>
                          <View style={styles.optionsWrap}>
                            {q.options.map((opt, optIdx) => (
                              <TouchableOpacity
                                key={optIdx}
                                style={styles.optionPill}
                                onPress={() => handleSend(`${q.field}: ${opt.label}`)}
                              >
                                <Text style={styles.optionPillText}>{opt.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}

            {/* Quick Prompt Pills (Shown when only welcome message is present) */}
            {messages.length === 1 && (
              <View style={styles.promptsContainer}>
                <Text style={styles.promptsLabel}>Quick Prompts</Text>
                <View style={styles.promptsRow}>
                  {SAMPLE_PROMPTS.map((prompt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.promptPill}
                      onPress={() => handleSend(prompt)}
                    >
                      <Text style={styles.promptPillText}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {loading && (
              <View style={[styles.messageBubbleWrapper, styles.botWrapper]}>
                <View style={styles.botAvatar}>
                  <Ionicons name="compass" size={14} color={Theme.colors.accent} />
                </View>
                <View style={[styles.messageBubble, styles.botBubble, { paddingVertical: 10 }]}>
                  <ActivityIndicator size="small" color={Theme.colors.accent} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input Bar */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ask for travel ideas, places..."
              placeholderTextColor={Theme.colors.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={() => handleSend()}
              disabled={!input.trim() || loading}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={input.trim() ? Theme.colors.accentText : Theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalWindow: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Theme.colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(167, 169, 154, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 16,
    gap: 12,
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  botWrapper: {
    justifyContent: 'flex-start',
  },
  botAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: Theme.colors.accent,
    alignSelf: 'flex-end',
    borderTopRightRadius: 2,
  },
  botBubble: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignSelf: 'flex-start',
    borderTopLeftRadius: 2,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  userText: {
    color: Theme.colors.accentText,
    fontWeight: '600',
  },
  botText: {
    color: Theme.colors.textPrimary,
  },
  promptsContainer: {
    marginTop: 8,
  },
  promptsLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: Theme.colors.textMuted,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  promptsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptPill: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  promptPillText: {
    fontSize: 12,
    color: Theme.colors.textPrimary,
  },
  destinationList: {
    marginTop: 8,
    gap: 8,
  },
  destinationCard: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.md,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  destName: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  destCountry: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  destDesc: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.sm,
  },
  planBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.accentText,
  },
  followUpBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: 'rgba(167, 169, 154, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167, 169, 154, 0.2)',
  },
  followUpTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.accent,
  },
  followUpQuestion: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionPill: {
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  optionPillText: {
    fontSize: 11,
    color: Theme.colors.textPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    backgroundColor: Theme.colors.surfaceElevated,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: Theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    color: Theme.colors.textPrimary,
    fontSize: 13,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
});
