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
import { useColors } from '@/hooks/useColors';

function formatRp(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

// ─── Pesangon Calculator ─────────────────────────────────────────────────────
function KalkulatorPesangon() {
  const colors = useColors();
  const [gajiStr, setGajiStr] = useState('');
  const [tahunStr, setTahunStr] = useState('');
  const [result, setResult] = useState<{ pesangon: number; penghargaan: number; total: number } | null>(null);

  function calculate() {
    const gaji = parseFloat(gajiStr.replace(/[^\d.]/g, ''));
    const tahun = parseFloat(tahunStr);
    if (!gaji || !tahun || tahun < 0) return;

    // Pesangon per PP 35/2021
    let koefPesangon = 0;
    if (tahun < 1) koefPesangon = 1;
    else if (tahun < 2) koefPesangon = 2;
    else if (tahun < 3) koefPesangon = 3;
    else if (tahun < 4) koefPesangon = 4;
    else if (tahun < 5) koefPesangon = 5;
    else if (tahun < 6) koefPesangon = 6;
    else if (tahun < 7) koefPesangon = 7;
    else if (tahun < 8) koefPesangon = 8;
    else koefPesangon = 9;

    // Penghargaan masa kerja
    let koefPenghargaan = 0;
    if (tahun >= 3 && tahun < 6) koefPenghargaan = 2;
    else if (tahun >= 6 && tahun < 9) koefPenghargaan = 3;
    else if (tahun >= 9 && tahun < 12) koefPenghargaan = 4;
    else if (tahun >= 12 && tahun < 15) koefPenghargaan = 5;
    else if (tahun >= 15 && tahun < 18) koefPenghargaan = 6;
    else if (tahun >= 18 && tahun < 21) koefPenghargaan = 7;
    else if (tahun >= 21 && tahun < 24) koefPenghargaan = 8;
    else if (tahun >= 24) koefPenghargaan = 10;

    const pesangon = gaji * koefPesangon;
    const penghargaan = gaji * koefPenghargaan;
    setResult({ pesangon, penghargaan, total: pesangon + penghargaan });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={[styles.calcCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.calcColorBar, { backgroundColor: '#10b981' }]} />
      <View style={styles.calcInner}>
        <Text style={[styles.calcTitle, { color: colors.foreground }]}>Kalkulator Pesangon</Text>
        <Text style={[styles.calcSub, { color: colors.mutedForeground }]}>
          PP 35/2021 — PHK oleh perusahaan
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
            <ResultRow label="Pesangon" value={formatRp(result.pesangon)} color={colors.foreground} muted={colors.mutedForeground} />
            <ResultRow label="Penghargaan Masa Kerja" value={formatRp(result.penghargaan)} color={colors.foreground} muted={colors.mutedForeground} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ResultRow label="Total Estimasi" value={formatRp(result.total)} color='#10b981' muted={colors.mutedForeground} bold />
            <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
              * Belum termasuk uang penggantian hak (cuti, perumahan, dll). Konsultasikan dengan pengacara.
            </Text>
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
  const [npoptkpStr, setNpoptkpStr] = useState('80000000');
  const [result, setResult] = useState<number | null>(null);

  function calculate() {
    const njop = parseFloat(njopStr.replace(/[^\d.]/g, ''));
    const npoptkp = parseFloat(npoptkpStr.replace(/[^\d.]/g, '')) || 80_000_000;
    if (!njop) return;
    const kena = Math.max(0, njop - npoptkp);
    setResult(kena * 0.05);
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
          <Text style={[styles.label, { color: colors.mutedForeground }]}>NPOPTKP (Rp, default Rp 80 jt)</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            placeholder="80000000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={npoptkpStr}
            onChangeText={setNpoptkpStr}
          />
        </View>
        <Pressable
          onPress={calculate}
          style={({ pressed }) => [styles.calcBtn, { backgroundColor: '#f59e0b', opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[styles.calcBtnText, { color: '#000' }]}>Hitung</Text>
        </Pressable>
        {result !== null && (
          <View style={[styles.resultBox, { backgroundColor: colors.muted }]}>
            <ResultRow label="BPHTB Terutang (5%)" value={formatRp(result)} color='#f59e0b' muted={colors.mutedForeground} bold />
            <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
              * NPOPTKP dapat berbeda per daerah. Verifikasi di BPKAD setempat.
            </Text>
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
          </View>
        )}
      </View>
    </View>
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
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontSize: 13, flex: 1, paddingRight: 8 },
  resultValue: { fontSize: 14, fontWeight: '600' as const },
  bold: { fontWeight: '700' as const, fontSize: 15 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  disclaimer: { fontSize: 11, fontStyle: 'italic', marginTop: 4 },
});
