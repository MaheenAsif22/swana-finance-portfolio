import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, StyleSheet, RefreshControl, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as txApi from '../api/transactions.api';
import { useAuthStore } from '../store/auth.store';
import { useTxStore } from '../store/tx.store';
import Button    from '../components/ui/Button';
import Badge     from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { C, F, S, R } from '../utils/theme';
import { currency, dateStr, timeStr } from '../utils/format';

export default function ApprovalsScreen({ navigation }) {
  const user       = useAuthStore((s) => s.user);
  const pending    = useTxStore((s) => s.pending);
  const setPending = useTxStore((s) => s.setPending);
  const updateTx   = useTxStore((s) => s.updateTx);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actId,      setActId]      = useState(null);
  const [rejectTx,   setRejectTx]   = useState(null);
  const [reason,     setReason]     = useState('');

  const isOwner = user?.role === 'owner';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { const { data } = await txApi.pending(); setPending(data); }
    catch (e) { console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function doApprove(tx) {
    setActId(tx.id);
    try { const { data } = await txApi.approve(tx.id); updateTx(data); }
    catch (e) { Alert.alert('Error', e.message); }
    finally { setActId(null); }
  }

  async function doReject() {
    if (!rejectTx) return;
    setActId(rejectTx.id);
    try {
      const { data } = await txApi.reject(rejectTx.id, reason);
      updateTx(data);
      setRejectTx(null); setReason('');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setActId(null); }
  }

  async function approveAll() {
    Alert.alert(`Approve all ${pending.length}?`, 'This will approve every pending request.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve All', onPress: async () => {
          const ids = pending.map((t) => t.id);
          try { const { data } = await txApi.bulkApprove(ids); data.transactions.forEach(updateTx); }
          catch (e) { Alert.alert('Error', e.message); }
        }},
    ]);
  }

  if (loading) return <View style={st.center}><ActivityIndicator size="large" color={C.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* Reject modal */}
      {rejectTx && (
        <View style={st.overlay}>
          <View style={st.modal}>
            <Text style={st.modalTitle}>Reject request</Text>
            <Text style={st.modalDesc}>{rejectTx.description} · {currency(rejectTx.amount)}</Text>
            <TextInput
              style={st.rejectInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (optional)"
              placeholderTextColor={C.textLight}
              multiline
            />
            <View style={st.modalBtns}>
              <Button label="Cancel" variant="secondary" onPress={() => { setRejectTx(null); setReason(''); }} style={{ flex: 1 }} />
              <Button label="Reject" variant="danger"    onPress={doReject} loading={!!actId} style={{ flex: 1, marginLeft: S.sm }} />
            </View>
          </View>
        </View>
      )}

      {pending.length === 0
        ? <EmptyState icon="✅" title="All clear!" subtitle="No pending requests right now." />
        : (
          <>
            {isOwner && pending.length > 1 && (
              <TouchableOpacity style={st.approveAll} onPress={approveAll}>
                <Text style={st.approveAllTxt}>✓ Approve all {pending.length}</Text>
              </TouchableOpacity>
            )}
            <FlatList
              data={pending}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ padding: S.lg }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
              renderItem={({ item }) => (
                <View style={st.card}>
                  <View style={st.cardTop}>
                    <View style={[st.dot, { backgroundColor: item.category_color || C.border }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.cardDesc}>{item.description}</Text>
                      <Text style={st.cardMeta}>
                        {[item.payee, item.category_name, item.created_by_name].filter(Boolean).join(' · ')}
                      </Text>
                      <Text style={st.cardTime}>{dateStr(item.date)} · {timeStr(item.created_at)}</Text>
                    </View>
                    <Text style={st.cardAmt}>{currency(item.amount)}</Text>
                  </View>

                  {item.payment_method && (
                    <View style={st.methodBadge}>
                      <Text style={st.methodTxt}>{item.payment_method.toUpperCase()}</Text>
                    </View>
                  )}

                  {isOwner ? (
                    <View style={st.actions}>
                      <TouchableOpacity style={st.rejectBtn} onPress={() => setRejectTx(item)} disabled={!!actId}>
                        <Text style={st.rejectBtnTxt}>✕ Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={st.approveBtn} onPress={() => doApprove(item)} disabled={!!actId}>
                        {actId === item.id
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={st.approveBtnTxt}>✓ Approve</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ marginTop: S.sm }}><Badge status="pending" /></View>
                  )}
                </View>
              )}
            />
          </>
        )
      }
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  approveAll:    { margin: S.lg, marginBottom: 0, backgroundColor: C.success, borderRadius: R.md, padding: S.md, alignItems: 'center' },
  approveAllTxt: { color: '#fff', fontWeight: '700', fontSize: F.base },

  card:     { backgroundColor: C.white, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: S.lg, marginBottom: S.sm },
  cardTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, marginBottom: S.sm },
  dot:      { width: 10, height: 10, borderRadius: R.full, marginTop: 4 },
  cardDesc: { fontSize: F.base, fontWeight: '600', color: C.text },
  cardMeta: { fontSize: F.xs, color: C.textMuted, marginTop: 2 },
  cardTime: { fontSize: F.xs, color: C.textLight, marginTop: 1 },
  cardAmt:  { fontSize: F.lg, fontWeight: '700', color: C.warning },
  methodBadge: { alignSelf: 'flex-start', backgroundColor: C.surface, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 2, marginBottom: S.sm },
  methodTxt:   { fontSize: F.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.4 },

  actions:       { flexDirection: 'row', gap: S.sm, marginTop: S.sm },
  rejectBtn:     { flex: 1, borderRadius: R.md, borderWidth: 1, borderColor: C.danger, padding: S.sm, alignItems: 'center' },
  rejectBtnTxt:  { color: C.danger, fontWeight: '600', fontSize: F.sm },
  approveBtn:    { flex: 2, borderRadius: R.md, backgroundColor: C.success, padding: S.sm, alignItems: 'center' },
  approveBtnTxt: { color: '#fff', fontWeight: '700', fontSize: F.sm },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center', padding: S.xl, zIndex: 99 },
  modal:      { backgroundColor: C.white, borderRadius: R.xl, padding: S.xl, width: '100%' },
  modalTitle: { fontSize: F.md, fontWeight: '700', color: C.text, marginBottom: 4 },
  modalDesc:  { fontSize: F.sm, color: C.textMuted, marginBottom: S.md },
  rejectInput:{ borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: S.md, fontSize: F.sm, color: C.text, height: 80, textAlignVertical: 'top', marginBottom: S.md },
  modalBtns:  { flexDirection: 'row' },
});
