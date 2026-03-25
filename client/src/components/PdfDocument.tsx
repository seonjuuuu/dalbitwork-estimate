/**
 * @react-pdf/renderer 기반 PDF 문서 컴포넌트
 * 한글 폰트(Noto Sans KR)를 TTF로 직접 등록하여 깨짐 없이 출력
 */
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
const FONT_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/NotoSansKR-Regular_84451f6a.ttf';

Font.register({
  family: 'NotoSansKR',
  src: FONT_URL,
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
  infoLeft: {},
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
  // Discount banner
  discountBanner: {
    backgroundColor: '#FFF8E1',
    padding: '8px 16px',
    borderRadius: '6px 6px 0 0',
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
    backgroundColor: '#323232',
    padding: '12px 16px',
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
    color: '#ffffff',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  // Discount info
  discountInfo: {
    textAlign: 'right',
    marginBottom: 10,
  },
  discountInfoText: {
    fontSize: 9,
    color: GOLD,
    fontWeight: 600,
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
  thQty: { width: 55, textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#555555' },
  thOrigPrice: { width: 80, textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#555555' },
  thPrice: { width: 90, textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#555555' },
  tdNo: { width: 28, textAlign: 'center', fontSize: 10, color: '#888888' },
  tdName: { flex: 1, textAlign: 'left', fontSize: 10, color: '#1a1a1a' },
  tdQty: { width: 55, textAlign: 'center', fontSize: 10, color: '#555555' },
  tdOrigPrice: { width: 80, textAlign: 'right', fontSize: 10 },
  tdPrice: { width: 90, textAlign: 'right', fontSize: 10, fontWeight: 500 },
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
    width: 80,
    height: 80,
    position: 'absolute',
    left: -50,
    top: -60,
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

  const totalDisplay = isProposal
    ? `${formatNumber(doc.totalMin)} ~ ${formatNumber(doc.totalMax)} 원`
    : `${formatNumber(doc.totalMin)} 원`;

  const footerTotalDisplay = isProposal
    ? `${formatNumber(doc.totalMin)} ~ ${formatNumber(doc.totalMax)}`
    : formatNumber(doc.totalMin);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Title */}
        <View style={s.titleWrap}>
          <Text style={s.title}>
            {docLabel === '제안서' ? '제 안 서' : '견 적 서'}
          </Text>
          <Text style={s.subtitle}>{docSubtitle}</Text>
        </View>

        {/* Info */}
        <View style={s.infoRow}>
          <View style={s.infoLeft}>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>수    신</Text>
              <Text style={s.infoValue}>{doc.clientName || '-'}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>프로젝트</Text>
              <Text style={s.infoValue}>{doc.projectName || '-'}</Text>
            </View>
            <View style={s.infoLine}>
              <Text style={s.infoLabel}>플 랫 폼</Text>
              <Text style={s.infoValue}>{doc.platform || '-'}</Text>
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
          <Text style={s.totalValue}>{totalDisplay}</Text>
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
            {showDiscount && <Text style={s.thOrigPrice}>정가(원)</Text>}
            <Text style={s.thPrice}>{showDiscount ? '할인가(원)' : '금액(원)'}</Text>
          </View>

          {/* Body */}
          {doc.items.map((item: DocumentItem, idx: number) => {
            const origAmt = parseAmount(item.originalPrice);
            const discAmt = parseAmount(item.discountPrice);
            const finalAmt = getItemFinalPrice(item);
            const itemHasDiscount = discAmt > 0 && origAmt > discAmt;

            return (
              <View key={item.id} style={s.tableRow}>
                <Text style={s.tdNo}>{idx + 1}</Text>
                <Text style={s.tdName}>{item.name || '-'}</Text>
                <Text style={s.tdQty}>{item.quantity}</Text>
                {showDiscount && (
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
                <Text style={[
                  s.tdPrice,
                  { color: itemHasDiscount ? GOLD : '#1a1a1a' }
                ]}>
                  {isProposal ? `약 ${formatNumber(finalAmt)}` : formatNumber(finalAmt)}
                </Text>
              </View>
            );
          })}

          {/* Footer - discount rows */}
          {showDiscount && (
            <>
              <View style={[s.footerSubRow, { borderTopWidth: 2, borderTopColor: '#323232' }]}>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ width: 55, textAlign: 'right', fontSize: 10, color: '#aaaaaa' }}>정가 합계</Text>
                <Text style={{ width: 80, textAlign: 'right', fontSize: 10, color: '#aaaaaa', textDecoration: 'line-through' }}>
                  {formatNumber(totalOriginal)}
                </Text>
                <Text style={{ width: 90 }}></Text>
              </View>
              <View style={s.footerSubRow}>
                <Text style={{ flex: 1 }}></Text>
                <Text style={{ width: 55, textAlign: 'right', fontSize: 10, color: GOLD, fontWeight: 600 }}>할인 ({discountPercent}%)</Text>
                <Text style={{ width: 80, textAlign: 'right', fontSize: 10, color: GOLD, fontWeight: 600 }}>
                  -{formatNumber(totalDiscount)}
                </Text>
                <Text style={{ width: 90 }}></Text>
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
          {doc.notes.map((note: string, idx: number) => (
            <Text key={idx} style={s.noteText}>
              {note.trim() ? `${idx + 1}. ${note}` : ' '}
            </Text>
          ))}
        </View>

        {/* Proposal: 하단 우측 로고 + 날짜 */}
        {isProposal && (
          <>
            <View style={s.proposalFooterWrap}>
              <Image src={PDF_LOGO_URL} style={s.proposalLogo} />
              <Text style={s.proposalDate}>{formatDate(doc.date)}</Text>
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
