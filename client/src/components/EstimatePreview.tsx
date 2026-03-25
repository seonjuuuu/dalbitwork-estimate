import { useEstimate } from '@/contexts/EstimateContext';
import { Button } from '@/components/ui/button';
import { Download, Eye } from 'lucide-react';
import { useRef, useCallback } from 'react';
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

// PDF용 풀 로고 (텍스트 포함)
const PDF_LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/dalbitwork-logo-full_89e7c0c1.png';

// 달빛워크 골드 색상 (HEX only - html2canvas 호환)
const GOLD = '#F7AE00';
const GOLD_LIGHT = '#FFF8E1';
const GOLD_DARK = '#C78B00';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
}

function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR');
}

export default function EstimatePreview() {
  const { currentDoc } = useEstimate();
  const previewRef = useRef<HTMLDivElement>(null);

  const isProposal = currentDoc.type === 'proposal';
  const docLabel = getDocTypeLabel(currentDoc.type);
  const docSubtitle = getDocTypeSubtitle(currentDoc.type);

  // 자동 계산
  const totalOriginal = calcTotalOriginal(currentDoc.items);
  const totalFinal = calcTotalFinal(currentDoc.items);
  const totalDiscount = calcTotalDiscount(currentDoc.items);
  const showDiscount = hasAnyDiscount(currentDoc.items);
  const discountPercent = totalOriginal > 0 ? Math.round((totalDiscount / totalOriginal) * 100) : 0;

  // 총액 표시
  const totalDisplay = isProposal
    ? `${formatNumber(currentDoc.totalMin)} ~ ${formatNumber(currentDoc.totalMax)} 원`
    : `${formatNumber(currentDoc.totalMin)} 원`;

  const footerTotalDisplay = isProposal
    ? `${formatNumber(currentDoc.totalMin)} ~\n${formatNumber(currentDoc.totalMax)}`
    : formatNumber(currentDoc.totalMin);

  // PDF 다운로드 - 인쇄 다이얼로그 방식 (A4 페이지네이션 자동 처리)
  const handleDownload = useCallback(() => {
    if (!previewRef.current) return;

    const printContent = previewRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.');
      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${currentDoc.clientName || '고객사'}_${docLabel}_달빛워크</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4;
      margin: 15mm 12mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans KR', 'Pretendard Variable', -apple-system, sans-serif;
      color: #1a1a1a;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    .page-break-avoid { page-break-inside: avoid; }
    img { max-width: 100%; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div style="max-width: 100%;">
    ${printContent}
  </div>
  <script>
    // 이미지 로딩 완료 후 인쇄
    const images = document.querySelectorAll('img');
    let loaded = 0;
    const total = images.length;
    if (total === 0) {
      setTimeout(() => { window.print(); window.close(); }, 300);
    } else {
      images.forEach(img => {
        if (img.complete) {
          loaded++;
          if (loaded === total) setTimeout(() => { window.print(); window.close(); }, 300);
        } else {
          img.onload = img.onerror = () => {
            loaded++;
            if (loaded === total) setTimeout(() => { window.print(); window.close(); }, 300);
          };
        }
      });
    }
  <\/script>
</body>
</html>
    `);
    printWindow.document.close();
  }, [currentDoc, docLabel]);

  // 프리뷰 영역 전용 인라인 스타일 (Tailwind/oklch 사용 금지)
  const fontStyle: React.CSSProperties = {
    fontFamily: "'Noto Sans KR', 'Pretendard Variable', -apple-system, sans-serif",
    color: '#1a1a1a',
    boxSizing: 'border-box' as const,
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="w-4 h-4" />
          미리보기
        </div>
        <Button onClick={handleDownload} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Download className="w-4 h-4" />
          PDF 다운로드
        </Button>
      </div>

      {/* Preview Container - 바깥 래퍼만 Tailwind 사용 */}
      <div style={{ background: '#f5f5f0', borderRadius: '8px', padding: '16px', overflow: 'auto', maxHeight: '80vh' }}>
        <div style={{ width: '595px', transform: 'scale(0.72)', transformOrigin: 'top center', margin: '0 auto' }}>
          {/* A4 프레임 - 모든 색상을 HEX 인라인으로 지정 (oklch 없음) */}
          <div
            ref={previewRef}
            style={{
              width: '595px',
              minHeight: '842px',
              background: '#ffffff',
              padding: '48px 40px 40px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
              ...fontStyle,
            }}
          >
            {/* Title - 상단 로고 없음 */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '16px', color: '#1a1a1a', marginBottom: '4px' }}>
                {docLabel === '제안서' ? '제 안 서' : '견 적 서'}
              </h1>
              <p style={{ fontSize: '11px', color: '#888888' }}>{docSubtitle}</p>
            </div>

            {/* Info Table */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '11px' }}>
              <div style={{ lineHeight: '2' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#888888', minWidth: '60px' }}>수　신</span>
                  <span style={{ fontWeight: '500', color: '#1a1a1a' }}>{currentDoc.clientName || '-'}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#888888', minWidth: '60px' }}>프로젝트</span>
                  <span style={{ fontWeight: '500', color: '#1a1a1a' }}>{currentDoc.projectName || '-'}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#888888', minWidth: '60px' }}>플 랫 폼</span>
                  <span style={{ fontWeight: '500', color: '#1a1a1a' }}>{currentDoc.platform || '-'}</span>
                </div>
              </div>
              <div style={{ lineHeight: '2', textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <span style={{ color: '#888888' }}>발 행 일</span>
                  <span style={{ fontWeight: '500', color: '#1a1a1a' }}>{formatDate(currentDoc.date)}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <span style={{ color: '#888888' }}>발 행 처</span>
                  <span style={{ fontWeight: '500', color: '#1a1a1a' }}>달빛워크</span>
                </div>
              </div>
            </div>

            {/* Total Banner */}
            {showDiscount && (
              <div style={{ background: GOLD_LIGHT, padding: '8px 20px', borderRadius: '6px 6px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: GOLD_DARK }}>정가 합계</span>
                <span style={{ fontSize: '12px', color: GOLD_DARK, textDecoration: 'line-through', fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatNumber(totalOriginal)} 원
                </span>
              </div>
            )}
            <div style={{
              background: '#323232',
              color: '#ffffff',
              padding: '14px 20px',
              borderRadius: showDiscount ? '0 0 6px 6px' : '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
            }}>
              <span style={{ fontSize: '12px', fontWeight: '500', color: '#ffffff' }}>
                {isProposal ? '예상 총액' : '확정 총액'}
              </span>
              <span style={{ fontSize: '18px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.5px', color: '#ffffff' }}>
                {totalDisplay}
              </span>
            </div>

            {showDiscount && (
              <div style={{ textAlign: 'right', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', color: GOLD, fontWeight: '600' }}>
                  할인 적용 -{formatNumber(totalDiscount)}원 ({discountPercent}%)
                </span>
              </div>
            )}
            {!showDiscount && <div style={{ marginBottom: '12px' }} />}

            <p style={{ fontSize: '9px', color: '#999999', marginBottom: '16px', textAlign: 'right' }}>
              {isProposal
                ? '※ 대략 견적이며 상세 기획/협의 후 변동될 수 있습니다. | 매출증빙: 현금영수증 발행'
                : '매출증빙: 현금영수증 발행'}
            </p>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '24px' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderTop: '2px solid #323232', borderBottom: '1px solid #dddddd' }}>
                  <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: '600', color: '#555555', width: '32px' }}>No.</th>
                  <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: '600', color: '#555555' }}>항목</th>
                  <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: '600', color: '#555555', width: '64px' }}>수량</th>
                  {showDiscount && (
                    <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: '600', color: '#555555', width: '90px' }}>정가(원)</th>
                  )}
                  <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: '600', color: '#555555', width: '100px' }}>
                    {showDiscount ? '할인가(원)' : '금액(원)'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentDoc.items.map((item, idx) => {
                  const origAmt = parseAmount(item.originalPrice);
                  const discAmt = parseAmount(item.discountPrice);
                  const finalAmt = getItemFinalPrice(item);
                  const itemHasDiscount = discAmt > 0 && origAmt > discAmt;

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eeeeee' }}>
                      <td style={{ padding: '8px 8px', textAlign: 'center', color: '#888888' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 8px', color: '#1a1a1a' }}>{item.name || '-'}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'center', color: '#555555' }}>{item.quantity}</td>
                      {showDiscount && (
                        <td style={{
                          padding: '8px 8px',
                          textAlign: 'right',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '11px',
                          color: itemHasDiscount ? '#aaaaaa' : '#555555',
                          textDecoration: itemHasDiscount ? 'line-through' : 'none',
                        }}>
                          {formatNumber(origAmt)}
                        </td>
                      )}
                      <td style={{
                        padding: '8px 8px',
                        textAlign: 'right',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        color: itemHasDiscount ? GOLD : '#1a1a1a',
                        fontWeight: '500',
                      }}>
                        {isProposal ? `약 ${formatNumber(finalAmt)}` : formatNumber(finalAmt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {showDiscount && (
                  <>
                    <tr style={{ borderTop: '2px solid #323232' }}>
                      <td colSpan={2} style={{ padding: '6px 8px' }} />
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '500', color: '#aaaaaa', fontSize: '11px' }}>정가 합계</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#aaaaaa', textDecoration: 'line-through' }}>
                        {formatNumber(totalOriginal)}
                      </td>
                      <td style={{ padding: '6px 8px' }} />
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ padding: '4px 8px' }} />
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: '600', color: GOLD, fontSize: '11px' }}>할인 ({discountPercent}%)</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: GOLD, fontWeight: '600' }}>
                        -{formatNumber(totalDiscount)}
                      </td>
                      <td style={{ padding: '4px 8px' }} />
                    </tr>
                  </>
                )}
                <tr style={{ background: '#f5f5f5', borderTop: showDiscount ? '1px solid #dddddd' : '2px solid #323232' }}>
                  <td colSpan={showDiscount ? 3 : 2} style={{ padding: '8px 8px' }} />
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: '700', color: '#555555' }}>합　계</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#1a1a1a', whiteSpace: 'pre-line' }}>
                    {footerTotalDisplay}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Notes */}
            <div style={{ marginBottom: '28px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#1a1a1a' }}>참고 사항</h4>
              {currentDoc.notes.map((note: string, idx: number) => (
                <p key={idx} style={{ fontSize: '10px', color: '#555555', marginBottom: '4px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                  {idx + 1}. {note}
                </p>
              ))}
            </div>

            {/* 제안서: 하단 우측에 로고 + 날짜 */}
            {isProposal && (
              <div style={{ textAlign: 'right', marginTop: '32px' }}>
                <img src={PDF_LOGO_URL} alt="달빛워크" style={{ height: '36px', display: 'inline-block', marginBottom: '8px' }} />
                <p style={{ fontSize: '11px', color: '#888888' }}>{formatDate(currentDoc.date)}</p>
              </div>
            )}

            {/* 견적서: 서명 영역 */}
            {!isProposal && (
              <div style={{ marginTop: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#555555', marginBottom: '8px', borderBottom: '2px solid #323232', paddingBottom: '6px' }}>발 행 처</p>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a', marginTop: '12px' }}>달빛워크</p>
                    <div style={{ marginTop: '12px', borderBottom: '1px solid #cccccc', height: '50px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#bbbbbb', marginBottom: '4px' }}>(서명)</span>
                    </div>
                    <p style={{ fontSize: '10px', color: '#888888', marginTop: '6px' }}>날짜: {formatDate(currentDoc.date)}</p>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#555555', marginBottom: '8px', borderBottom: '2px solid #323232', paddingBottom: '6px' }}>수 신 처</p>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a', marginTop: '12px' }}>{currentDoc.clientName || '(고객사명)'}</p>
                    <div style={{ marginTop: '12px', borderBottom: '1px solid #cccccc', height: '50px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#bbbbbb', marginBottom: '4px' }}>(서명)</span>
                    </div>
                    <p style={{ fontSize: '10px', color: '#888888', marginTop: '6px' }}>날짜: ____년 ____월 ____일</p>
                  </div>
                </div>
              </div>
            )}

            {/* 견적서: 하단 가운데 로고 */}
            {!isProposal && (
              <div style={{ marginTop: '32px', textAlign: 'center', borderTop: '1px solid #eeeeee', paddingTop: '16px' }}>
                <img src={PDF_LOGO_URL} alt="달빛워크" style={{ height: '32px', display: 'inline-block', marginBottom: '6px' }} />
                <p style={{ fontSize: '9px', color: '#bbbbbb' }}>
                  본 견적서의 금액은 확정 금액이며, 추가 작업 발생 시 별도 협의합니다.
                </p>
              </div>
            )}

            {/* 제안서: 하단 안내 문구 */}
            {isProposal && (
              <div style={{ marginTop: '20px', borderTop: '1px solid #eeeeee', paddingTop: '10px', textAlign: 'center' }}>
                <p style={{ fontSize: '9px', color: '#bbbbbb' }}>
                  본 제안서는 대략적인 예상 견적이며, 상세 협의 후 변동될 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
