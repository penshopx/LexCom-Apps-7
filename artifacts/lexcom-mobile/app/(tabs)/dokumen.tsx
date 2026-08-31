import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  createDocument,
  getListDocumentsQueryKey,
  type LegalDocument,
  useDeleteDocument,
  useListDocuments,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { getApiBase, useAuth } from '@/context/AuthContext';

type DocumentType = {
  value: string;
  label: string;
  description: string;
};

const DOCUMENT_TYPES: DocumentType[] = [
  { value: 'gugatan', label: 'Surat Gugatan', description: 'Untuk perkara perdata di pengadilan' },
  { value: 'jawaban', label: 'Surat Jawaban', description: 'Tanggapan atas surat gugatan' },
  { value: 'replik', label: 'Replik', description: 'Tanggapan penggugat atas jawaban' },
  { value: 'duplik', label: 'Duplik', description: 'Tanggapan tergugat atas replik' },
  { value: 'surat_kuasa', label: 'Surat Kuasa', description: 'Pemberian kuasa untuk urusan hukum' },
  { value: 'kontrak', label: 'Kontrak / Perjanjian', description: 'Kesepakatan bisnis yang lebih lengkap' },
  { value: 'perjanjian', label: 'Perjanjian', description: 'Perjanjian umum sesuai KUHPerdata' },
];

type GeneratedEvent = {
  content?: string;
  error?: string;
  done?: boolean;
};

function documentLabel(documentType: string): string {
  return DOCUMENT_TYPES.find((item) => item.value === documentType)?.label ?? documentType;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isUnauthorized(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status?: unknown }).status === 401,
  );
}

