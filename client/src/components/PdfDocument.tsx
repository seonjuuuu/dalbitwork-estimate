/**
 * @react-pdf/renderer 기반 PDF 문서 컴포넌트
 * 한글 폰트(Noto Sans KR)를 TTF로 직접 등록하여 깨짐 없이 출력
 */
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
import type { DocumentData, DocumentItem } from '@/lib/types';
import { substituteVariables } from '@/lib/templateVariables';
import {
  getDocTypeLabel,
  getDocTypeSubtitle,
  parseAmount,
  getItemFinalPrice,
  calcTotalOriginal,
  calcTotalFinal,
  calcTotalDiscount,
  hasAnyDiscount,
} from '@/lib/types';

// 폰트 등록 - Noto Sans KR (variable weight TTF)
const FONT_REGULAR_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/NotoSansKR-Regular_84451f6a.ttf';
const FONT_BOLD_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/NotoSansKR-Bold_41a848f1.ttf';

Font.register({
  family: 'NotoSansKR',
  fonts: [
    { src: FONT_REGULAR_URL, fontWeight: 'normal' },
    { src: FONT_BOLD_URL, fontWeight: 'bold' },
  ],
});

// 하이픈 비활성화 (한글에 불필요)
Font.registerHyphenationCallback((word) => [word]);

const PDF_LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/dalbitwork-logo-full_89e7c0c1.png';
const SIGNATURE_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/signature-new_03d3b216.png';

const GOLD = '#F7AE00';
const GOLD_DARK = '#C78B00';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
}

function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR');
}

