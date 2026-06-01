import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Font,
  StyleSheet,
} from '@react-pdf/renderer';

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
const BORDER = '#cccccc';
const BG_HEADER = '#f2f2f2';

export interface HKTBInvoiceItem {
  id: string;
  date: string;
  jobDescription: string;
  unitPrice: string;
  quantity: string;
}

export interface HKTBInvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  items: HKTBInvoiceItem[];
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function parseNum(s: string): number {
  return parseInt(s.replace(/,/g, '')) || 0;
}

function calcItem(item: HKTBInvoiceItem) {
  const price = parseNum(item.unitPrice) * parseNum(item.quantity);
  const vat = Math.round(price * 0.1);
  const total = price + vat;
  return { price, vat, total };
}

function formatInvoiceDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansKR',
    fontSize: 9,
    color: '#1a1a1a',
    paddingTop: 48,
    paddingBottom: 72,
    paddingHorizontal: 44,
    backgroundColor: '#ffffff',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textDecoration: 'underline',
    letterSpacing: 2,
  },
  invoiceNo: {
    fontSize: 9,
    color: '#444',
    marginTop: 6,
  },
  // FROM/TO/DATE block
  infoBlock: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 20,
  },
  infoLeft: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  infoRight: {
    width: 130,
    flexDirection: 'column',
  },
  dateCenterWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  sectionLabel: {
    backgroundColor: BG_HEADER,
    paddingVertical: 5,
    paddingHorizontal: 10,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sectionBody: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  sectionName: {
    fontWeight: 'bold',
    fontSize: 9,
    marginBottom: 3,
  },
  sectionText: {
    fontSize: 8,
    color: '#444',
    marginBottom: 2,
    lineHeight: 1.4,
  },
  dateLabel: {
    backgroundColor: BG_HEADER,
    paddingVertical: 5,
    paddingHorizontal: 10,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  dateValue: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Table
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BG_HEADER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cell: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    fontSize: 8,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  cellLast: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    fontSize: 8,
  },
  colDate: { width: 52 },
  colJob: { flex: 1 },
  colUnitPrice: { width: 56, textAlign: 'right' },
  colQty: { width: 44, textAlign: 'right' },
  colPrice: { width: 64, textAlign: 'right' },
  colVAT: { width: 56, textAlign: 'right' },
  colTotal: { width: 64, textAlign: 'right' },
  footerLabel: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  footerValue: {
    width: 64,
    paddingVertical: 7,
    paddingHorizontal: 6,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Bank info
  bankSection: {
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 32,
  },
  bankHeader: {
    backgroundColor: GOLD,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1a1a1a',
    letterSpacing: 1,
  },
  bankRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  bankLabel: {
    width: 72,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#555',
  },
  bankValue: {
    fontSize: 8,
    color: '#1a1a1a',
  },
  // Footer — absolute to A4 bottom
  footerWrap: {
    position: 'absolute',
    bottom: 20,
    left: 44,
    right: 44,
  },
  footerDivider: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginBottom: 12,
  },
  logoWrap: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 36,
    objectFit: 'contain',
  },
});

interface Props {
  data: HKTBInvoiceData;
}