async function streamGeneratedDocument(
  payload: {
    documentType: string;
    description: string;
    parties?: string;
    details?: string;
  },
  token: string,
  onContent: (content: string) => void,
): Promise<string> {
  const response = await expoFetch(`${getApiBase()}/documents/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }
    let message = 'Gagal memulai pembuatan dokumen.';
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the friendly fallback when the server does not return JSON.
    }
    throw new Error(message);
  }

  let fullContent = '';
  let buffer = '';
  let completed = false;
  const decoder = new TextDecoder();

  const processLine = (line: string) => {
    if (!line.startsWith('data: ')) return;
    try {
      const event = JSON.parse(line.slice(6)) as GeneratedEvent;
      if (event.error) throw new Error(event.error);
      if (event.done) completed = true;
      if (event.content) {
        fullContent += event.content;
        onContent(fullContent);
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Unexpected end of JSON input') {
        throw error;
      }
    }
  };

  const reader = response.body?.getReader();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) processLine(line.trimEnd());
    }
    buffer += decoder.decode();
    if (buffer) processLine(buffer.trimEnd());
  } else {
    // React Native versions without ReadableStream still receive the complete
    // SSE response, so parse it as a fallback rather than losing the result.
    const text = await response.text();
    for (const line of text.split('\n')) processLine(line.trimEnd());
  }

  if (!completed) {
    throw new Error('Pembuatan dokumen terputus sebelum selesai. Silakan coba lagi.');
  }
  if (!fullContent.trim()) {
    throw new Error('AI tidak menghasilkan dokumen. Silakan coba lagi.');
  }
  return fullContent;
}

export default function DokumenScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, isLoading: authLoading, login, logout } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);

  const [documentType, setDocumentType] = useState('gugatan');
  const [description, setDescription] = useState('');
  const [parties, setParties] = useState('');
  const [details, setDetails] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedDocumentId, setSavedDocumentId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const {
    data: documents,
    error: historyError,
    isLoading: isLoadingDocuments,
    isError: isHistoryError,
  } =
    useListDocuments({
      query: {
        queryKey: [...getListDocumentsQueryKey(), token ?? 'signed-out'],
        enabled: !authLoading && Boolean(token),
      },
    });
  const deleteMutation = useDeleteDocument();

  useEffect(() => {
    if (token && isUnauthorized(historyError)) {
      void logout();
    }
  }, [historyError, logout, token]);

  const selectedType = useMemo(
    () => DOCUMENT_TYPES.find((item) => item.value === documentType) ?? DOCUMENT_TYPES[0],
    [documentType],
  );

  const title = `${selectedType.label} - ${new Date().toLocaleDateString('id-ID')}`;
  const webTopPad = Platform.OS === 'web' ? 67 : 0;
  const webBottomPad = Platform.OS === 'web' ? 34 : 0;

  const saveGeneratedDocument = useCallback(async (content: string) => {
    if (!token) {
      setSaveError('Sesi Anda berakhir. Masuk kembali untuk menyimpan dokumen.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await createDocument(
        { title, documentType, content },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSavedDocumentId(saved.id);
      await queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      setFeedback('Dokumen tersimpan di riwayat.');
    } catch (error) {
      if (isUnauthorized(error)) {
        await logout();
        return;
      }
      setSaveError('Dokumen sudah siap, tetapi belum tersimpan. Coba simpan lagi.');
    } finally {
      setIsSaving(false);
    }
  }, [documentType, logout, queryClient, title, token]);

  async function handleGenerate() {
    if (!token || !description.trim() || isGenerating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);
    setGeneratedContent('');
    setSavedDocumentId(null);
    setGenerationError(null);
    setSaveError(null);
    setFeedback(null);

    try {
      const content = await streamGeneratedDocument(
        {
          documentType,
          description: description.trim(),
          ...(parties.trim() ? { parties: parties.trim() } : {}),
          ...(details.trim() ? { details: details.trim() } : {}),
        },
        token,
        setGeneratedContent,
      );
      await saveGeneratedDocument(content);
    } catch (error) {
      setGeneratedContent('');
      setSavedDocumentId(null);
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
        await logout();
        return;
      }
      setGenerationError(error instanceof Error ? error.message : 'Koneksi ke AI terputus. Silakan coba lagi.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!generatedContent) return;
    await Clipboard.setStringAsync(generatedContent);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFeedback('Dokumen disalin ke clipboard.');
  }

  async function handleShare() {
    if (!generatedContent) return;
    await Share.share({ title, message: generatedContent });
  }

  function openDocument(document: LegalDocument) {
    setDocumentType(document.documentType);
    setGeneratedContent(document.content);
    setSavedDocumentId(document.id);
    setGenerationError(null);
    setSaveError(null);
    setFeedback(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function confirmDelete(document: LegalDocument) {
    Alert.alert(
      'Hapus dokumen?',
      `Riwayat “${document.title}” akan dihapus permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(
              { id: document.id },
              {
                onSuccess: () => {
                  void queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
                  if (savedDocumentId === document.id) {
                    setSavedDocumentId(null);
                    setGeneratedContent('');
                  }
                },
                onError: (error) => {
                  if (isUnauthorized(error)) {
                    void logout();
                    return;
                  }
                  Alert.alert('Gagal menghapus', 'Dokumen belum dapat dihapus. Silakan coba lagi.');
                },
              },
            );
          },
        },
      ],
    );
  }

  if (authLoading) {
    return (
      <View style={[styles.centeredState, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!token) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
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
            <Ionicons name="document-text-outline" size={15} color={colors.primaryForeground} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Dokumen</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Susun draft hukum dengan AI</Text>
          </View>
        </View>
        <View style={styles.authGate}>
          <View style={[styles.authIcon, { backgroundColor: colors.primary + '22' }]}>
            <Ionicons name="lock-closed-outline" size={34} color={colors.primary} />
          </View>
          <Text style={[styles.authTitle, { color: colors.foreground }]}>Masuk untuk membuat dokumen</Text>
          <Text style={[styles.authText, { color: colors.mutedForeground }]}>
            Dokumen hukum bersifat pribadi. Masuk agar draft tersimpan aman dan hanya dapat diakses oleh Anda.
          </Text>
          <Pressable
            onPress={() => void login()}
            style={({ pressed }) => [
              styles.authButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Ionicons name="log-in-outline" size={19} color={colors.primaryForeground} />
            <Text style={[styles.authButtonText, { color: colors.primaryForeground }]}>Masuk untuk melanjutkan</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          <Ionicons name="document-text-outline" size={15} color={colors.primaryForeground} />
        </View>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Dokumen</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Susun draft hukum dengan AI</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + webBottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.introCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.introIcon, { backgroundColor: colors.primary + '22' }]}>
            <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.introCopy}>
            <Text style={[styles.introTitle, { color: colors.foreground }]}>Mulai dari kebutuhan Anda</Text>
            <Text style={[styles.introText, { color: colors.mutedForeground }]}>
              Jelaskan konteksnya, lalu LexCom menyusun draft formal dalam hitungan detik.
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>JENIS DOKUMEN</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeList}>
          {DOCUMENT_TYPES.map((item) => {
            const isSelected = item.value === documentType;
            return (
              <Pressable
                key={item.value}
                onPress={() => setDocumentType(item.value)}
                disabled={isGenerating}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: isGenerating ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'document-outline'}
                  size={16}
                  color={isSelected ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text style={[styles.typeChipText, { color: isSelected ? colors.primaryForeground : colors.foreground }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={[styles.typeDescription, { color: colors.mutedForeground }]}>{selectedType.description}</Text>

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Deskripsi kasus / kebutuhan <Text style={{ color: colors.accent }}>*</Text></Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Contoh: perjanjian kerja untuk posisi manajer pemasaran..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            editable={!isGenerating}
            testID="document-description"
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Identitas pihak <Text style={[styles.optional, { color: colors.mutedForeground }]}>opsional</Text></Text>
          <TextInput
            value={parties}
            onChangeText={setParties}
            placeholder="Nama, alamat, pekerjaan, atau identitas para pihak"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.multilineInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            editable={!isGenerating}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Detail tambahan <Text style={[styles.optional, { color: colors.mutedForeground }]}>opsional</Text></Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Nominal, tenggat, pasal khusus, dan detail lain"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            editable={!isGenerating}
          />
          <Pressable
            onPress={() => void handleGenerate()}
            disabled={isGenerating || !description.trim()}
            style={({ pressed }) => [
              styles.generateButton,
              { backgroundColor: colors.primary, opacity: isGenerating || !description.trim() ? 0.5 : pressed ? 0.82 : 1 },
            ]}
            testID="generate-document"
          >
            {isGenerating ? <ActivityIndicator color={colors.primaryForeground} /> : <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />}
            <Text style={[styles.generateButtonText, { color: colors.primaryForeground }]}>
              {isGenerating ? 'Menyusun draft...' : 'Generate dokumen'}
            </Text>
          </Pressable>
        </View>

        {generationError ? (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive }]}>
            <Ionicons name="alert-circle-outline" size={19} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.foreground }]}>{generationError}</Text>
            <Pressable onPress={() => void handleGenerate()} disabled={isGenerating} style={styles.retryButton}>
              <Ionicons name="refresh" size={17} color={colors.destructive} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.previewHeader}>
            <View style={styles.previewTitleRow}>
              <View style={[styles.previewIcon, { backgroundColor: colors.secondary + '22' }]}>
                <Ionicons name="reader-outline" size={18} color={colors.secondary} />
              </View>
              <View>
                <Text style={[styles.previewTitle, { color: colors.foreground }]}>Preview dokumen</Text>
                {savedDocumentId ? <Text style={[styles.savedLabel, { color: colors.secondary }]}>Tersimpan di riwayat</Text> : null}
              </View>
            </View>
            {generatedContent ? (
              <View style={styles.actionRow}>
                <Pressable onPress={() => void handleCopy()} style={styles.iconAction} accessibilityLabel="Salin dokumen">
                  <Ionicons name="copy-outline" size={20} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => void handleShare()} style={styles.iconAction} accessibilityLabel="Bagikan dokumen">
                  <Ionicons name="share-outline" size={20} color={colors.primary} />
                </Pressable>
              </View>
            ) : null}
          </View>
          {feedback ? <Text style={[styles.feedback, { color: colors.secondary }]}>{feedback}</Text> : null}
          {saveError ? (
            <View style={styles.saveErrorRow}>
              <Text style={[styles.saveError, { color: colors.destructive }]}>{saveError}</Text>
              <Pressable onPress={() => void saveGeneratedDocument(generatedContent)} disabled={isSaving}>
                <Text style={[styles.saveRetry, { color: colors.primary }]}>Simpan lagi</Text>
              </Pressable>
            </View>
          ) : null}
          {isSaving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.savingText, { color: colors.mutedForeground }]}>Menyimpan dokumen...</Text>
            </View>
          ) : null}
          {generatedContent ? (
            <Text selectable style={[styles.documentText, { color: colors.foreground }]}>{generatedContent}</Text>
          ) : isGenerating ? (
            <View style={styles.emptyPreview}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.emptyPreviewTitle, { color: colors.foreground }]}>Menyiapkan struktur dokumen</Text>
              <Text style={[styles.emptyPreviewText, { color: colors.mutedForeground }]}>Draft akan muncul saat AI mulai menulis.</Text>
            </View>
          ) : (
            <View style={styles.emptyPreview}>
              <Ionicons name="document-text-outline" size={38} color={colors.mutedForeground} />
              <Text style={[styles.emptyPreviewTitle, { color: colors.foreground }]}>Draft akan muncul di sini</Text>
              <Text style={[styles.emptyPreviewText, { color: colors.mutedForeground }]}>Isi kebutuhan Anda dan mulai generate.</Text>
            </View>
          )}
        </View>

        <View style={styles.historyHeader}>
          <View>
            <Text style={[styles.historyTitle, { color: colors.foreground }]}>Riwayat dokumen</Text>
            <Text style={[styles.historySubtitle, { color: colors.mutedForeground }]}>Draft yang tersimpan di akun Anda</Text>
          </View>
          <Ionicons name="folder-open-outline" size={22} color={colors.primary} />
        </View>

        {isLoadingDocuments ? (
          <View style={styles.loadingHistory}><ActivityIndicator color={colors.primary} /></View>
        ) : isHistoryError ? (
          <View style={[styles.historyEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.historyEmptyText, { color: colors.mutedForeground }]}>Riwayat belum dapat dimuat.</Text>
          </View>
        ) : !documents?.length ? (
          <View style={[styles.historyEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="file-tray-outline" size={28} color={colors.mutedForeground} />
            <Text style={[styles.historyEmptyTitle, { color: colors.foreground }]}>Belum ada dokumen tersimpan</Text>
            <Text style={[styles.historyEmptyText, { color: colors.mutedForeground }]}>Dokumen yang selesai dibuat akan otomatis muncul di sini.</Text>
          </View>
        ) : (
          <FlatList
            data={documents}
            scrollEnabled={false}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => openDocument(item)}
                style={({ pressed }) => [
                  styles.historyItem,
                  { backgroundColor: colors.card, borderColor: pressed ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.historyItemIcon, { backgroundColor: colors.muted }]}>
                  <Ionicons name="document-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.historyItemCopy}>
                  <Text numberOfLines={1} style={[styles.historyItemTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.historyItemMeta, { color: colors.mutedForeground }]}>
                    {documentLabel(item.documentType)} · {formatDate(item.createdAt)}
                  </Text>
                  <Text numberOfLines={2} style={[styles.historyItemPreview, { color: colors.mutedForeground }]}>{item.content}</Text>
                </View>
                <Pressable onPress={() => confirmDelete(item)} style={styles.deleteButton} accessibilityLabel={`Hapus ${item.title}`}>
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </Pressable>
              </Pressable>
            )}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700' as const },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14 },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  introIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1 },
  introTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 3 },
  introText: { fontSize: 13, lineHeight: 19 },
  sectionLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8, marginBottom: 9 },
  typeList: { gap: 8, paddingRight: 16 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  typeChipText: { fontSize: 13, fontWeight: '600' as const },
  typeDescription: { fontSize: 12, marginTop: 8, marginBottom: 14 },
  formCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600' as const, marginBottom: 7, marginTop: 2 },
  optional: { fontSize: 11, fontWeight: '400' as const },
  textArea: { minHeight: 110, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 11, fontSize: 14, lineHeight: 21, marginBottom: 13 },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, marginBottom: 13 },
  multilineInput: { minHeight: 66, textAlignVertical: 'top' },
  generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 12, marginTop: 2 },
  generateButtonText: { fontSize: 15, fontWeight: '700' as const },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 14 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
  retryButton: { padding: 5 },
  previewCard: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
  previewTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  previewIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontSize: 15, fontWeight: '700' as const },
  savedLabel: { fontSize: 11, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 6 },
  iconAction: { padding: 7 },
  feedback: { fontSize: 12, paddingHorizontal: 14, paddingBottom: 8 },
  saveErrorRow: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  saveError: { fontSize: 12 },
  saveRetry: { fontSize: 12, fontWeight: '700' as const },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  savingText: { fontSize: 12 },
  documentText: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 14, lineHeight: 23, paddingHorizontal: 16, paddingBottom: 18 },
  emptyPreview: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 38 },
  emptyPreviewTitle: { fontSize: 14, fontWeight: '600' as const, marginTop: 10, marginBottom: 4 },
  emptyPreviewText: { fontSize: 13, textAlign: 'center' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  historyTitle: { fontSize: 18, fontWeight: '700' as const },
  historySubtitle: { fontSize: 12, marginTop: 3 },
  loadingHistory: { paddingVertical: 28, alignItems: 'center' },
  historyEmpty: { alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 22, gap: 6 },
  historyEmptyTitle: { fontSize: 14, fontWeight: '600' as const, textAlign: 'center' },
  historyEmptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 14, padding: 11, marginBottom: 9 },
  historyItemIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  historyItemCopy: { flex: 1, minWidth: 0 },
  historyItemTitle: { fontSize: 14, fontWeight: '700' as const, marginBottom: 3 },
  historyItemMeta: { fontSize: 11, marginBottom: 5 },
  historyItemPreview: { fontSize: 12, lineHeight: 17 },
  deleteButton: { padding: 6, marginLeft: 3 },
  authGate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 64 },
  authIcon: { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  authTitle: { fontSize: 21, fontWeight: '700' as const, textAlign: 'center', marginBottom: 8 },
  authText: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 22 },
  authButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, paddingHorizontal: 20, borderRadius: 12 },
  authButtonText: { fontSize: 14, fontWeight: '700' as const },
});