// 스타일 정의
const s = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansKR',
    fontSize: 10,
    color: '#1a1a1a',
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 40,
    backgroundColor: '#ffffff',
  },
  // Title
  titleWrap: {
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 14,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#888888',
  },
  // Info
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    fontSize: 10,
  },
  infoLeft: { width: 260 },
  infoRight: {
    alignItems: 'flex-end',
  },
  infoLine: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  infoLabel: {
    color: '#888888',
    width: 55,
  },
  infoLabelRight: {
    color: '#888888',
  },
  infoValue: {
    fontWeight: 500,
    color: '#1a1a1a',
  },
  infoUnderline: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    height: 14,
  },
  // Supplier info - 2열 레이아웃 (견적서 전용)
  supplierWrap: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 16,
  },
  supplierTable: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dddddd',
  },
  supplierRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
  },
  supplierLabelCell: {
    width: 70,
    backgroundColor: '#323232',
    paddingVertical: 5,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  supplierLabelCellGold: {
    width: 70,
    backgroundColor: GOLD,
    paddingVertical: 5,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  supplierLabelText: {
    fontSize: 8,
    fontWeight: 600,
    color: '#ffffff',
    textAlign: 'center',
  },
  supplierValueCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  supplierValueText: {
    fontSize: 8,
    color: '#1a1a1a',
  },
  // Discount banner
  discountBanner: {
    backgroundColor: '#FFF8E1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountLabel: {
    fontSize: 10,
    color: GOLD_DARK,
  },
  discountValue: {
    fontSize: 11,
    color: GOLD_DARK,
    textDecoration: 'line-through',
  },
  // Total banner
  totalBanner: {
    backgroundColor: GOLD,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalBannerWithDiscount: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  // Discount info
  discountInfo: {
    textAlign: 'right',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  discountInfoText: {
    fontSize: 9,
    color: GOLD,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  // Note below total
  totalNote: {
    fontSize: 8,
    color: '#999999',
    marginBottom: 14,
    textAlign: 'right',
  },
  // Table
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderTopWidth: 2,
    borderTopColor: '#323232',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  thNo: { width: 28, textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#555555' },
  thName: { flex: 1, textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#555555' },
  thQty: { width: 50, textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#555555' },
  thOrigPrice: { width: 65, textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#555555' },
  thDiscAmount: { width: 65, textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#555555' },
  thPrice: { width: 70, textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#555555' },
  tdNo: { width: 28, textAlign: 'center', fontSize: 10, color: '#888888' },
  tdName: { flex: 1, textAlign: 'left', fontSize: 10, color: '#1a1a1a' },
  tdQty: { width: 50, textAlign: 'center', fontSize: 10, color: '#555555' },
  tdOrigPrice: { width: 65, textAlign: 'right', fontSize: 10 },
  tdDiscAmount: { width: 65, textAlign: 'right', fontSize: 10 },
  tdPrice: { width: 70, textAlign: 'right', fontSize: 10, fontWeight: 500 },
  // Footer total
  footerRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderTopWidth: 2,
    borderTopColor: '#323232',
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  footerRowDiscount: {
    borderTopWidth: 1,
    borderTopColor: '#dddddd',
  },
  footerSubRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  // Notes
  notesSection: {
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    color: '#1a1a1a',
  },
  noteText: {
    fontSize: 9,
    color: '#555555',
    marginBottom: 3,
    lineHeight: 1.6,
  },
  // Freeform notes
  freeformLine: {
    fontSize: 9,
    color: '#555555',
    lineHeight: 1.7,
    marginBottom: 1,
  },
  freeformBoldLine: {
    fontSize: 9.5,
    color: '#1a1a1a',
    fontWeight: 700,
    lineHeight: 1.7,
    marginTop: 8,
    marginBottom: 2,
  },
  // Signature
  signatureDateLine: {
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
    fontSize: 13,
    color: '#555555',
    letterSpacing: 1,
  },
  signatureWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginTop: 8,
  },
  signatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signatureRoleLabel: {
    fontSize: 11,
    color: '#555555',
  },
  signatureUnderline: {
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    width: 100,
    height: 18,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  signatureNameOnLine: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  signatureSealWrap: {
    marginLeft: 4,
    position: 'relative',
    width: 20,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureSealText: {
    fontSize: 10,
    color: '#555555',
  },
  signatureImage: {
    width: 50,
    height: 50,
    position: 'absolute',
    left: -28,
    top: -18,
  },
  // Footer logo
  footerLogoWrap: {
    marginTop: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
  },
  footerLogo: {
    height: 24,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 8,
    color: '#bbbbbb',
  },
  // Proposal footer
  proposalFooterWrap: {
    marginTop: 28,
    alignItems: 'flex-end',
  },
  proposalLogo: {
    height: 30,
    marginBottom: 6,
  },
  proposalDate: {
    fontSize: 10,
    color: '#888888',
  },
  proposalDisclaimer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: 8,
    color: '#bbbbbb',
  },
});

/**
 * Parse freeform notes text into PDF elements.
 * - Lines matching "제N조" or "제 N조" patterns are rendered bold (article headings)
 * - **text** markdown-style bold markers are rendered as bold inline spans
 * - Empty lines become spacing
 */
function renderFreeformNotes(text: string, variables?: Record<string, string> | null) {
  if (!text) return null;
  // Apply variable substitution before rendering
  const processedText = substituteVariables(text, variables);
  const lines = processedText.split('\n');
  const elements: React.ReactNode[] = [];

  // Pattern for article headings: 제1조, 제 1조, 제2조 (계약의 성립), etc.
  const articlePattern = /^\s*제\s*\d+\s*조/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line → spacing
    if (line.trim() === '') {
      elements.push(<View key={`space-${i}`} style={{ height: 4 }} />);
      continue;
    }

    // Article heading (제N조)
    if (articlePattern.test(line)) {
      elements.push(
        <Text key={`line-${i}`} style={s.freeformBoldLine}>
          {line}
        </Text>
      );
      continue;
    }

    // Check for **bold** markers in the line
    if (line.includes('**')) {
      const parts = parseBoldText(line);
      elements.push(
        <Text key={`line-${i}`} style={s.freeformLine}>
          {parts.map((part, j) =>
            part.bold ? (
              <Text key={j} style={{ fontWeight: 700, color: '#1a1a1a' }}>{part.text}</Text>
            ) : (
              <Text key={j}>{part.text}</Text>
            )
          )}
        </Text>
      );
      continue;
    }

    // Regular line
    elements.push(
      <Text key={`line-${i}`} style={s.freeformLine}>
        {line}
      </Text>
    );
  }

  return <>{elements}</>;
}

/** Parse **bold** markers in a string */
function parseBoldText(text: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    parts.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), bold: false });
  }

  return parts;
}

interface PdfDocumentProps {
  doc: DocumentData;
}

export default function PdfDocument({ doc }: PdfDocumentProps) {
  const isProposal = doc.type === 'proposal';
  const docLabel = getDocTypeLabel(doc.type);
  const docSubtitle = getDocTypeSubtitle(doc.type);

  const totalOriginal = calcTotalOriginal(doc.items);
  const totalFinal = calcTotalFinal(doc.items);
  const totalDiscount = calcTotalDiscount(doc.items);
  const showDiscount = hasAnyDiscount(doc.items);
  const discountPercent = totalOriginal > 0 ? Math.round((totalDiscount / totalOriginal) * 100) : 0;

  // 단가가 입력된 항목이 하나라도 있는지 확인
  const hasAnyUnitPrice = doc.items.some(item => item.unitPrice && item.unitPrice.trim() !== '');
  
  // 할인금액이 입력된 항목이 하나라도 있는지 확인
  const hasAnyDiscountAmount = doc.items.some(item => item.discountAmount && item.discountAmount.trim() !== '');

  // 예상총액: 최소/최대 중 하나가 0이면 단일 금액만 표시
  const getTotalDisplay = () => {
    const baseAmount = showDiscount ? totalFinal : totalOriginal;
    if (!isProposal) return `${formatNumber(doc.totalMin)} 원`;
    if (doc.totalMin === 0 && doc.totalMax === 0) return '0 원';
    if (doc.totalMin === 0) return `${formatNumber(doc.totalMax)} 원`;
    if (doc.totalMax === 0) return `${formatNumber(doc.totalMin)} 원`;
    if (doc.totalMin === doc.totalMax) return `${formatNumber(doc.totalMin)} 원`;
    // 제안서: 총합과 범위를 줄바꿈으로 분리
    return {
      total: `총합: ${formatNumber(baseAmount)} 원`,
      range: `범위: ${formatNumber(doc.totalMin)} ~ ${formatNumber(doc.totalMax)} 원`
    };
  };
  const totalDisplay = getTotalDisplay();

  const getFooterTotalDisplay = () => {
    if (!isProposal) return formatNumber(doc.totalMin);
    if (doc.totalMin === 0 && doc.totalMax === 0) return '0';
    if (doc.totalMin === 0) return formatNumber(doc.totalMax);
    if (doc.totalMax === 0) return formatNumber(doc.totalMin);
    if (doc.totalMin === doc.totalMax) return formatNumber(doc.totalMin);
    return `${formatNumber(doc.totalMin)} ~ ${formatNumber(doc.totalMax)}`;
  };
  const footerTotalDisplay = getFooterTotalDisplay();

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Title */}
        <View style={s.titleWrap}>
          <Text style={s.title}>
            {docLabel === '제안서' ? '제 안 서' : '견적 및 계약서'}
          </Text>
          <Text style={s.subtitle}>{docSubtitle}</Text>
        </View>

        {/* Info */}
        <View style={s.infoRow}>
          <View style={s.infoLeft}>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>수    신</Text>
              {doc.clientName ? <Text style={s.infoValue}>{doc.clientName}</Text> : <View style={s.infoUnderline} />}
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>프로젝트</Text>
              {doc.projectName ? <Text style={s.infoValue}>{doc.projectName}</Text> : <View style={s.infoUnderline} />}
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>플 랫 폼</Text>
              <Text style={s.infoValue}>{doc.platform || '-'}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>담당자이름</Text>
              {doc.contactName ? <Text style={s.infoValue}>{doc.contactName}</Text> : <View style={s.infoUnderline} />}
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>연 락 처</Text>
              {doc.contactPhone ? <Text style={s.infoValue}>{doc.contactPhone}</Text> : <View style={s.infoUnderline} />}
            </View>
          </View>
          <View style={s.infoRight}>
            <View style={s.infoLine}>
              <Text style={s.infoLabelRight}>발 행 일</Text>
              <Text style={s.infoValue}>{formatDate(doc.date)}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabelRight}>발 행 처</Text>
              <Text style={s.infoValue}>달빛워크</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabelRight}>대 표 자</Text>
              <Text style={s.infoValue}>문선주</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabelRight}>사업자번호</Text>
              <Text style={s.infoValue}>350-14-02666</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabelRight}>연 락 처</Text>
              <Text style={s.infoValue}>010-2757-9116</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabelRight}>업    태</Text>
              <Text style={s.infoValue}>정보통신업 / 컴퓨터 프로그래밍 서비스업</Text>
            </View>
          </View>
        </View>

        {/* Discount banner */}
        {showDiscount && (
          <View style={s.discountBanner}>
            <Text style={s.discountLabel}>정가 합계</Text>
            <Text style={s.discountValue}>{formatNumber(totalOriginal)} 원</Text>
          </View>
        )}

        {/* Total banner */}
        <View style={showDiscount ? [s.totalBanner, s.totalBannerWithDiscount] : s.totalBanner}>
          <Text style={s.totalLabel}>
            {isProposal ? '예상 총액' : '확정 총액'}
          </Text>
          {typeof totalDisplay === 'object' ? (
            <View>
              <Text style={{ fontSize: 12, fontWeight: 500, color: '#666666', marginBottom: 4 }}>{totalDisplay.total}</Text>
              <Text style={s.totalValue}>{totalDisplay.range}</Text>
            </View>
          ) : (
            <Text style={s.totalValue}>{totalDisplay}</Text>
          )}
        </View>

        {showDiscount && (
          <View style={s.discountInfo}>
            <Text style={s.discountInfoText}>
              할인 적용 -{formatNumber(totalDiscount)}원 ({discountPercent}%)
            </Text>
          </View>
        )}

        <Text style={s.totalNote}>
          {isProposal
            ? '※ 대략 견적이며 상세 기획/협의 후 변동될 수 있습니다. | 매출증빙: 현금영수증 발행'
            : '매출증빙: 현금영수증 발행'}
        </Text>

        {/* Table */}
        <View style={s.table}>
          {/* Header */}
          <View style={s.tableHeader}>
            <Text style={s.thNo}>No.</Text>
            <Text style={s.thName}>항목</Text>
            <Text style={s.thQty}>수량</Text>
            {hasAnyUnitPrice && <Text style={{...s.thQty, width: 50}}>단가(원)</Text>}
            {(showDiscount || hasAnyDiscountAmount) && <Text style={s.thOrigPrice}>정가(원)</Text>}
            {(showDiscount || hasAnyDiscountAmount) && <Text style={s.thDiscAmount}>할인금액(원)</Text>}
            <Text style={s.thPrice}>{showDiscount ? '금액(원)' : '금액(원)'}</Text>
          </View>

          {/* Body */}
          {doc.items.map((item: DocumentItem, idx: number) => {
            const origAmt = parseAmount(item.originalPrice);
            const discountAmountVal = parseAmount(item.discountAmount || '');
            const finalAmt = getItemFinalPrice(item);
            const itemHasDiscount = discountAmountVal > 0 && origAmt > finalAmt;

            return (
              <View key={item.id} style={s.tableRow}>
                <Text style={s.tdNo}>{idx + 1}</Text>
                <Text style={s.tdName}>{item.name || '-'}</Text>
                <Text style={s.tdQty}>{item.quantity || 1}</Text>
                {hasAnyUnitPrice && (
                  <Text style={{...s.tdQty, width: 50, textAlign: 'right'}}>
                    {item.unitPrice ? formatNumber(parseAmount(item.unitPrice)) : '-'}
                  </Text>
                )}
                {(showDiscount || hasAnyDiscountAmount) && (
                  <Text style={[
                    s.tdOrigPrice,
                    {
                      color: itemHasDiscount ? '#aaaaaa' : '#555555',
                      textDecoration: itemHasDiscount ? 'line-through' : 'none',
                    }
                  ]}>
                    {formatNumber(origAmt)}
                  </Text>
                )}
                {(showDiscount || hasAnyDiscountAmount) && (
                  <Text style={[
                    s.tdDiscAmount,
                    { color: '#666666' }
                  ]}>
                    {discountAmountVal > 0 ? formatNumber(discountAmountVal) : '-'}
                  </Text>
                )}
                <Text style={[
                  s.tdPrice,
                  { color: finalAmt === 0 ? '#ff6b6b' : '#1a1a1a' }
                ]}>
                  {finalAmt === 0 ? '무료' : (isProposal ? `약 ${formatNumber(finalAmt)}` : formatNumber(finalAmt))}
                </Text>
              </View>
            );
          })}

          {/* Footer - discount rows */}
          {(showDiscount || hasAnyDiscountAmount) && (
            <>
              <View style={[s.footerSubRow, { borderTopWidth: 2, borderTopColor: '#323232' }]}>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ width: 55 }}></Text>
                {hasAnyUnitPrice && <Text style={{...s.thQty, width: 50}} />}
                {(showDiscount || hasAnyDiscountAmount) && <Text style={s.thOrigPrice} />}
                {(showDiscount || hasAnyDiscountAmount) && <Text style={s.thDiscAmount} />}
                <Text style={{ width: 90, textAlign: 'right', fontSize: 10, color: '#aaaaaa' }}>정가 합계 {formatNumber(totalOriginal)}</Text>
              </View>
              <View style={s.footerSubRow}>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ width: 55 }}></Text>
                {hasAnyUnitPrice && <Text style={{...s.thQty, width: 50}} />}
                {(showDiscount || hasAnyDiscountAmount) && <Text style={s.thOrigPrice} />}
                {(showDiscount || hasAnyDiscountAmount) && <Text style={s.thDiscAmount} />}
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 10, color: GOLD, fontWeight: 600 }}>할인 ({discountPercent}%) -{formatNumber(totalDiscount)}</Text>
              </View>
            </>
          )}

          {/* Footer total */}
          <View style={showDiscount ? [s.footerRow, s.footerRowDiscount] : s.footerRow}>
            <Text style={{ flex: 1 }}></Text>
            <Text style={{ width: showDiscount ? 55 : 55, textAlign: 'right', fontWeight: 700, color: '#555555', fontSize: 10 }}>합    계</Text>
            <Text style={{ width: showDiscount ? 170 : 90, textAlign: 'right', fontWeight: 700, fontSize: 10, color: '#1a1a1a' }}>
              {footerTotalDisplay}
            </Text>
          </View>
        </View>

        {/* Notes */}
        <View style={s.notesSection}>
          <Text style={s.notesTitle}>참고 사항</Text>
          {(!doc.notesMode || doc.notesMode === 'list') ? (
            // List mode - numbered items
            doc.notes.map((note: string, idx: number) => (
              <Text key={idx} style={s.noteText}>
                {note.trim() ? `${idx + 1}. ${note}` : ' '}
              </Text>
            ))
          ) : (
            // Freeform mode - render with bold support and variable substitution
            renderFreeformNotes(doc.freeformNotes || '', doc.templateVariables)
          )}
        </View>

        {/* Proposal: 하단 우측 로고 (날짜 제거) */}
        {isProposal && (
          <>
            <View style={s.proposalFooterWrap}>
              <Image src={PDF_LOGO_URL} style={s.proposalLogo} />
            </View>
            <View style={s.proposalDisclaimer}>
              <Text style={s.disclaimerText}>
                본 제안서는 대략적인 예상 견적이며, 상세 협의 후 변동될 수 있습니다.
              </Text>
            </View>
          </>
        )}

        {/* Estimate: 서명 영역 */}
        {!isProposal && (
          <>
            {/* 날짜 */}
            <Text style={s.signatureDateLine}>
              {'            '}년{'          '}월{'          '}일
            </Text>

            {/* 의뢰인 / 공급인 */}
            <View style={s.signatureWrap}>
              {/* 의뢰인 */}
              <View style={s.signatureItem}>
                <Text style={s.signatureRoleLabel}>의뢰인</Text>
                <View style={s.signatureUnderline}>
                  <Text style={{ fontSize: 1, color: '#ffffff' }}>{'                              '}</Text>
                </View>
                <View style={s.signatureSealWrap}>
                  <Text style={s.signatureSealText}>(인)</Text>
                </View>
              </View>

              {/* 공급인 */}
              <View style={s.signatureItem}>
                <Text style={s.signatureRoleLabel}>공급인</Text>
                <View style={s.signatureUnderline}>
                  <Text style={s.signatureNameOnLine}>달빛워크</Text>
                </View>
                <View style={s.signatureSealWrap}>
                  <Text style={s.signatureSealText}>(인)</Text>
                  <Image src={SIGNATURE_URL} style={s.signatureImage} />
                </View>
              </View>
            </View>

            {/* 견적서: 하단 가운데 로고 */}
            <View style={s.footerLogoWrap}>
              <Image src={PDF_LOGO_URL} style={s.footerLogo} />
              <Text style={s.footerText}>
                본 견적서의 금액은 확정 금액이며, 추가 작업 발생 시 별도 협의합니다.
              </Text>
            </View>
          </>
        )}
      </Page>
    </Document>
  );
}
