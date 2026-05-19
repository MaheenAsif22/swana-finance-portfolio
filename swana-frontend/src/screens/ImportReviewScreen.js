import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Alert, Pressable, Platform,
} from 'react-native';
import { commit } from '../api/import.api';
import Button from '../components/ui/Button';
import { C, F, S, R, TYPE_LABEL } from '../utils/theme';
import { currency } from '../utils/format';

/**
 * Step 2 of the import flow:
 *   - Display every parsed transaction with its auto-resolved fields
 *   - Owner can tap a row to edit payee/category/type/skip-flag
 *   - Filter by "needs review" / duplicates / all
 *   - On commit, POST /api/import/commit with the (possibly edited) list
 *
 * State strategy:
 *   We keep the rows in local state (`rows`). Edits mutate a copy of the row;
 *   the original parser output isn't preserved — that's intentional. The owner
 *   is the final authority once they're on this screen.
 */

const FILTERS = [
  { key: 'all',          label: 'All' },
  { key: 'review',       label: 'Needs review' },
  { key: 'dupes',        label: 'Duplicates' },
];

export default function ImportReviewScreen({ navigation, route }) {
  const initial = route.params?.preview;
  if (!initial) {
    return (
      <View style={st.center}>
        <Text style={{ color: C.textMuted }}>No preview data. Go back and parse again.</Text>
      </View>
    );
  }

  const [rows,    setRows]    = useState(() => initial.transactions.map((t) => ({ ...t })));
  const [balances,setBalances]= useState(() => (initial.openingBalances || []).map((b) => ({ ...b })));
  const [filter,  setFilter]  = useState('all');
  const [editing, setEditing] = useState(null);   // index of row being edited, or null
  const [busy,    setBusy]    = useState(false);

  // Aggregate counts shown in the header
  const counts = useMemo(() => {
    let total = 0, included = 0, review = 0, dupes = 0;
    for (const r of rows) {
      total++;
      if (r.duplicate)     dupes++;
      else if (!r.skip)    included++;
      if (r.needsReview && !r.duplicate && !r.skip) review++;
    }
    return { total, included, review, dupes };
  }, [rows]);

  // Apply current filter
  const visible = useMemo(() => {
    if (filter === 'review') return rows.filter((r) => r.needsReview && !r.duplicate && !r.skip);
    if (filter === 'dupes')  return rows.filter((r) => r.duplicate);
    return rows;
  }, [rows, filter]);

  function updateRow(globalIdx, patch) {
    setRows((prev) => {
      const next = prev.slice();
      next[globalIdx] = { ...next[globalIdx], ...patch };
      return next;
    });
  }

  async function onCommit() {
    const toInsert = rows.filter((r) => !r.skip && !r.duplicate);
    if (toInsert.length === 0) {
      Alert.alert('Nothing to import', 'All rows are either skipped or duplicates.');
      return;
    }
    Alert.alert(
      `Commit ${toInsert.length} transactions?`,
      `${balances.filter((b) => !b.skip).length} opening balance rows will also be recorded. This writes to the database and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Commit', style: 'default', onPress: doCommit },
      ],
    );
  }

  async function doCommit() {
    setBusy(true);
    try {
      const { data } = await commit({
        batchId:         initial.batchId,
        sourceFile:      initial.sourceFile,
        transactions:    rows,
        openingBalances: balances,
      });
      Alert.alert(
        'Import complete',
        `Inserted ${data.inserted} transactions and ${data.balancesInserted} opening balances. ${data.skipped} skipped.`,
        [{ text: 'OK', onPress: () => navigation.popToTop() }],
      );
    } catch (e) {
      Alert.alert('Commit failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={st.root}>
      {/* Stats header */}
      <View style={st.stats}>
        <Stat label="Total"       value={counts.total} />
        <Stat label="Including"   value={counts.included} highlight={C.primary} />
        <Stat label="Need review" value={counts.review}   highlight={C.warning} />
        <Stat label="Duplicates"  value={counts.dupes}    highlight={C.textMuted} />
      </View>

      {/* Filter pills */}
      <View style={st.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[st.pill, filter === f.key && st.pillActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[st.pillTxt, filter === f.key && st.pillTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 140 }}
        data={visible}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => {
          const globalIdx = rows.indexOf(item);
          return <Row row={item} onPress={() => setEditing(globalIdx)} />;
        }}
        ListEmptyComponent={
          <View style={{ padding: S.xl, alignItems: 'center' }}>
            <Text style={{ color: C.textMuted }}>Nothing matches this filter.</Text>
          </View>
        }
      />

      {/* Commit bar */}
      <View style={st.commitBar}>
        <View style={{ flex: 1 }}>
          <Text style={st.commitCount}>{counts.included} ready to import</Text>
          {counts.review > 0 && (
            <Text style={st.commitReview}>{counts.review} flagged for review</Text>
          )}
        </View>
        <Button label="Commit" onPress={onCommit} loading={busy} style={{ paddingHorizontal: S.xl }} />
      </View>

      {/* Edit modal */}
      <EditModal
        visible={editing !== null}
        row={editing !== null ? rows[editing] : null}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          updateRow(editing, patch);
          setEditing(null);
        }}
        onToggleSkip={() => {
          updateRow(editing, { skip: !rows[editing].skip });
          setEditing(null);
        }}
      />
    </View>
  );
}

// ─── Row component ───────────────────────────────────────────────────────────
function Row({ row, onPress }) {
  const dim   = row.duplicate || row.skip;
  const flag  = row.needsReview && !row.duplicate && !row.skip;

  return (
    <Pressable onPress={onPress} style={[st.row, dim && { opacity: 0.4 }]}>
      <View style={st.rowLeft}>
        <Text style={st.amount}>{currency(row.amount)}</Text>
        <TypePill type={row.type} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={st.rowTop}>
          <Text style={st.payee} numberOfLines={1}>{row.payee || '(no payee)'}</Text>
          <Text style={st.date}>{row.date}</Text>
        </View>
        <Text style={st.desc} numberOfLines={1}>{row.description}</Text>
        <View style={st.tags}>
          {row.category    && <Tag label={row.category} />}
          {row.paymentMethod && <Tag label={row.paymentMethod} />}
          {row.duplicate    && <Tag label="duplicate" tone="muted" />}
          {row.skip         && <Tag label="skip" tone="muted" />}
          {flag             && <Tag label="needs review" tone="warning" />}
        </View>
      </View>
    </Pressable>
  );
}

function Tag({ label, tone = 'default' }) {
  const t = {
    default: { bg: C.surface,    fg: C.textMuted },
    muted:   { bg: '#EFEFEB',    fg: C.textLight },
    warning: { bg: C.warningBg,  fg: C.warning },
  }[tone];
  return (
    <View style={[st.tag, { backgroundColor: t.bg }]}>
      <Text style={[st.tagTxt, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

function TypePill({ type }) {
  const colors = {
    payment:    { bg: C.primaryBg, fg: C.primary },
    receipt:    { bg: C.successBg, fg: C.success },
    request:    { bg: C.warningBg, fg: C.warning },
    cheque_out: { bg: C.surface,   fg: C.textMuted },
    transfer:   { bg: C.surface,   fg: C.textMuted },
  };
  const c = colors[type] || colors.payment;
  return (
    <View style={[st.typePill, { backgroundColor: c.bg }]}>
      <Text style={[st.typePillTxt, { color: c.fg }]}>{TYPE_LABEL[type] || type}</Text>
    </View>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <View style={st.stat}>
      <Text style={[st.statVal, highlight && { color: highlight }]}>{value}</Text>
      <Text style={st.statLbl}>{label}</Text>
    </View>
  );
}

// ─── Edit modal ──────────────────────────────────────────────────────────────
const TYPES = ['payment', 'request', 'receipt', 'cheque_out', 'transfer'];
const METHODS = ['cash', 'cheque', 'online', 'easypay', 'other'];

function EditModal({ visible, row, onClose, onSave, onToggleSkip }) {
  const [payee,    setPayee]    = useState('');
  const [category, setCategory] = useState('');
  const [type,     setType]     = useState('payment');
  const [method,   setMethod]   = useState('');

  // Reset fields when a new row opens
  React.useEffect(() => {
    if (row) {
      setPayee(row.payee || '');
      setCategory(row.category || '');
      setType(row.type || 'payment');
      setMethod(row.paymentMethod || '');
    }
  }, [row]);

  if (!row) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={st.modal}>
        <Text style={st.modalH}>Edit transaction</Text>

        <View style={st.bodyBox}>
          <Text style={st.bodyTxt}>{row.description}</Text>
          <Text style={st.bodyMeta}>{row.date} {row.time} · {row.sender}</Text>
        </View>

        <Field label="Payee">
          <TextInput style={st.input} value={payee} onChangeText={setPayee} placeholder="Person or vendor" placeholderTextColor={C.textLight} />
        </Field>

        <Field label="Category">
          <TextInput style={st.input} value={category} onChangeText={setCategory} placeholder="e.g. Fuel, Food, Materials" placeholderTextColor={C.textLight} />
        </Field>

        <Field label="Type">
          <View style={st.chips}>
            {TYPES.map((t) => (
              <TouchableOpacity key={t} onPress={() => setType(t)} style={[st.chip, type === t && st.chipActive]}>
                <Text style={[st.chipTxt, type === t && st.chipTxtActive]}>{TYPE_LABEL[t] || t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Payment method">
          <View style={st.chips}>
            <TouchableOpacity onPress={() => setMethod('')} style={[st.chip, !method && st.chipActive]}>
              <Text style={[st.chipTxt, !method && st.chipTxtActive]}>—</Text>
            </TouchableOpacity>
            {METHODS.map((m) => (
              <TouchableOpacity key={m} onPress={() => setMethod(m)} style={[st.chip, method === m && st.chipActive]}>
                <Text style={[st.chipTxt, method === m && st.chipTxtActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Button
          label={row.skip ? 'Include this row' : 'Skip this row'}
          variant="ghost"
          onPress={onToggleSkip}
          style={{ marginTop: S.lg }}
        />

        <Button
          label="Save changes"
          onPress={() => onSave({
            payee:         payee.trim() || null,
            category:      category.trim() || null,
            type,
            paymentMethod: method || null,
          })}
          style={{ marginTop: S.sm }}
        />
        <Button label="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: S.xs }} />
      </ScrollView>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginTop: S.md }}>
      <Text style={st.fieldLbl}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.lg },

  stats:    { flexDirection: 'row', backgroundColor: C.white, paddingVertical: S.md, paddingHorizontal: S.lg, borderBottomWidth: 1, borderBottomColor: C.border },
  stat:     { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: F.lg, fontWeight: '700', color: C.text },
  statLbl:  { fontSize: F.xs, color: C.textMuted, marginTop: 2 },

  filters:    { flexDirection: 'row', gap: S.sm, padding: S.md, paddingBottom: S.sm },
  pill:       { paddingVertical: 6, paddingHorizontal: S.md, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  pillActive: { backgroundColor: C.primary, borderColor: C.primary },
  pillTxt:    { fontSize: F.sm, color: C.text },
  pillTxtActive:{ color: C.white, fontWeight: '600' },

  row:     { flexDirection: 'row', backgroundColor: C.white, padding: S.md, marginHorizontal: S.md, marginVertical: 4, borderRadius: R.md, gap: S.md },
  rowLeft: { alignItems: 'flex-start', minWidth: 90 },
  amount:  { fontSize: F.base, fontWeight: '700', color: C.text, marginBottom: 4 },
  rowTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payee:   { fontSize: F.sm, fontWeight: '600', color: C.text, flex: 1 },
  date:    { fontSize: F.xs, color: C.textLight, marginLeft: S.sm },
  desc:    { fontSize: F.xs, color: C.textMuted, marginTop: 2 },
  tags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: S.xs },
  tag:     { paddingHorizontal: S.sm, paddingVertical: 2, borderRadius: R.full },
  tagTxt:  { fontSize: 10, fontWeight: '500' },

  typePill:    { paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.full, alignSelf: 'flex-start' },
  typePillTxt: { fontSize: 10, fontWeight: '700' },

  commitBar:   { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, padding: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md },
  commitCount: { fontSize: F.sm, fontWeight: '600', color: C.text },
  commitReview:{ fontSize: F.xs, color: C.warning, marginTop: 2 },

  modal:     { padding: S.xl, backgroundColor: C.bg, flexGrow: 1 },
  modalH:    { fontSize: F.lg, fontWeight: '700', color: C.text, marginBottom: S.md },
  bodyBox:   { backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md },
  bodyTxt:   { fontSize: F.sm, color: C.text, lineHeight: 20 },
  bodyMeta:  { fontSize: F.xs, color: C.textMuted, marginTop: 4 },
  fieldLbl:  { fontSize: F.xs, color: C.textMuted, marginBottom: 4, fontWeight: '500' },
  input:     { backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: S.md, fontSize: F.sm, color: C.text },
  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:      { paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.full, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  chipActive:{ backgroundColor: C.primary, borderColor: C.primary },
  chipTxt:   { fontSize: F.xs, color: C.text },
  chipTxtActive:{ color: C.white, fontWeight: '600' },
});
