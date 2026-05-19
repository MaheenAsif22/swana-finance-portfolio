import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { create } from '../api/transactions.api';
import { list as listCats, payees as listPayees } from '../api/categories.api';
import { useTxStore } from '../store/tx.store';
import Input  from '../components/ui/Input';
import Button from '../components/ui/Button';
import { C, F, S, R } from '../utils/theme';
import { today } from '../utils/format';

const TX_TYPES = [
  { value: 'payment',    label: 'Payment',   note: 'Already paid' },
  { value: 'request',    label: 'Request',   note: 'Needs approval' },
  { value: 'receipt',    label: 'Receipt',   note: 'Money received' },
  { value: 'cheque_out', label: 'Cheque',    note: 'Cheque issued' },
];

const METHODS = ['cash', 'cheque', 'online', 'easypay', 'other'];

export default function AddTransactionScreen({ navigation }) {
  const addTx = useTxStore((s) => s.addTx);

  const [type,    setType]    = useState('payment');
  const [amount,  setAmount]  = useState('');
  const [desc,    setDesc]    = useState('');
  const [payee,   setPayee]   = useState('');
  const [method,  setMethod]  = useState('cash');
  const [catId,   setCatId]   = useState(null);
  const [notes,   setNotes]   = useState('');
  const [cats,    setCats]    = useState([]);
  const [payees,  setPayees]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [errs,    setErrs]    = useState({});

  useEffect(() => {
    listCats().then((r) => setCats(r.data)).catch(() => {});
    listPayees().then((r) => setPayees(r.data.map((p) => p.name))).catch(() => {});
  }, []);

  const filteredPayees = payee.length > 1
    ? payees.filter((p) => p.toLowerCase().includes(payee.toLowerCase()) && p !== payee).slice(0, 5)
    : [];

  function validate() {
    const e = {};
    if (!amount || isNaN(+amount) || +amount <= 0) e.amount = 'Enter a valid amount';
    if (!desc.trim()) e.desc = 'Description is required';
    setErrs(e);
    return !Object.keys(e).length;
  }

  async function submit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await create({
        type, amount: +amount, description: desc.trim(),
        payee: payee.trim() || null, payment_method: method,
        category_id: catId || null, notes: notes.trim() || null,
        date: today(),
      });
      addTx(data);
      const msg = type === 'request' ? 'Request submitted — awaiting approval.' : 'Transaction saved.';
      Alert.alert('Done', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={st.root} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">

        {/* Type selector */}
        <Text style={st.label}>Type</Text>
        <View style={st.typeGrid}>
          {TX_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[st.typeCard, type === t.value && st.typeCardOn]}
              onPress={() => setType(t.value)}
            >
              <Text style={[st.typeName, type === t.value && { color: C.primary }]}>{t.label}</Text>
              <Text style={st.typeNote}>{t.note}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount */}
        <Text style={st.label}>Amount</Text>
        <View style={st.amountRow}>
          <Text style={st.rupee}>₨</Text>
          <Input
            style={{ flex: 1, marginBottom: 0 }}
            inputStyle={st.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            error={errs.amount}
          />
        </View>

        {/* Description */}
        <Input label="Description *" value={desc} onChangeText={setDesc} placeholder="e.g. Petrol for motorcycle" error={errs.desc} />

        {/* Payee + autocomplete */}
        <Input label="Payee" value={payee} onChangeText={setPayee} placeholder="e.g. Abdul Quddus" />
        {filteredPayees.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.suggestions}>
            {filteredPayees.map((p) => (
              <TouchableOpacity key={p} style={st.suggChip} onPress={() => setPayee(p)}>
                <Text style={st.suggText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Method */}
        <Text style={st.label}>Method</Text>
        <View style={st.chips}>
          {METHODS.map((m) => (
            <TouchableOpacity key={m} style={[st.chip, method === m && st.chipOn]} onPress={() => setMethod(m)}>
              <Text style={[st.chipText, method === m && { color: C.primary }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category */}
        <Text style={st.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.catRow}>
          {cats.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[st.catChip, catId === c.id && { borderColor: c.color, borderWidth: 2 }]}
              onPress={() => setCatId(catId === c.id ? null : c.id)}
            >
              <View style={[st.catDot, { backgroundColor: c.color }]} />
              <Text style={st.catName}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Notes */}
        <Input
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any extra details…"
          multiline
          numberOfLines={3}
          inputStyle={{ height: 76, textAlignVertical: 'top' }}
        />

        <Button
          label={type === 'request' ? 'Submit Request' : 'Save Transaction'}
          onPress={submit}
          loading={loading}
          style={{ marginTop: S.sm }}
        />
        <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: S.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: S.lg, paddingBottom: 60 },
  label:   { fontSize: F.sm, fontWeight: '600', color: C.textMuted, marginBottom: S.sm, marginTop: S.sm },

  typeGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.lg },
  typeCard:   { flex: 1, minWidth: '45%', padding: S.md, borderRadius: R.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, alignItems: 'center' },
  typeCardOn: { borderColor: C.primary, backgroundColor: C.primaryBg },
  typeName:   { fontSize: F.sm, fontWeight: '600', color: C.textMuted },
  typeNote:   { fontSize: F.xs, color: C.textLight, marginTop: 2 },

  amountRow:   { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.lg },
  rupee:       { fontSize: 30, fontWeight: '300', color: C.textMuted },
  amountInput: { fontSize: 30, fontWeight: '500', borderWidth: 0, backgroundColor: 'transparent', height: 50 },

  suggestions: { marginTop: -S.md, marginBottom: S.md },
  suggChip:   { backgroundColor: C.primaryBg, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: 4, marginRight: 6 },
  suggText:   { fontSize: F.xs, color: C.primary, fontWeight: '500' },

  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: S.lg },
  chip:    { paddingHorizontal: S.md, paddingVertical: 6, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  chipOn:  { borderColor: C.primary, backgroundColor: C.primaryBg },
  chipText:{ fontSize: F.sm, color: C.textMuted, textTransform: 'capitalize' },

  catRow:  { marginBottom: S.lg },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.md, paddingVertical: 8, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, marginRight: 8 },
  catDot:  { width: 8, height: 8, borderRadius: R.full },
  catName: { fontSize: F.xs, color: C.text, fontWeight: '500' },
});
