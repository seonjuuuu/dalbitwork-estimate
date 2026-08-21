import * as XLSX from "xlsx";

export type ParsedCardTransaction = {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM:SS"
  merchant: string;
  amount: number;
  currency: "KRW" | "USD";
  installment: string;
  approvalNo: string;
};

type SheetProfile = {
  currency: "KRW" | "USD";
  aliases: Record<string, string[]>;
};

// 카드사 이용내역 엑셀은 국내/해외/개인사업자용마다 컬럼 구성이 서로 다름
const PROFILES: SheetProfile[] = [
  {
    // 국내이용내역 (일시불+할부_카드이용내역조회)
    currency: "KRW",
    aliases: {
      date: ["승인일자"],
      time: ["승인시각"],
      merchant: ["가맹점명"],
      amount: ["승인금액(원)", "승인금액"],
      installment: ["일시불할부구분"],
      approvalNo: ["승인번호"],
      cancelled: ["취소여부", "취소구분"],
    },
  },
  {
    // 해외이용내역 (해외승인_카드이용내역조회)
    currency: "USD",
    aliases: {
      date: ["승인일자"],
      time: ["승인시각"],
      merchant: ["가맹점명"],
      amount: ["승인금액(USD)"],
      installment: ["일시불할부구분"],
      approvalNo: ["승인번호"],
      cancelled: ["취소여부", "취소구분"],
    },
  },
  {
    // 개인사업자용 카드 이용내역
    currency: "KRW",
    aliases: {
      date: ["매출일자"],
      merchant: ["가맹점명"],
      amount: ["매출금액(원)"],
      installment: ["매출상품명"],
      approvalNo: ["승인번호"],
    },
  },
];

function normDate(d: string): string {
  const trimmed = d.trim();
  if (/^\d{8}$/.test(trimmed)) {
    // "20260101" 같은 구분자 없는 8자리 날짜
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return trimmed.replace(/\./g, "-");
}

function findHeaderRow(rows: unknown[][], aliases: Record<string, string[]>) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((cell) => String(cell).trim());
    const found: Record<string, number> = {};
    for (const [key, candidates] of Object.entries(aliases)) {
      const idx = row.findIndex((cell) => candidates.includes(cell));
      if (idx !== -1) found[key] = idx;
    }
    if (found.merchant !== undefined && found.amount !== undefined && found.date !== undefined) {
      return { headerRowIndex: i, colIndex: found };
    }
  }
  return null;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * 승인번호가 비어있는 행(해외 정기결제 등)도 버리지 않도록 대체 키를 만들어준다.
 * occurrence는 같은 날짜·가맹점·금액 조합이 여러 번 나올 때 키가 겹치지 않게 하기 위함.
 */
function fallbackApprovalKey(date: string, merchant: string, amount: number, occurrence: number): string {
  return `NOAPR-${simpleHash(`${date}-${merchant}-${amount}-${occurrence}`)}`;
}

function extractRows(
  rows: unknown[][],
  headerRowIndex: number,
  colIndex: Record<string, number>,
  currency: "KRW" | "USD"
): ParsedCardTransaction[] {
  const results: ParsedCardTransaction[] = [];
  const fallbackOccurrences = new Map<string, number>();
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const dateRaw = String(row[colIndex.date] ?? "").trim();
    if (!dateRaw) continue;

    const merchant = String(row[colIndex.merchant] ?? "").trim();
    if (!merchant) continue;

    const amountRaw = row[colIndex.amount];
    const amount = typeof amountRaw === "number" ? amountRaw : parseFloat(String(amountRaw).replace(/[^0-9.-]/g, ""));
    // 0원, 취소/환불로 인한 음수 금액은 제외
    if (!amount || amount <= 0 || Number.isNaN(amount)) continue;

    // 취소된 거래는 제외 ("-" 또는 빈 값이면 취소 아님)
    const cancelledRaw = colIndex.cancelled !== undefined ? String(row[colIndex.cancelled] ?? "").trim() : "";
    if (cancelledRaw && cancelledRaw !== "-") continue;

    const date = normDate(dateRaw);
    let approvalNo = colIndex.approvalNo !== undefined ? String(row[colIndex.approvalNo] ?? "").trim() : "";
    if (!approvalNo) {
      const dupeKey = `${date}-${merchant}-${amount}`;
      const occurrence = (fallbackOccurrences.get(dupeKey) ?? 0) + 1;
      fallbackOccurrences.set(dupeKey, occurrence);
      approvalNo = fallbackApprovalKey(date, merchant, amount, occurrence);
    }

    results.push({
      date,
      time: colIndex.time !== undefined ? String(row[colIndex.time] ?? "").trim() : "",
      merchant,
      amount,
      currency,
      installment: colIndex.installment !== undefined ? String(row[colIndex.installment] ?? "").trim() : "",
      approvalNo,
    });
  }
  return results;
}

/**
 * 카드사에서 내려받은 "일시불+할부_카드이용내역조회"(국내, 원화) /
 * "해외승인_카드이용내역조회"(해외, USD) / "개인사업자용 카드 이용내역" 등의
 * 엑셀을 파싱한다. 시트가 여러 개 있을 수 있어(요약 시트, 국내/해외 상세 시트 등)
 * 실제 거래 상세 컬럼이 있는 시트를 모두 찾아서 그 안의 데이터 행을 추출해 합친다.
 */
export function parseCardStatementXlsx(buffer: Buffer): ParsedCardTransaction[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const allResults: ParsedCardTransaction[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

    for (const profile of PROFILES) {
      const match = findHeaderRow(rows, profile.aliases);
      if (!match) continue;
      const results = extractRows(rows, match.headerRowIndex, match.colIndex, profile.currency);
      if (results.length > 0) {
        allResults.push(...results);
        break; // 이 시트는 이 프로필로 처리 완료, 다음 시트로
      }
    }
  }

  return allResults;
}
