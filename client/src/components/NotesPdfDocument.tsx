import React from 'react';
import { Document, Page, Text, View, Image, Font, StyleSheet } from '@react-pdf/renderer';
import type { DocumentData } from '@/lib/types';
import { substituteVariables } from '@/lib/templateVariables';

const FONT_REGULAR_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/NotoSansKR-Regular_84451f6a.ttf';
const FONT_BOLD_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/NotoSansKR-Bold_41a848f1.ttf';
const PDF_LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/dalbitwork-logo-full_89e7c0c1.png';

Font.register({
  family: 'NotoSansKR',
  fonts: [
    { src: FONT_REGULAR_URL, fontWeight: 'normal' },
    { src: FONT_BOLD_URL, fontWeight: 'bold' },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const GOLD = '#F7AE00';

const s = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansKR',
    fontSize: 10,
    color: '#1a1a1a',
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 44,
    backgroundColor: '#ffffff',
  },
  logo: { width: 110, height: 28, objectFit: 'contain', marginBottom: 20 },
  titleBar: {
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
    paddingBottom: 8,
    marginBottom: 18,
  },
  title: { fontSize: 18, fontWeight: 700, color: '#1a1a1a', letterSpacing: 4 },
  subtitle: { fontSize: 9, color: '#888888', marginTop: 3 },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoLabel: { fontSize: 9, color: '#888888', width: 56 },
  infoValue: { fontSize: 9, color: '#1a1a1a', flex: 1 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5', marginVertical: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 },
  noteItem: { fontSize: 9.5, color: '#333333', marginBottom: 5, lineHeight: 1.65 },
  freeformLine: { fontSize: 9.5, color: '#333333', lineHeight: 1.7, marginBottom: 1 },
  freeformBoldLine: {
    fontSize: 10, color: '#1a1a1a', fontWeight: 700,
    lineHeight: 1.7, marginTop: 8, marginBottom: 2,
  },
  footer: {
    position: 'absolute', bottom: 28, left: 44, right: 44,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  footerText: { fontSize: 8, color: '#aaaaaa' },
});

function parseBoldText(text: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), bold: false });
    parts.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), bold: false });
  return parts;
}

function renderFreeform(text: string, variables?: Record<string, string> | null) {
  if (!text) return null;
  const processed = substituteVariables(text, variables);
  const articlePattern = /^\s*제\s*\d+\s*조/;
  return processed.split('\n').map((line, i) => {
    if (line.trim() === '') return <View key={i} style={{ height: 4 }} />;
    if (articlePattern.test(line)) return <Text key={i} style={s.freeformBoldLine}>{line}</Text>;
    if (line.includes('**')) {
      const parts = parseBoldText(line);
      return (
        <Text key={i} style={s.freeformLine}>
          {parts.map((p, j) =>
            p.bold
              ? <Text key={j} style={{ fontWeight: 700, color: '#1a1a1a' }}>{p.text}</Text>
              : <Text key={j}>{p.text}</Text>
          )}
        </Text>
      );
    }
    return <Text key={i} style={s.freeformLine}>{line}</Text>;
  });
}

interface Props { doc: DocumentData }

export default function NotesPdfDocument({ doc }: Props) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${String(today.getMonth() + 1).padStart(2, '0')}월 ${String(today.getDate()).padStart(2, '0')}일`;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* 로고 */}
        <Image src={PDF_LOGO_URL} style={s.logo} />

        {/* 제목 */}
        <View style={s.titleBar}>
          <Text style={s.title}>참 고 사 항 안 내</Text>
          {doc.projectName ? <Text style={s.subtitle}>{doc.projectName}</Text> : null}
        </View>

        {/* 고객 정보 */}
        {(doc.clientName || doc.contactName || doc.date) && (
          <View style={{ marginBottom: 12 }}>
            {doc.clientName ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>고객사</Text>
                <Text style={s.infoValue}>{doc.clientName}</Text>
              </View>
            ) : null}
            {doc.contactName ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>담당자</Text>
                <Text style={s.infoValue}>{doc.contactName}</Text>
              </View>
            ) : null}
            {doc.date ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>기준일</Text>
                <Text style={s.infoValue}>{doc.date}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={s.divider} />

        {/* 참고사항 내용 */}
        <Text style={s.sectionTitle}>참고 사항</Text>
        {(!doc.notesMode || doc.notesMode === 'list') ? (
          (doc.notes || []).map((note, idx) => (
            <Text key={idx} style={s.noteItem}>
              {note.trim() ? `${idx + 1}.  ${note}` : ' '}
            </Text>
          ))
        ) : (
          renderFreeform(doc.freeformNotes || '', doc.templateVariables)
        )}

        {/* 하단 */}
        <View style={s.footer}>
          <Text style={s.footerText}>달빛워크 · dalbitwork.com</Text>
          <Text style={s.footerText}>출력일: {todayStr}</Text>
        </View>
      </Page>
    </Document>
  );
}
