import React, { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { list } from '../api/transactions.api';
import TxRow     from '../components/TxRow';
import EmptyState from '../components/ui/EmptyState';
import { C, F, S, R } from '../utils/theme';
import { today, daysAgo } from '../utils/format';

const DATE_F = [
  { label: 'Today',     val: today() },
  { label: 'Yesterday', val: daysAgo(1) },
  { label: '7 days',    val: null },
];

const STATUS_F = [
  { label: 'All',      val: null },
  { label: 'Pending',  val: 'pending' },
  { label: 'Paid',     val: 'paid' },
  { label: 'Approved', val: 'approved' },
  { label: 'Rejected', val: 'rejected' },
];

export default function HistoryScreen({ navigation }) {
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateF,      setDateF]      = useState(today());
  const [statusF,    setStatusF]    = useState(null);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);

  const load = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    if (reset) setLoading(true);
    try {
      const params = { page: p, limit: 30 };
      if (dateF)   params.date   = dateF;
      if (statusF) params.status = statusF;
      const { data } = await list(params);
      setRows(reset ? data.data : (prev) => [...prev, ...data.data]);
      setHasMore(data.data.length === 30);
      setPage(reset ? 2 : p + 1);
    } catch (e) { console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [dateF, statusF, page]);

  useFocusEffect(useCallback(() => { load(true); }, [dateF, statusF]));

  const Chip = ({ label, active, onPress }) => (
    <TouchableOpacity style={[st.chip, active && st.chipOn]} onPress={onPress}>
      <Text style={[st.chipTxt, active && { color: C.primary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={st.filters}>
        {DATE_F.map((f) => <Chip key={f.label} label={f.label} active={dateF === f.val} onPress={() => { setDateF(f.val); setPage(1); }} />)}
      </View>
      <View style={[st.filters, st.filtersBot]}>
        {STATUS_F.map((f) => <Chip key={f.label} label={f.label} active={statusF === f.val} onPress={() => { setStatusF(f.val); setPage(1); }} />)}
      </View>

      {loading
        ? <View style={st.center}><ActivityIndicator size="large" color={C.primary} /></View>
        : (
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: S.lg }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
            ListEmptyComponent={<EmptyState icon="📋" title="No transactions" subtitle="Try a different filter." />}
            onEndReached={() => { if (hasMore && !loading) load(); }}
            onEndReachedThreshold={0.3}
            renderItem={({ item }) => (
              <TxRow tx={item} onPress={() => navigation.navigate('TxDetail', { id: item.id })} />
            )}
          />
        )
      }
    </View>
  );
}

const st = StyleSheet.create({
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filters:    { flexDirection: 'row', backgroundColor: C.white, paddingHorizontal: S.md, paddingVertical: S.sm, gap: S.sm, flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  filtersBot: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  chip:       { paddingHorizontal: S.md, paddingVertical: 5, borderRadius: R.full, borderWidth: 1, borderColor: C.border },
  chipOn:     { borderColor: C.primary, backgroundColor: C.primaryBg },
  chipTxt:    { fontSize: F.xs, color: C.textMuted, fontWeight: '500' },
});
