import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, tintedShadow } from '../theme';
import { fetchSupportMessages, sendSupportMessage } from '../api';
import type { SupportMessage } from '../api';

type Props = {
  token: string;
  onBack: () => void;
};

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

export default function SupportScreen({ token, onBack }: Props) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetchSupportMessages(token);
      setMessages(result);
    } catch (err: any) {
      if (!silent) setError(err?.message || 'تعذر تحميل المحادثة.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError('');
    try {
      const message = await sendSupportMessage(token, trimmed);
      setMessages((current) => [...current, message]);
      setText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الرسالة.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>الدعم الفني</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubbles-outline" size={30} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>ابدأ محادثة مع الدعم الفني</Text>
              <Text style={styles.emptyBody}>لأي استفسار أو مشكلة، راسلنا وسنرد عليك في أقرب وقت.</Text>
            </View>
          ) : (
            messages.map((message) => {
              const isRestaurant = message.senderType === 'restaurant';
              return (
                <View key={message.id} style={[styles.bubbleRow, isRestaurant ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
                  <View style={[styles.bubble, isRestaurant ? styles.bubbleRestaurant : styles.bubbleAdmin]}>
                    {!isRestaurant ? <Text style={styles.bubbleSender}>{message.senderName || 'الدعم الفني'}</Text> : null}
                    <Text style={[styles.bubbleText, isRestaurant ? styles.bubbleTextRestaurant : styles.bubbleTextAdmin]}>{message.text}</Text>
                    <Text style={[styles.bubbleTime, isRestaurant ? styles.bubbleTimeRestaurant : styles.bubbleTimeAdmin]}>{formatTime(message.createdAt)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending || !text.trim()}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="اكتب رسالتك..."
          placeholderTextColor={colors.muted}
          textAlign="right"
          multiline
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14 },
  backButton: { flexDirection: 'row-reverse', alignItems: 'center', width: 60 },
  backText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },

  list: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing.lg },
  emptyIconWrap: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: colors.text, marginBottom: 4 },
  emptyBody: { fontSize: 12.5, color: colors.subtext, textAlign: 'center', lineHeight: 18 },

  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleRestaurant: { backgroundColor: colors.primary, borderBottomEndRadius: 4 },
  bubbleAdmin: { backgroundColor: colors.card, borderBottomStartRadius: 4, ...tintedShadow(colors.text, 0.05) },
  bubbleSender: { fontSize: 10.5, fontWeight: '800', color: colors.accent, textAlign: 'right', marginBottom: 3 },
  bubbleText: { fontSize: 13.5, fontWeight: '600', textAlign: 'right', lineHeight: 19 },
  bubbleTextRestaurant: { color: '#fff' },
  bubbleTextAdmin: { color: colors.text },
  bubbleTime: { fontSize: 9.5, fontWeight: '700', marginTop: 4, textAlign: 'right' },
  bubbleTimeRestaurant: { color: 'rgba(255,255,255,0.75)' },
  bubbleTimeAdmin: { color: colors.subtext },

  errorText: { color: colors.danger, fontWeight: '700', fontSize: 12, textAlign: 'center', marginBottom: 6 },
  inputRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 8, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8, backgroundColor: colors.bg },
  input: { flex: 1, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.text, maxHeight: 100 },
  sendButton: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
