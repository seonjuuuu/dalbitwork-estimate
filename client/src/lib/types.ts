export type DocumentType = 'proposal' | 'estimate';

export interface DocumentItem {
  id: string;
  name: string;
  quantity: string;
  originalPrice: string; // 정가 (필수)
  discountPrice: string; // 할인가 (선택, 비어있으면 정가가 최종 금액)
  discountAmount: string; // 할인금액 (선택, 입력 시 할인가 자동 계산)
}

export type NotesMode = 'list' | 'freeform';

export interface DocumentData {
  id?: string;
  type: DocumentType;
  title: string;        // 내부 관리용 타이틀 (PDF 미노출)
  memo: string;         // 내부 관리용 메모 (PDF 미노출)
  clientName: string;
  projectName: string;
  platform: string;
  date: string;
  items: DocumentItem[];
  notes: string[];
  notesMode: NotesMode;
  freeformNotes: string | null;
  templateVariables: Record<string, string> | null;
  totalMin: number;
  totalMax: number;
  contactPhone: string; // 담당자 번호
  businessType: string; // 업종
  optionalItems: OptionalItem[]; // 선택사항
  createdAt?: string;
  updatedAt?: string;
}

export interface OptionalItem {
  id: string;
  name: string;
  description: string;
  quantity: string;
  price: string;
  payer: string;
}

// 콤마 제거하고 숫자만 추출
export function stripCommas(str: string): string {
  return str.replace(/,/g, '');
}

// 숫자를 콤마 포맷으로 변환
export function formatWithCommas(value: string | number): string {
  if (typeof value === 'number') {
    return value.toLocaleString('ko-KR');
  }
  const cleaned = String(value).replace(/,/g, '');
  if (/[^0-9]/.test(cleaned)) return String(value);
  const num = parseInt(cleaned);
  if (isNaN(num)) return String(value);
  return num.toLocaleString('ko-KR');
}

// 숫자 입력 시 콤마 자동 포맷
export function autoFormatNumber(input: string): string {
  const digits = input.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const num = parseInt(digits);
  if (isNaN(num)) return '';
  return num.toLocaleString('ko-KR');
}

// 문자열에서 숫자만 추출
export function parseAmount(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/약/g, '').replace(/\s/g, '');
  const parts = cleaned.split('~');
  const numStr = parts[0].replace(/,/g, '');
  return parseInt(numStr) || 0;
}

// 항목의 최종 금액 (할인가가 있으면 할인가, 없으면 정가)
export function getItemFinalPrice(item: DocumentItem): number {
  const discount = parseAmount(item.discountPrice);
  if (discount > 0) return discount;
  return parseAmount(item.originalPrice);
}

// 항목들의 정가 합계 계산
export function calcTotalOriginal(items: DocumentItem[]): number {
  return items.reduce((sum, item) => sum + parseAmount(item.originalPrice), 0);
}

// 항목들의 최종 금액 합계 계산
export function calcTotalFinal(items: DocumentItem[]): number {
  return items.reduce((sum, item) => sum + getItemFinalPrice(item), 0);
}

// 총 할인 금액 계산
export function calcTotalDiscount(items: DocumentItem[]): number {
  return items.reduce((sum, item) => {
    const orig = parseAmount(item.originalPrice);
    const disc = parseAmount(item.discountPrice);
    if (disc > 0 && orig > disc) return sum + (orig - disc);
    return sum;
  }, 0);
}

// 할인이 존재하는지 확인
export function hasAnyDiscount(items: DocumentItem[]): boolean {
  return items.some(item => {
    const orig = parseAmount(item.originalPrice);
    const disc = parseAmount(item.discountPrice);
    return disc > 0 && orig > disc;
  });
}

export const proposalNotes = [
  '본 견적은 대략적인 예상 금액이며, 상세 기획 협의 후 확정됩니다.',
  '아임웹 결제 비용은 고객사 별도 결제 사항입니다.',
  '이미지 및 콘텐츠 소스(텍스트, 로고, 제품사진 등)는 고객사 제공 기준입니다.',
];

export const estimateNotes = [
  '본 견적서의 금액은 확정 금액이며, 추가 작업 발생 시 별도 협의합니다.',
  '아임웹 결제 비용은 고객사 별도 결제 사항입니다.',
  '이미지 및 콘텐츠 소스(텍스트, 로고, 제품사진 등)는 고객사 제공 기준입니다.',
  '매출증빙: 현금영수증 발행',
];

export const defaultProposal: DocumentData = {
  type: 'proposal',
  title: '',
  memo: '',
  clientName: '',
  projectName: '',
  platform: "\uc544\uc784\uc6f9(I'mweb)",
  date: new Date().toISOString().split('T')[0],
  items: [
    { id: '1', name: '\uba54\uc778 \ud398\uc774\uc9c0 (\uad6d\ubb38, 5\uc12e\uc158 \uae30\uc900)', quantity: '1\ud398\uc774\uc9c0', originalPrice: '900,000', discountPrice: '', discountAmount: '' },
    { id: '2', name: '\uc11c\ube0c \ud398\uc774\uc9c0 (\uad6d\ubb38)', quantity: '4\ud398\uc774\uc9c0', originalPrice: '600,000', discountPrice: '', discountAmount: '' },
  ],
  notes: proposalNotes,
  notesMode: 'list',
  freeformNotes: null,
  templateVariables: null,
  totalMin: 0,
  totalMax: 0,
  contactPhone: '',
  businessType: '',
  optionalItems: [],
};

export const defaultEstimate: DocumentData = {
  type: 'estimate',
  title: '',
  memo: '',
  clientName: '',
  projectName: '',
  platform: "\uc544\uc784\uc6f9(I'mweb)",
  date: new Date().toISOString().split('T')[0],
  items: [
    { id: '1', name: '\uba54\uc778 \ud398\uc774\uc9c0 (\uad6d\ubb38, 5\uc12e\uc158 \uae30\uc900)', quantity: '1\ud398\uc774\uc9c0', originalPrice: '900,000', discountPrice: '', discountAmount: '' },
    { id: '2', name: '\uc11c\ube0c \ud398\uc774\uc9c0 (\uad6d\ubb38)', quantity: '4\ud398\uc774\uc9c0', originalPrice: '600,000', discountPrice: '', discountAmount: '' },
  ],
  notes: estimateNotes,
  notesMode: 'list',
  freeformNotes: null,
  templateVariables: null,
  totalMin: 0,
  totalMax: 0,
  contactPhone: '',
  businessType: '',
  optionalItems: [],
};

export function getDocTypeLabel(type: DocumentType): string {
  return type === 'proposal' ? '제안서' : '견적서';
}

export function getDocTypeSubtitle(type: DocumentType): string {
  return type === 'proposal' ? '( 예상 견적 )' : '( 확정 견적 )';
}
