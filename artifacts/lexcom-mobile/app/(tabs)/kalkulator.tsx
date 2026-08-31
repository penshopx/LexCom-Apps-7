import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import {
  calculateBphtb,
  calculatePesangon,
  MAX_BPHTB_RATE_PERCENT,
  TERMINATION_REASONS,
  TERMINATION_RULES,
  type TerminationReason,
} from '@/lib/legalCalculators';

function formatRp(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function KalkulatorPesangon() {
  const colors = useColors();
  const [gajiStr, setGajiStr] = useState('');
  const [tahunStr, setTahunStr] = useState('');
  const [reason, setReason] = useState<TerminationReason>('company_standard');
  const [result, setResult] = useState<{
    pesangon: number;
    penghargaan: number;
    total: number;
    severanceMultiplier: number;
    serviceAwardMultiplier: number;
    reasonLabel: string;
  } | null>(null);

  function calculate() {
    const gaji = parseFloat(gajiStr.replace(/[^\d.]/g, ''));
    const tahun = parseFloat(tahunStr);
    if (!gaji || Number.isNaN(tahun) || tahun < 0) return;

    const selectedReason = TERMINATION_RULES[reason];
    const calculation = calculatePesangon(gaji, tahun, reason);
    setResult({
      pesangon: calculation.severance,
      penghargaan: calculation.serviceAward,
      total: calculation.total,
      severanceMultiplier: calculation.severanceMultiplier,
      serviceAwardMultiplier: calculation.serviceAwardMultiplier,
      reasonLabel: selectedReason.label,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={[styles.calcCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.calcColorBar, { backgroundColor: '#10b981' }]} />
      <View style={styles.calcInner}>
        <Text style={[styles.calcTitle, { color: colors.foreground }]}>Kalkulator Pesangon</Text>
        <Text style={[styles.calcSub, { color: colors.mutedForeground }]}>
          PP 35/2021 — sesuaikan dengan alasan berakhirnya hubungan kerja
        </Text>
        <View style={styles.optionGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Alasan berakhirnya hubungan kerja</Text>
          <View style={styles.optionRow}>
            {TERMINATION_REASONS.map((optionReason) => {
              const option = TERMINATION_RULES[optionReason];
              const isSelected = reason === optionReason;
              return (
                <Pressable
                  key={optionReason}
                  onPress={() => {
                    setReason(optionReason);
                    setResult(null);
                  }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: isSelected ? '#10b981' : colors.muted,
                      borderColor: isSelected ? '#10b981' : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionText, { color: isSelected ? '#fff' : colors.mutedForeground }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
            {TERMINATION_RULES[reason].explanation}
          </Text>
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Gaji Bulanan (Rp)</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            placeholder="mis. 5000000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={gajiStr}
            onChangeText={setGajiStr}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Masa Kerja (tahun)</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            placeholder="mis. 5"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={tahunStr}
            onChangeText={setTahunStr}
          />
        </View>
        <Pressable
          onPress={calculate}
          style={({ pressed }) => [styles.calcBtn, { backgroundColor: '#10b981', opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={styles.calcBtnText}>Hitung</Text>
        </Pressable>
        {result && (
          <View style={[styles.resultBox, { backgroundColor: colors.muted }]}>
            <Text style={[styles.resultContext, { color: colors.mutedForeground }]}>
              {result.reasonLabel} · pesangon {result.severanceMultiplier.toLocaleString('id-ID')}× · UPMK {result.serviceAwardMultiplier.toLocaleString('id-ID')}×
            </Text>
            <ResultRow label="Pesangon" value={formatRp(result.pesangon)} color={colors.foreground} muted={colors.mutedForeground} />
            <ResultRow label="Penghargaan Masa Kerja" value={formatRp(result.penghargaan)} color={colors.foreground} muted={colors.mutedForeground} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ResultRow label="Total Estimasi" value={formatRp(result.total)} color='#10b981' muted={colors.mutedForeground} bold />
            <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
              * Belum termasuk uang penggantian hak (cuti, perumahan, dll).
            </Text>
            <LexBotSuggestion />
          </View>
        )}
      </View>
    </View>
  );
}

// ─── BPHTB Calculator ────────────────────────────────────────────────────────
function KalkulatorBPHTB() {
  const colors = useColors();
  const [njopStr, setNjopStr] = useState('');
  const [npoptkpStr, setNpoptkpStr] = useState('');
  const [rateStr, setRateStr] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    bphtb: number;
    npoptkp: number;
    ratePercent: number;
  } | null>(null);

  function calculate() {
    const njop = parseFloat(njopStr.replace(/[^\d]/g, ''));
    const npoptkp = parseFloat(npoptkpStr.replace(/[^\d]/g, ''));
    const ratePercent = parseFloat(
      rateStr.replace(',', '.').replace(/[^\d.]/g, ''),
    );

    if (!njop || Number.isNaN(npoptkp) || Number.isNaN(ratePercent)) {
      setError('Lengkapi nilai transaksi, NPOPTKP daerah, dan tarif daerah.');
      setResult(null);
      return;
    }
    if (npoptkp < 0 || ratePercent < 0 || ratePercent > MAX_BPHTB_RATE_PERCENT) {
      setError(`Tarif daerah harus 0–${MAX_BPHTB_RATE_PERCENT}% dan NPOPTKP tidak boleh negatif.`);
      setResult(null);
      return;
    }

    const calculation = calculateBphtb(njop, npoptkp, ratePercent);
    setError('');
    setResult({ bphtb: calculation.bphtb, npoptkp, ratePercent });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={[styles.calcCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.calcColorBar, { backgroundColor: '#f59e0b' }]} />
      <View style={styles.calcInner}>
        <Text style={[styles.calcTitle, { color: colors.foreground }]}>Kalkulator BPHTB</Text>
        <Text style={[styles.calcSub, { color: colors.mutedForeground }]}>
          Bea Perolehan Hak atas Tanah & Bangunan
        </Text>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>NJOP / Harga Transaksi (Rp)</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            placeholder="mis. 500000000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={njopStr}
            onChangeText={setNjopStr}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>NPOPTKP daerah (Rp)</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            placeholder="mis. 80000000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={npoptkpStr}
            onChangeText={setNpoptkpStr}
          />
          <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
            NPOPTKP ditetapkan pemerintah daerah dan dapat berbeda antar kabupaten/kota. Isi sesuai ketetapan BPKAD setempat.
          </Text>
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Tarif BPHTB daerah (%)</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: error ? '#ef4444' : colors.border }]}
            placeholder="mis. 5"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            value={rateStr}
            onChangeText={(value) => {
              setRateStr(value);
              setError('');
              setResult(null);
            }}
          />
          <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
            Tarif ditetapkan pemerintah daerah, dengan batas maksimum {MAX_BPHTB_RATE_PERCENT}%.
          </Text>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable
          onPress={calculate}
          style={({ pressed }) => [styles.calcBtn, { backgroundColor: '#f59e0b', opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[styles.calcBtnText, { color: '#000' }]}>Hitung</Text>
        </Pressable>
        {result !== null && (
          <View style={[styles.resultBox, { backgroundColor: colors.muted }]}>
            <ResultRow label="NPOPTKP yang digunakan" value={formatRp(result.npoptkp)} color={colors.foreground} muted={colors.mutedForeground} />
            <ResultRow label="Tarif daerah yang digunakan" value={`${result.ratePercent.toLocaleString('id-ID')}%`} color={colors.foreground} muted={colors.mutedForeground} />
            <ResultRow label="BPHTB Terutang" value={formatRp(result.bphtb)} color='#f59e0b' muted={colors.mutedForeground} bold />
            <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
              * Verifikasi NJOP, tarif, dan NPOPTKP di BPKAD setempat.
            </Text>
            <LexBotSuggestion />
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Overtime Calculator ─────────────────────────────────────────────────────
function KalkulatorLembur() {
  const colors = useColors();
  const [gajiStr, setGajiStr] = useState('');
  const [jam1Str, setJam1Str] = useState('1');
  const [jam2Str, setJam2Str] = useState('2');
  const [result, setResult] = useState<{ jam1: number; jam2: number; total: number } | null>(null);

  function calculate() {
    const gaji = parseFloat(gajiStr.replace(/[^\d.]/g, ''));
    const jam1 = parseInt(jam1Str) || 1;
    const jam2 = parseInt(jam2Str) || 0;
    if (!gaji) return;

    const upahSejam = gaji / 173;
    const bayarJam1 = jam1 * 1.5 * upahSejam;
    const bayarJam2 = jam2 * 2 * upahSejam;
    setResult({ jam1: bayarJam1, jam2: bayarJam2, total: bayarJam1 + bayarJam2 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={[styles.calcCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.calcColorBar, { backgroundColor: '#8b5cf6' }]} />
      <View style={styles.calcInner}>
        <Text style={[styles.calcTitle, { color: colors.foreground }]}>Kalkulator Upah Lembur</Text>
        <Text style={[styles.calcSub, { color: colors.mutedForeground }]}>
          Per Permenaker No. 6/2014
        </Text>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Gaji Bulanan (Rp)</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            placeholder="mis. 5000000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={gajiStr}
            onChangeText={setGajiStr}
          />
        </View>
        <View style={styles.row2}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Jam ke-1 (×1.5)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
              placeholder="1"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={jam1Str}
              onChangeText={setJam1Str}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Jam berikutnya (×2)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={jam2Str}
              onChangeText={setJam2Str}
            />
          </View>
        </View>
        <Pressable
          onPress={calculate}
          style={({ pressed }) => [styles.calcBtn, { backgroundColor: '#8b5cf6', opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={styles.calcBtnText}>Hitung</Text>
        </Pressable>
        {result && (
          <View style={[styles.resultBox, { backgroundColor: colors.muted }]}>
            <ResultRow label={`Jam ke-1 (×1.5)`} value={formatRp(result.jam1)} color={colors.foreground} muted={colors.mutedForeground} />
            <ResultRow label={`Jam berikutnya (×2)`} value={formatRp(result.jam2)} color={colors.foreground} muted={colors.mutedForeground} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ResultRow label="Total Lembur" value={formatRp(result.total)} color='#8b5cf6' muted={colors.mutedForeground} bold />
            <LexBotSuggestion />
          </View>
        )}
      </View>
    </View>
  );
}

function LexBotSuggestion() {
  const colors = useColors();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.navigate('/(tabs)')}
      style={({ pressed }) => [
        styles.lexBotSuggestion,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.card : 'transparent',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Tanya detail hasil ini kepada LexBot"
    >
      <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
      <Text style={[styles.lexBotSuggestionText, { color: colors.primary }]}>
        Tanya detail hasil ini kepada LexBot
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
    </Pressable>
  );
}

// ─── Result Row ──────────────────────────────────────────────────────────────
function ResultRow({
  label, value, color, muted, bold,
}: { label: string; value: string; color: string; muted: string; bold?: boolean }) {
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.resultValue, { color }, bold ? styles.bold : {}]}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function KalkulatorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTopPad = Platform.OS === 'web' ? 67 : 0;
  const webBottomPad = Platform.OS === 'web' ? 34 : 0;

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
        <View style={[styles.logoMark, { backgroundColor: '#8b5cf6' }]}>
          <Ionicons name="calculator-outline" size={14} color="#fff" />
        </View>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Kalkulator Hukum</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + webBottomPad + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.scrollSubtitle, { color: colors.mutedForeground }]}>
          Estimasi berdasarkan peraturan yang berlaku
        </Text>
        <View style={[styles.disclaimerBanner, { backgroundColor: colors.muted, borderColor: '#f59e0b' }]}>
          <Ionicons name="warning-outline" size={20} color="#f59e0b" />
          <View style={styles.disclaimerBannerContent}>
            <Text style={[styles.disclaimerBannerTitle, { color: colors.foreground }]}>
              Estimasi saja — konsultasikan dengan pengacara
            </Text>
            <Text style={[styles.disclaimerBannerText, { color: colors.mutedForeground }]}>
              Hasil dapat berbeda sesuai fakta perkara dan ketentuan daerah yang berlaku. Jangan jadikan hasil ini sebagai satu-satunya dasar keputusan hukum.
            </Text>
          </View>
        </View>
        <KalkulatorPesangon />
        <KalkulatorBPHTB />
        <KalkulatorLembur />
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },
  scrollSubtitle: { fontSize: 14, marginBottom: 16 },
  calcCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  calcColorBar: { width: 4 },
  calcInner: { flex: 1, padding: 14, gap: 8 },
  calcTitle: { fontSize: 17, fontWeight: '700' as const },
  calcSub: { fontSize: 12, marginTop: -4 },
  inputGroup: { gap: 4 },
  label: { fontSize: 12, fontWeight: '500' as const },
  optionGroup: { gap: 5 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  optionText: { fontSize: 12, fontWeight: '600' as const },
  helperText: { fontSize: 11, lineHeight: 16 },
  errorText: { color: '#ef4444', fontSize: 11, lineHeight: 16, fontWeight: '600' as const },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
  },
  row2: { flexDirection: 'row', gap: 8 },
  calcBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  calcBtnText: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },
  resultBox: { borderRadius: 10, padding: 12, gap: 6 },
  resultContext: { fontSize: 12, fontWeight: '600' as const, marginBottom: 2 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontSize: 13, flex: 1, paddingRight: 8 },
  resultValue: { fontSize: 14, fontWeight: '600' as const },
  bold: { fontWeight: '700' as const, fontSize: 15 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  disclaimer: { fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  disclaimerBanner: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  disclaimerBannerContent: { flex: 1, gap: 4 },
  disclaimerBannerTitle: { fontSize: 14, fontWeight: '700' as const, lineHeight: 19 },
  disclaimerBannerText: { fontSize: 12, lineHeight: 17 },
  lexBotSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 4,
  },
  lexBotSuggestionText: { flex: 1, fontSize: 12, fontWeight: '700' as const },
});
