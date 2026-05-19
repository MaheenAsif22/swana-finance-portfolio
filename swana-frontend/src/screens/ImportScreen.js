import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TextInput, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { preview } from '../api/import.api';
import Button from '../components/ui/Button';
import { C, F, S, R } from '../utils/theme';

/**
 * Step 1 of the import flow:
 *   - Paste the WhatsApp chat .txt content (or pick a file on web)
 *   - POST to /api/import/preview
 *   - On success, navigate to ImportReview with the preview payload
 *
 * The chat is never stored on the server; only the parsed preview is built
 * server-side and held in memory. The owner has to explicitly commit it
 * on the next screen for anything to be written to the database.
 */
export default function ImportScreen({ navigation }) {
  const [chatText, setChatText] = useState('');
  const [fileName, setFileName] = useState(null);
  const [busy,     setBusy]     = useState(false);
  const fileInputRef = useRef(null);

  // Web-only: open the native file picker via a hidden input element
  function pickFile() {
    if (Platform.OS !== 'web') {
      Alert.alert('Tip', 'Open your WhatsApp chat → Export chat → Without media. Paste the .txt contents here.');
      return;
    }
    fileInputRef.current?.click();
  }

  // Web-only: handle the file selection
  function onFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      Alert.alert('Too large', 'Max chat size is 10 MB. Try a shorter date range.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setChatText(String(ev.target.result || ''));
    reader.readAsText(file);
  }

  async function onPreview() {
    if (!chatText || chatText.length < 50) {
      Alert.alert('Empty', 'Paste your WhatsApp chat text first.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await preview(chatText, fileName);
      navigation.replace('ImportReview', { preview: data });
    } catch (e) {
      Alert.alert('Preview failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  // Approx-count messages so the user gets immediate feedback on what they pasted
  const lineCount = chatText ? chatText.split('\n').length : 0;
  const approxMessages = chatText ? (chatText.match(/\n\[\d{2}\/\d{2}\/\d{4}/g) || []).length + 1 : 0;

  return (
    <ScrollView style={st.root} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
      <Text style={st.h1}>Import from WhatsApp</Text>
      <Text style={st.sub}>
        Upload an exported WhatsApp chat. The system will parse it, recognize payees and categories
        from past data, and show a preview before anything is saved.
      </Text>

      <View style={st.howTo}>
        <Text style={st.howToTitle}>How to export</Text>
        <Text style={st.howToStep}>1. Open the WhatsApp group → tap the name at the top</Text>
        <Text style={st.howToStep}>2. Scroll down → Export chat → Without media</Text>
        <Text style={st.howToStep}>3. Save the .txt file → open it → copy all → paste below</Text>
      </View>

      {Platform.OS === 'web' && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            style={{ display: 'none' }}
            onChange={onFileChosen}
          />
          <TouchableOpacity style={st.fileBtn} onPress={pickFile}>
            <Text style={st.fileBtnTxt}>📎  {fileName || 'Pick a .txt file'}</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={st.label}>Or paste the chat text:</Text>
      <TextInput
        style={st.textarea}
        multiline
        textAlignVertical="top"
        value={chatText}
        onChangeText={(t) => { setChatText(t); setFileName(null); }}
        placeholder={'[14/07/2020, 08:30:21] Factory Zahid Sb: Rs 4000 req to a quddus...\n[14/07/2020, 08:38:47] Usman: Approved\n...'}
        placeholderTextColor={C.textLight}
      />

      {chatText.length > 0 && (
        <Text style={st.stat}>
          {lineCount.toLocaleString()} lines · approx {approxMessages.toLocaleString()} messages
        </Text>
      )}

      <Button
        label={busy ? 'Parsing…' : `Parse ${approxMessages || ''} messages`}
        onPress={onPreview}
        loading={busy}
        style={{ marginTop: S.lg }}
        disabled={busy || chatText.length < 50}
      />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: S.sm }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  content:     { padding: S.lg, paddingBottom: S.xxl * 2 },

  h1:          { fontSize: F.xl, fontWeight: '700', color: C.text, marginBottom: 4 },
  sub:         { fontSize: F.sm, color: C.textMuted, lineHeight: 20, marginBottom: S.lg },

  howTo:       { backgroundColor: C.primaryBg, borderRadius: R.md, padding: S.md, marginBottom: S.lg },
  howToTitle:  { fontSize: F.sm, fontWeight: '700', color: C.primary, marginBottom: S.sm },
  howToStep:   { fontSize: F.sm, color: C.text, marginBottom: 4 },

  fileBtn:     { borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: S.md, backgroundColor: C.white, marginBottom: S.md, alignItems: 'center' },
  fileBtnTxt:  { fontSize: F.sm, fontWeight: '500', color: C.text },

  label:       { fontSize: F.sm, fontWeight: '500', color: C.textMuted, marginBottom: S.xs, marginTop: S.sm },
  textarea:    {
    minHeight: 200, maxHeight: 380,
    backgroundColor: C.white,
    borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    padding: S.md,
    fontSize: F.sm, color: C.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  stat:        { fontSize: F.xs, color: C.textMuted, marginTop: S.xs, textAlign: 'right' },
});
