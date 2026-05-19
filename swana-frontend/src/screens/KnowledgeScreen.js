import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { getKnowledge, savePayees } from '../api/import.api';
import Button from '../components/ui/Button';
import { C, F, S, R } from '../utils/theme';

/**
 * Knowledge editor — manages the canonical payee list that powers the importer.
 *
 * Why this screen exists:
 *   The analyzer auto-clusters ~336 payees from 5 years of history. The
 *   clustering is mostly right (Quddos/Quddus/Qudoos all together) but
 *   sometimes wrongly merges distinct people (Shahid/Shahan share too many
 *   letters). Owner can fix here:
 *     - Rename the canonical (typo fixes)
 *     - Split a cluster (move some aliases to a new cluster)
 *     - Delete a junk cluster
 */
export default function KnowledgeScreen() {
  const [loading, setLoading] = useState(true);
  const [payees,  setPayees]  = useState([]);
  const [query,   setQuery]   = useState('');
  const [editing, setEditing] = useState(null);    // cluster index being edited
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getKnowledge();
        setPayees(data.payees || []);
      } catch (e) {
        Alert.alert('Error', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!query) return payees;
    const q = query.toLowerCase();
    return payees.filter((p) =>
      p.canonical.toLowerCase().includes(q) ||
      p.aliases.some((a) => a.toLowerCase().includes(q))
    );
  }, [payees, query]);

  function mutate(globalIdx, patch) {
    setPayees((prev) => {
      const next = prev.slice();
      next[globalIdx] = { ...next[globalIdx], ...patch };
      return next;
    });
    setDirty(true);
  }

  function deleteCluster(globalIdx) {
    setPayees((prev) => prev.filter((_, i) => i !== globalIdx));
    setDirty(true);
    setEditing(null);
  }

  function splitOut(globalIdx, aliasIdx) {
    setPayees((prev) => {
      const next = prev.map((p) => ({ ...p, aliases: [...p.aliases] }));
      const cluster = next[globalIdx];
      const moved   = cluster.aliases.splice(aliasIdx, 1)[0];
      if (!moved) return prev;
      // Pro-rated frequency: split estimate. Better than nothing.
      const frac = Math.max(1, Math.round(cluster.frequency / (cluster.aliases.length + 1)));
      cluster.frequency = Math.max(1, cluster.frequency - frac);
      next.push({ canonical: moved, aliases: [moved], frequency: frac });
      return next;
    });
    setDirty(true);
  }

  async function persist() {
    setSaving(true);
    try {
      await savePayees(payees);
      setDirty(false);
      Alert.alert('Saved', `${payees.length} payee clusters saved. Future imports will use this.`);
    } catch (e) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={st.center}><ActivityIndicator size="large" color={C.primary} /></View>;

  return (
    <View style={st.root}>
      <View style={st.header}>
        <Text style={st.h1}>Payee dictionary</Text>
        <Text style={st.sub}>{payees.length} canonical names · {payees.reduce((s, p) => s + p.aliases.length, 0)} aliases</Text>
        <TextInput
          style={st.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search payees or aliases…"
          placeholderTextColor={C.textLight}
        />
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item, idx) => `${item.canonical}:${idx}`}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => {
          const globalIdx = payees.indexOf(item);
          return (
            <TouchableOpacity style={st.row} onPress={() => setEditing(globalIdx)}>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{item.canonical}</Text>
                <Text style={st.aliases} numberOfLines={1}>
                  {item.aliases.length} variant{item.aliases.length === 1 ? '' : 's'}: {item.aliases.slice(0, 4).join(', ')}{item.aliases.length > 4 ? '…' : ''}
                </Text>
              </View>
              <Text style={st.freq}>×{item.frequency}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{ padding: S.xl, alignItems: 'center' }}>
            <Text style={{ color: C.textMuted }}>No payees match "{query}"</Text>
          </View>
        }
      />

      {dirty && (
        <View style={st.saveBar}>
          <Text style={st.dirtyTxt}>Unsaved changes</Text>
          <Button label="Save changes" onPress={persist} loading={saving} />
        </View>
      )}

      <ClusterEditor
        visible={editing !== null}
        cluster={editing !== null ? payees[editing] : null}
        onClose={() => setEditing(null)}
        onSave={(patch)    => { mutate(editing, patch); setEditing(null); }}
        onDelete={()       => deleteCluster(editing)}
        onSplit={(aliasIdx)=> splitOut(editing, aliasIdx)}
      />
    </View>
  );
}

