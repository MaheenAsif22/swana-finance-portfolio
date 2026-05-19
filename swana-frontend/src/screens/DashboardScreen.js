import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as reportsApi from '../api/reports.api';
import * as txApi from '../api/transactions.api';
import { useAuthStore } from '../store/auth.store';
import { useTxStore } from '../store/tx.store';
import BalanceCard from '../components/BalanceCard';
import TxRow from '../components/TxRow';
import FAB from '../components/FAB';
import EmptyState from '../components/ui/EmptyState';
import { C, F, S, R } from '../utils/theme';
import { currency, today } from '../utils/format';

export default function DashboardScreen({ navigation }) {
  const user       = useAuthStore((s) => s.user);
  const logout     = useAuthStore((s) => s.logout);
  const pending    = useTxStore((s) => s.pending);
  const setPending = useTxStore((s) => s.setPending);

  const [daily,     setDaily]     = useState(null);
  const [recent,    setRecent]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [d, p, r] = await Promise.all([
        reportsApi.daily(today()),
        txApi.pending(),
        txApi.list({ limit: 10 }),
      ]);
      setDaily(d.data);
      setPending(p.data);
      setRecent(r.data.data);
    } catch (e) {
      console.warn(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isOwner = user?.role === 'owner';
  const hour    = new Date().getHours();
  const greet   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) return <View style={st.center}><ActivityIndicator size="large" color={C.primary} /></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={st.root}
        contentContainerStyle={st.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
      >
        {/* Header */}
        <View style={st.header}>
          <View>
            <Text style={st.greet}>{greet},</Text>
            <Text style={st.name}>{user?.name}</Text>
            <Text style={st.site}>{user?.site}</Text>
          </View>
          <TouchableOpacity style={st.avatar} onPress={logout}>
            <Text style={st.avatarTxt}>{user?.name?.[0]}</Text>
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <BalanceCard
          daily={daily}
          onPostBalance={() => navigation.navigate('PostBalance')}
        />

        {/* Pending banner */}
        {pending.length > 0 && (
          <View style={st.section}>
            <View style={st.sectionRow}>
              <Text style={st.sectionTitle}>⏳ Pending ({pending.length})</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Approvals')}>
                <Text style={st.sectionAction}>{isOwner ? 'Review all' : 'View'} →</Text>
              </TouchableOpacity>
            </View>
            {pending.slice(0, 3).map((tx) => (
              <TxRow key={tx.id} tx={tx} onPress={() => navigation.navigate('TxDetail', { id: tx.id })} />
            ))}
            {pending.length > 3 && (
              <TouchableOpacity onPress={() => navigation.navigate('Approvals')}>
                <Text style={st.more}>{pending.length - 3} more pending →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Metrics */}
        <View style={st.metricRow}>
          <View style={[st.metric, { marginRight: S.sm }]}>
            <Text style={st.metricLabel}>Transactions today</Text>
            <Text style={st.metricVal}>{daily?.transactions?.length ?? 0}</Text>
          </View>
          <View style={st.metric}>
            <Text style={st.metricLabel}>Pending amount</Text>
            <Text style={[st.metricVal, { color: C.warning }]}>{currency(daily?.pending_total ?? 0)}</Text>
          </View>
        </View>

        {/* Owner-only quick actions */}
        {isOwner && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Owner tools</Text>
            <View style={st.toolRow}>
              <TouchableOpacity style={[st.tool, { marginRight: S.sm }]} onPress={() => navigation.navigate('Import')}>
                <Text style={st.toolEmoji}>💬</Text>
                <Text style={st.toolTitle}>Import from WhatsApp</Text>
                <Text style={st.toolSub}>Upload a chat .txt and convert to transactions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.tool} onPress={() => navigation.navigate('Knowledge')}>
                <Text style={st.toolEmoji}>📒</Text>
                <Text style={st.toolTitle}>Payee dictionary</Text>
                <Text style={st.toolSub}>View and edit the canonical payee list</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recent */}
        <View style={st.section}>
          <View style={st.sectionRow}>
            <Text style={st.sectionTitle}>Recent transactions</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={st.sectionAction}>See all →</Text>
            </TouchableOpacity>
          </View>
          {recent.length === 0
            ? <EmptyState icon="📋" title="No transactions yet" subtitle="Tap + to add your first entry" />
            : recent.map((tx) => (
                <TxRow key={tx.id} tx={tx} onPress={() => navigation.navigate('TxDetail', { id: tx.id })} />
              ))
          }
        </View>
      </ScrollView>

      <FAB onPress={() => navigation.navigate('AddTx')} />
    </View>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: 140 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: S.lg },
  greet:     { fontSize: F.sm, color: C.textMuted },
  name:      { fontSize: F.lg, fontWeight: '700', color: C.text },
  site:      { fontSize: F.xs, color: C.textLight, marginTop: 2 },
  avatar:    { width: 44, height: 44, borderRadius: R.full, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: F.base, fontWeight: '700' },

  section:    { marginBottom: S.lg },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm },
  sectionTitle:  { fontSize: F.sm, fontWeight: '600', color: C.textMuted },
  sectionAction: { fontSize: F.sm, color: C.primary, fontWeight: '500' },
  more:       { fontSize: F.sm, color: C.primary, fontWeight: '500', textAlign: 'center', paddingVertical: S.sm },

  metricRow:  { flexDirection: 'row', marginBottom: S.lg },
  metric:     { flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: S.md },
  metricLabel:{ fontSize: F.xs, color: C.textMuted, marginBottom: 4 },
  metricVal:  { fontSize: F.xl, fontWeight: '600', color: C.text },

  toolRow:    { flexDirection: 'row' },
  tool:       { flex: 1, backgroundColor: C.white, borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: C.border },
  toolEmoji:  { fontSize: 22, marginBottom: 4 },
  toolTitle:  { fontSize: F.sm, fontWeight: '700', color: C.text, marginBottom: 2 },
  toolSub:    { fontSize: F.xs, color: C.textMuted, lineHeight: 16 },
});