export default function HKTBInvoicePdf({ data }: Props) {
  const grandTotal = data.items.reduce((sum, item) => sum + calcItem(item).total, 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.title}>INVOICE</Text>
          <Text style={s.invoiceNo}>NO. {data.invoiceNo || '—'}</Text>
        </View>

        {/* FROM / TO / DATE */}
        <View style={s.infoBlock}>
          <View style={s.infoLeft}>
            {/* FROM */}
            <Text style={s.sectionLabel}>FROM. (SELLER)</Text>
            <View style={s.sectionBody}>
              <Text style={s.sectionName}>DalBit Work</Text>
              <Text style={s.sectionText}>Address: 186, Biryong-ro, Hwado-eup, Namyangju-si, Gyeonggi-do, Republic of Korea</Text>
              <Text style={s.sectionText}>E-mail: m.seonjuuu@gmail.com</Text>
              <Text style={s.sectionText}>Tel: +82 10-8985-3954</Text>
            </View>
            {/* TO */}
            <Text style={[s.sectionLabel, { borderTopWidth: 1, borderTopColor: BORDER }]}>To.(BUYER)</Text>
            <View style={s.sectionBody}>
              <Text style={s.sectionName}>HKTB (Hong Kong Tourism Board)</Text>
              <Text style={s.sectionText}>Address: 11/F, 16, Eulji-ro, Jung-gu, Seoul, Republic of Korea</Text>
              <Text style={s.sectionText}>Tel: +82 2 778 4403</Text>
            </View>
          </View>

          {/* DATE */}
          <View style={s.infoRight}>
            <Text style={s.dateLabel}>DATE OF INVOICE</Text>
            <View style={s.dateCenterWrap}>
              <Text style={s.dateValue}>{formatInvoiceDate(data.invoiceDate)}</Text>
            </View>
          </View>
        </View>

        {/* Table */}
        <View style={s.table}>
          {/* Header row */}
          <View style={s.tableHeader}>
            <Text style={[s.cell, s.colDate, { fontWeight: 'bold', textAlign: 'center' }]}>Date</Text>
            <Text style={[s.cell, s.colJob, { fontWeight: 'bold', textAlign: 'center' }]}>Job Description</Text>
            <Text style={[s.cell, s.colUnitPrice, { fontWeight: 'bold', textAlign: 'center' }]}>Unit Price</Text>
            <Text style={[s.cell, s.colQty, { fontWeight: 'bold', textAlign: 'center' }]}>Quantity</Text>
            <Text style={[s.cell, s.colPrice, { fontWeight: 'bold', textAlign: 'center' }]}>Price</Text>
            <Text style={[s.cell, s.colVAT, { fontWeight: 'bold', textAlign: 'center' }]}>VAT</Text>
            <Text style={[s.cellLast, s.colTotal, { fontWeight: 'bold', textAlign: 'center' }]}>Total</Text>
          </View>

          {/* Data rows */}
          {data.items.map((item) => {
            const { price, vat, total } = calcItem(item);
            return (
              <View key={item.id} style={s.tableRow}>
                <Text style={[s.cell, s.colDate, { textAlign: 'center' }]}>{item.date}</Text>
                <Text style={[s.cell, s.colJob, { textAlign: 'center' }]}>{item.jobDescription}</Text>
                <Text style={[s.cell, s.colUnitPrice, { textAlign: 'center' }]}>{fmt(parseNum(item.unitPrice))}</Text>
                <Text style={[s.cell, s.colQty, { textAlign: 'center' }]}>{fmt(parseNum(item.quantity))}</Text>
                <Text style={[s.cell, s.colPrice, { textAlign: 'center' }]}>{fmt(price)}</Text>
                <Text style={[s.cell, s.colVAT, { textAlign: 'center' }]}>{fmt(vat)}</Text>
                <Text style={[s.cellLast, s.colTotal, { textAlign: 'center' }]}>{fmt(total)}</Text>
              </View>
            );
          })}

          {/* Total row */}
          <View style={s.tableFooter}>
            <Text style={s.footerLabel}>Total Price</Text>
            <Text style={s.footerValue}>{fmt(grandTotal)}</Text>
          </View>
        </View>

        {/* Bank Information */}
        <View style={s.bankSection}>
          <Text style={s.bankHeader}>BANK INFORMATION</Text>
          {[
            ['BANK NAME', 'KOOKMIN BANK'],
            ['ADDRESS', '#26, Gukjegeumyung-ro 8-gil, Yeongdeungpo-gu, Seoul, Korea'],
            ['Tel', '+82 1588-9999'],
            ['SWIFT NO', 'CZNBKRSE'],
            ['ACC NO', '616337-04-005356'],
            ['ACC NAME', '문선주 (달빛워크)'],
          ].map(([label, value]) => (
            <View key={label} style={s.bankRow}>
              <Text style={s.bankLabel}>{label}</Text>
              <Text style={s.bankValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Footer — fixed to A4 bottom */}
        <View style={s.footerWrap} fixed>
          <View style={s.footerDivider} />
          <View style={s.logoWrap}>
            <Image src={PDF_LOGO_URL} style={s.logo} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
