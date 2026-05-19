import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as txApi from '../api/transactions.api';
import { useAuthStore } from '../store/auth.store';
import { useTxStore }   from '../store/tx.store';
import Badge  from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { C, F, S, R, TYPE_LABEL } from '../utils/theme';
import { currency, dateStr, timeStr } from '../utils/format';

export default function TxDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const user     = useAuthStore((s) => s.user);
  const updateTx = useTxStore((s) => s.updateTx);
  const [tx,      setTx]      = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false);

  useEffect(() => {
    txApi.getOne(id)
      .then((r) => setTx(r.data))
      .catch((e) => { Alert.alert('Error', e.message); navigation.goBack(); })
      .finally(() => setLoading(false));
  }, [id]);

  async function doApprove() {
    setActing(true);
    try   { const { data } = await txApi.approve(id); updateTx(data); setTx(data); }
    catch (e) { Alert.alert('Error', e.message); }
    finally   { setActing(false); }
  }

  async function doReject() {
    const run = async (reason) => {
      setActing(true);
      try   { const { data } = await txApi.reject(id, reason); updateTx(data); setTx(data); }
      catch (e) { Alert.alert('Error', e.message); }
      finally   { setActing(false); }
    };
    // Alert.prompt only exists on iOS; fall back on Android/web
    if (Alert.prompt) {
      Alert.prompt('Reject', 'Reason (optional):', run, 'plain-text');
    } else {
      Alert.alert('Reject request', 'Confirm rejection?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => run(null) },
      ]);
    }
  }

  if (loading) return <View style={st.center}><ActivityIndicator size="large" color={C.primary} /></View>;
  if (!tx)     return null;

  const isOut    = ['payment', 'cheque_out'].includes(tx.type);
  const isIn     = tx.type === 'receipt';
  const amtColor = isOut ? C.danger : isIn ? C.success : C.warning;
  const prefix   = isOut ? '−' : isIn ? '+' : '';

  return (
    <ScrollView style={st.root} contentContainerStyle={st.content}>
      <View style={st.hero}>
        <Text style={st.heroType}>{TYPE_LABEL[tx.type] || tx.type}</Text>
        <Text style={[st.heroAmt, { color: amtColor }]}>{prefix}{currency(tx.amount)}</Text>
        <Badge status={tx.status} />
      </View>

      <View style={st.card}>
        <Row label="Description"  value={tx.description} />
        {tx.payee          && <><Sep /><Row label="Payee"        value={tx.payee} /></>}
        {tx.category_name  && (
          <><Sep />
          <View style={st.row}>
            <Text style={st.rowLabel}>Category</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[st.dot, { backgroundColor: tx.category_color || '#aaa' }]} />
              <Text style={st.rowVal}>{tx.category_name}</Text>
            </View>
          </View></>
        )}
        {tx.payment_method && <><Sep /><Row label="Method"       value={tx.payment_method} /></>}
        {tx.ref_number     && <><Sep /><Row label="Reference"    value={tx.ref_number} /></>}
        <Sep /><Row label="Date"           value={dateStr(tx.date)} />
        <Sep /><Row label="Recorded by"    value={tx.created_by_name} />
        <Sep /><Row label="Recorded at"    value={timeStr(tx.created_at)} />
        {tx.approved_by_name && (
          <><Sep />
          <Row label="Approved by"  value={tx.approved_by_name} />
          <Row label="Approved at"  value={timeStr(tx.approved_at)} /></>
        )}
        {tx.reject_reason  && <><Sep /><Row label="Reject reason" value={tx.reject_reason} /></>}
        {tx.notes          && <><Sep /><Row label="Notes"         value={tx.notes} /></>}
      </View>

      {tx.status === 'pending' && user?.role === 'owner' && (
        <View style={st.actions}>
          <Button label="✕ Reject"  variant="danger"   onPress={doReject}  loading={acting} style={{ flex: 1 }} />
          <Button label="✓ Approve" variant="success"  onPress={doApprove} loading={acting} style={{ flex: 1.5, marginLeft: 8 }} />
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={st.rowVal}>{value}</Text>
    </View>
  );
}
function Sep() { return <View style={st.sep} />; }

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: 60 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero:     { alignItems: 'center', paddingVertical: S.xxl, gap: S.sm },
  heroType: { fontSize: F.sm, color: C.textMuted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1 },
  heroAmt:  { fontSize: 40, fontWeight: '700' },
  card:     { backgroundColor: C.white, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: S.lg, marginBottom: S.lg },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: S.sm },
  rowLabel: { fontSize: F.sm, color: C.textMuted, flex: 1 },
  rowVal:   { fontSize: F.sm, color: C.text, fontWeight: '500', flex: 2, textAlign: 'right' },
  sep:      { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  dot:      { width: 8, height: 8, borderRadius: R.full },
  actions:  { flexDirection: 'row' },
});