// ─── Edit one cluster ────────────────────────────────────────────────────────
function ClusterEditor({ visible, cluster, onClose, onSave, onDelete, onSplit }) {
  const [name, setName] = useState('');

  useEffect(() => { if (cluster) setName(cluster.canonical); }, [cluster]);
  if (!cluster) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={st.modal}>
        <Text style={st.modalH}>Edit payee</Text>

        <Text style={st.fieldLbl}>Canonical name</Text>
        <TextInput style={st.input} value={name} onChangeText={setName} />

        <Text style={[st.fieldLbl, { marginTop: S.lg }]}>
          Spelling variants ({cluster.aliases.length}) — tap × to move out into its own cluster
        </Text>

        {cluster.aliases.map((a, idx) => (
          <View key={`${a}-${idx}`} style={st.aliasRow}>
            <Text style={st.aliasName}>{a}</Text>
            {cluster.aliases.length > 1 && (
              <TouchableOpacity onPress={() => onSplit(idx)}>
                <Text style={st.splitBtn}>× split out</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Button
          label="Save changes"
          onPress={() => onSave({ canonical: name.trim() || cluster.canonical })}
          style={{ marginTop: S.xl }}
        />
        <Button
          label="Delete this cluster"
          variant="ghost"
          onPress={() => Alert.alert(
            'Delete cluster?',
            `All ${cluster.aliases.length} variants will be removed from the dictionary. New imports won't recognize these names automatically.`,
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }],
          )}
          style={{ marginTop: S.sm }}
        />
        <Button label="Close" variant="ghost" onPress={onClose} style={{ marginTop: S.xs }} />
      </ScrollView>
    </Modal>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:  { padding: S.lg, paddingBottom: S.md, backgroundColor: C.bg },
  h1:      { fontSize: F.xl, fontWeight: '700', color: C.text },
  sub:     { fontSize: F.sm, color: C.textMuted, marginTop: 2, marginBottom: S.md },
  search:  { backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: S.md, fontSize: F.sm, color: C.text },

  row:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, padding: S.md, marginHorizontal: S.md, marginVertical: 4, borderRadius: R.md, gap: S.md },
  name:    { fontSize: F.base, fontWeight: '600', color: C.text },
  aliases: { fontSize: F.xs, color: C.textMuted, marginTop: 2 },
  freq:    { fontSize: F.sm, color: C.primary, fontWeight: '600' },

  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.warningBg, padding: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md, borderTopWidth: 1, borderTopColor: C.warning },
  dirtyTxt:{ flex: 1, fontSize: F.sm, color: C.warning, fontWeight: '600' },

  modal:    { padding: S.xl, backgroundColor: C.bg, flexGrow: 1 },
  modalH:   { fontSize: F.lg, fontWeight: '700', color: C.text, marginBottom: S.md },
  fieldLbl: { fontSize: F.xs, color: C.textMuted, marginBottom: 4, fontWeight: '500' },
  input:    { backgroundColor: C.white, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: S.md, fontSize: F.sm, color: C.text },
  aliasRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderRadius: R.md, padding: S.md, marginTop: 6 },
  aliasName:{ fontSize: F.sm, color: C.text },
  splitBtn: { fontSize: F.xs, color: C.danger, fontWeight: '500' },
});
