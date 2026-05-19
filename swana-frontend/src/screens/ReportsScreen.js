import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { summary } from '../api/reports.api';
import Card from '../components/ui/Card';
import { C, F, S, R } from '../utils/theme';
import { currency, today, daysAgo } from '../utils/format';

const PERIODS = [
  { label: 'Today',   from: today(),     to: today()   },
  { label: '7 days',  from: daysAgo(7),  to: today()   },
  { label: '30 days', from: daysAgo(30), to: today()   },
  { label: '90 days', from: daysAgo(90), to: today()   },
];

export default function ReportsScreen() {
  const [period,    setPeriod]    = useState(PERIODS[1]);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { const r = await summary(period.from, period.to); setData(r.data); }
    catch (e) { console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [period]));

  if (loading) return <View style={st.center}><ActivityIndicator size="large" color={C.primary} /></View>;

  const t       = data?.totals || {};
  const cats    = data?.by_category || [];
  const payees  = data?.top_payees  || [];
  const maxCat  = cats[0]?.total || 1;
  const total   = (t.total_in || 0) + (t.total_out || 0) || 1;
  const inPct   = Math.round(((t.total_in  || 0) / total) * 100);
  const outPct  = 100 - inPct;

  return (
    <ScrollView
      style={st.root}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.primary} />}
    >
      {/* Period selector */}
      <View style={st.periods}>
        {PERIODS.map((p) => (
          <TouchableOpacity key={p.label} style={[st.periodChip, period.label === p.label && st.periodOn]} onPress={() => setPeriod(p)}>
            <Text style={[st.periodTxt, period.label === p.label && { color: C.primary }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Metric grid */}
      <View style={st.grid}>
        <Metric label="Total In"      value={currency(t.total_in  || 0)} color={C.success} />
        <Metric label="Total Out"     value={currency(t.total_out || 0)} color={C.danger}  />
      </View>
      <View style={[st.grid, { marginBottom: S.lg }]}>
        <Metric label="Transactions"  value={String(t.tx_count || 0)} />
        <Metric label="Pending"       value={currency(t.total_pending || 0)} color={C.warning} />
      </View>

      {/* Cash flow bar */}
      {(t.total_in > 0 || t.total_out > 0) && (
        <Card style={{ marginBottom: S.lg }}>
          <Text style={st.cardHead}>Cash flow</Text>
          <View style={st.flowBar}>
            <View style={[st.flowIn,  { flex: inPct  }]} />
            <View style={[st.flowOut, { flex: outPct }]} />
          </View>
          <View style={st.flowLegend}>
            <LegendDot color={C.success} label={`In ${inPct}%  (${currency(t.total_in || 0)})`} />
            <LegendDot color={C.danger}  label={`Out ${outPct}% (${currency(t.total_out || 0)})`} />
          </View>
        </Card>
      )}

      {/* By category */}
      {cats.length > 0 && (
        <Card style={{ marginBottom: S.lg }}>
          <Text style={st.cardHead}>Spending by category</Text>
          {cats.map((c) => (
            <View key={c.name || 'unknown'} style={st.catRow}>
              <View style={st.catLeft}>
                <View style={[st.catDot, { backgroundColor: c.color || '#aaa' }]} />
                <Text style={st.catName}>{c.name || 'Uncategorized'}</Text>
              </View>
              <View style={st.catBarBg}>
                <View style={[st.catBar, { width: `${(c.total / maxCat) * 100}%`, backgroundColor: c.color || '#aaa' }]} />
              </View>
              <Text style={st.catAmt}>{currency(c.total)}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Top payees */}
      {payees.length > 0 && (
        <Card>
          <Text style={st.cardHead}>Top payees</Text>
          {payees.slice(0, 8).map((p, i) => (
            <View key={p.payee || i} style={st.payeeRow}>
              <Text style={st.payeeRank}>{i + 1}</Text>
              <Text style={st.payeeName}>{p.payee}</Text>
              <Text style={st.payeeAmt}>{currency(p.total)}</Text>
              <Text style={st.payeeCount}>{p.count}×</Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function Metric({ label, value, color }) {
  return (
    <View style={st.metric}>
      <Text style={st.metricLabel}>{label}</Text>
      <Text style={[st.metricVal, color && { color }]}>{value}</Text>
    </View>
  );
}

function LegendDot({ color, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={[st.legendDot, { backgroundColor: color }]} />
      <Text style={st.legendTxt}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: 60 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  periods:    { flexDirection: 'row', gap: S.sm, marginBottom: S.lg, flexWrap: 'wrap' },
  periodChip: { paddingHorizontal: S.md, paddingVertical: 6, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  periodOn:   { borderColor: C.primary, backgroundColor: C.primaryBg },
  periodTxt:  { fontSize: F.sm, color: C.textMuted, fontWeight: '500' },

  grid:       { flexDirection: 'row', gap: S.sm, marginBottom: S.sm },
  metric:     { flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: S.md },
  metricLabel:{ fontSize: F.xs, color: C.textMuted, marginBottom: 4 },
  metricVal:  { fontSize: F.xl, fontWeight: '600', color: C.text },

  cardHead: { fontSize: F.sm, fontWeight: '600', color: C.textMuted, marginBottom: S.md },

  flowBar:    { flexDirection: 'row', height: 12, borderRadius: R.full, overflow: 'hidden', marginBottom: S.sm },
  flowIn:     { backgroundColor: C.success },
  flowOut:    { backgroundColor: C.danger },
  flowLegend: { flexDirection: 'row', gap: S.lg },
  legendDot:  { width: 8, height: 8, borderRadius: R.full },
  legendTxt:  { fontSize: F.xs, color: C.textMuted },

  catRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: S.sm, gap: S.sm },
  catLeft: { flexDirection: 'row', alignItems: 'center', width: 130, gap: 6 },
  catDot:  { width: 8, height: 8, borderRadius: R.full },
  catName: { fontSize: F.xs, color: C.text, flex: 1 },
  catBarBg:{ flex: 1, height: 6, backgroundColor: C.surface, borderRadius: 3, overflow: 'hidden' },
  catBar:  { height: '100%', borderRadius: 3 },
  catAmt:  { fontSize: F.xs, color: C.textMuted, fontWeight: '600', width: 72, textAlign: 'right' },

  payeeRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: S.sm, gap: S.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  payeeRank:  { fontSize: F.xs, color: C.textLight, fontWeight: '700', width: 16 },
  payeeName:  { flex: 1, fontSize: F.sm, color: C.text },
  payeeAmt:   { fontSize: F.sm, fontWeight: '600', color: C.text },
  payeeCount: { fontSize: F.xs, color: C.textLight, width: 28, textAlign: 'right' },
});
