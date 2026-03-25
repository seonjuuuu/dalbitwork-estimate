import { useEstimate } from '@/contexts/EstimateContext';
import { Button } from '@/components/ui/button';
import { Download, Eye } from 'lucide-react';
import { useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  getDocTypeLabel,
  getDocTypeSubtitle,
  parseAmount,
  getItemFinalPrice,
  calcTotalOriginal,
  calcTotalFinal,
  calcTotalDiscount,
  hasAnyDiscount,
  formatWithCommas,
} from '@/lib/types';

// PDF 헤더용 풀 로고 (텍스트 포함)
const PDF_LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/dalbitwork-logo-full_89e7c0c1.png';

// 달빛워크 골드 색상
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

  // PDF 다운로드 - 올바른 A4 페이지네이션
  const handleDownload = useCallback(async () => {
    if (!previewRef.current) return;

    const el = previewRef.current;
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgWidth = 210; // A4 mm
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');

    if (imgHeight <= pageHeight) {
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
    } else {
      // 멀티 페이지: 캔버스를 A4 높이 단위로 잘라서 각 페이지에 배치
      let remainingHeight = canvas.height;
      let position = 0;
      const pageCanvasHeight = (pageHeight * canvas.width) / imgWidth;

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0, position,
            canvas.width, sliceHeight,
            0, 0,
            canvas.width, sliceHeight
          );
        }

        const pageImgHeight = (sliceHeight * imgWidth) / canvas.width;
        if (position > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, pageImgHeight);

        remainingHeight -= pageCanvasHeight;
        position += pageCanvasHeight;
      }
    }

    const fileName = `${currentDoc.clientName || '고객사'}_${docLabel}_달빛워크.pdf`;
    pdf.save(fileName);
  }, [currentDoc, docLabel]);

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

      {/* Preview Container - A4 비율 유지 */}
      <div className="bg-muted/30 rounded-lg p-4 overflow-auto max-h-[80vh]">
        <div
          className="mx-auto shadow-lg"
          style={{ width: '595px', transform: 'scale(0.72)', transformOrigin: 'top center' }}
        >
          <div
            ref={previewRef}
            style={{
              width: '595px',
              minHeight: '842px',
              background: '#fff',
              padding: '48px 40px 40px',
              fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif",
              color: '#1a1a1a',
              boxSizing: 'border-box',
            }}
          >
            {/* Logo - 풀 로고 (텍스트 포함) */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <img src={PDF_LOGO_URL} alt="달빛워크" style={{ height: '48px', display: 'inline-block' }} crossOrigin="anonymous" />
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '16px', color: '#1a1a1a', marginBottom: '4px' }}>
                {docLabel === '제안서' ? '제 안 서' : '견 적 서'}
              </h1>
              <p style={{ fontSize: '11px', color: '#888' }}>{docSubtitle}</p>
            </div>

            {/* Info Table */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '11px' }}>
              <div style={{ lineHeight: '2' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#888', minWidth: '60px' }}>수　신</span>
                  <span style={{ fontWeight: '500' }}>{currentDoc.clientName || '-'}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#888', minWidth: '60px' }}>프로젝트</span>
                  <span style={{ fontWeight: '500' }}>{currentDoc.projectName || '-'}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#888', minWidth: '60px' }}>플 랫 폼</span>
                  <span style={{ fontWeight: '500' }}>{currentDoc.platform || '-'}</span>
                </div>
              </div>
              <div style={{ lineHeight: '2', textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <span style={{ color: '#888' }}>발 행 일</span>
                  <span style={{ fontWeight: '500' }}>{formatDate(currentDoc.date)}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <span style={{ color: '#888' }}>발 행 처</span>
                  <span style={{ fontWeight: '500' }}>달빛워크</span>
                </div>
              </div>
            </div>

            {/* Total Banner - 할인 시 골드 배너 */}
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
              color: '#fff',
              padding: '14px 20px',
              borderRadius: showDiscount ? '0 0 6px 6px' : '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
            }}>
              <span style={{ fontSize: '12px', fontWeight: '500' }}>
                {isProposal ? '예상 총액' : '확정 총액'}
              </span>
              <span style={{ fontSize: '18px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.5px' }}>
                {totalDisplay}
              </span>
            </div>

            {showDiscount && (
              <div style={{ textAlign: 'right', marginBottom: '16px' }}>
                <span style={{ fontSize: '10px', color: GOLD, fontWeight: '600' }}>
                  할인 적용 -{formatNumber(totalDiscount)}원 ({discountPercent}%)
                </span>
              </div>
            )}
            {!showDiscount && <div style={{ marginBottom: '16px' }} />}

            {isProposal && (
              <p style={{ fontSize: '9px', color: '#999', textAlign: 'right', marginTop: '-12px', marginBottom: '16px' }}>
                ※ 대략 견적이며 상세 기획/협의 후 변동될 수 있습니다. | 매출증빙: 현금영수증 발행
              </p>
            )}
            {!isProposal && (
              <p style={{ fontSize: '9px', color: '#999', textAlign: 'right', marginTop: '-12px', marginBottom: '16px' }}>
                매출증빙: 현금영수증 발행
              </p>
            )}

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '28px' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderTop: '2px solid #323232', borderBottom: '1px solid #ddd' }}>
                  <th style={{ padding: '10px 10px', textAlign: 'center', fontWeight: '600', color: '#555', width: '36px' }}>No.</th>
                  <th style={{ padding: '10px 10px', textAlign: 'left', fontWeight: '600', color: '#555' }}>항목</th>
                  <th style={{ padding: '10px 10px', textAlign: 'center', fontWeight: '600', color: '#555', width: '70px' }}>수량</th>
                  {showDiscount && (
                    <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '600', color: '#555', width: '100px' }}>정가(원)</th>
                  )}
                  <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '600', color: '#555', width: '110px' }}>
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
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px 10px', textAlign: 'center', color: '#888' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 10px', color: '#1a1a1a' }}>{item.name || '-'}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'center', color: '#555' }}>{item.quantity}</td>
                      {showDiscount && (
                        <td style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '11px',
                          color: itemHasDiscount ? '#aaa' : '#555',
                          textDecoration: itemHasDiscount ? 'line-through' : 'none',
                        }}>
                          {formatNumber(origAmt)}
                        </td>
                      )}
                      <td style={{
                        padding: '10px 10px',
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
                {/* 정가 합계 행 (할인이 있을 때만) */}
                {showDiscount && (
                  <>
                    <tr style={{ borderTop: '2px solid #323232' }}>
                      <td colSpan={2} style={{ padding: '8px 10px' }} />
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '500', color: '#aaa', fontSize: '11px' }}>정가 합계</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#aaa', textDecoration: 'line-through' }}>
                        {formatNumber(totalOriginal)}
                      </td>
                      <td style={{ padding: '8px 10px' }} />
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ padding: '4px 10px' }} />
                      <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: '600', color: GOLD, fontSize: '11px' }}>할인 ({discountPercent}%)</td>
                      <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: GOLD, fontWeight: '600' }}>
                        -{formatNumber(totalDiscount)}
                      </td>
                      <td style={{ padding: '4px 10px' }} />
                    </tr>
                  </>
                )}
                {/* 합계 행 */}
                <tr style={{ background: '#f5f5f5', borderTop: showDiscount ? '1px solid #ddd' : '2px solid #323232' }}>
                  <td colSpan={showDiscount ? 3 : 2} style={{ padding: '10px 10px' }} />
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: '#555' }}>합　계</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#1a1a1a', whiteSpace: 'pre-line' }}>
                    {footerTotalDisplay}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Notes */}
            <div style={{ marginBottom: '40px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px', color: '#1a1a1a' }}>참고 사항</h4>
              {currentDoc.notes.map((note: string, idx: number) => (
                <p key={idx} style={{ fontSize: '11px', color: '#555', marginBottom: '6px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                  {idx + 1}. {note}
                </p>
              ))}
            </div>

            {/* Signature Area */}
            {isProposal ? (
              <div style={{ textAlign: 'right', marginTop: '40px' }}>
                <p style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', marginBottom: '6px' }}>달빛워크</p>
                <p style={{ fontSize: '11px', color: '#888' }}>{formatDate(currentDoc.date)}</p>
              </div>
            ) : (
              <div style={{ marginTop: '48px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '8px', borderBottom: '2px solid #323232', paddingBottom: '6px' }}>발 행 처</p>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a', marginTop: '12px' }}>달빛워크</p>
                    <div style={{ marginTop: '12px', borderBottom: '1px solid #ccc', height: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#bbb', marginBottom: '4px' }}>(서명)</span>
                    </div>
                    <p style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>날짜: {formatDate(currentDoc.date)}</p>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '8px', borderBottom: '2px solid #323232', paddingBottom: '6px' }}>수 신 처</p>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a', marginTop: '12px' }}>{currentDoc.clientName || '(고객사명)'}</p>
                    <div style={{ marginTop: '12px', borderBottom: '1px solid #ccc', height: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#bbb', marginBottom: '4px' }}>(서명)</span>
                    </div>
                    <p style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>날짜: ____년 ____월 ____일</p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '9px', color: '#bbb' }}>
                {isProposal
                  ? '본 제안서는 대략적인 예상 견적이며, 상세 협의 후 변동될 수 있습니다.'
                  : '본 견적서의 금액은 확정 금액이며, 추가 작업 발생 시 별도 협의합니다.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
