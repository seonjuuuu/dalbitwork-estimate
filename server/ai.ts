import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ENV } from "./_core/env";

const draftSchema = z.object({
  projectName: z.string().describe("프로젝트/사이트명. 문의 내용에서 유추. 불명확하면 빈 문자열."),
  platform: z.string().describe("제작 플랫폼(예: 아임웹(I'mweb), 카페24, 워드프레스). 언급 없으면 \"아임웹(I'mweb)\"."),
  businessType: z.string().describe("고객사 업종. 불명확하면 빈 문자열."),
  items: z
    .array(
      z.object({
        serviceItemName: z.string().describe("서비스 품목표에 있는 name과 정확히 동일한 값"),
        quantity: z.number().int().min(1),
      })
    )
    .describe("견적 합계에 포함되는 필수 품목 목록 (패키지 1개 등)"),
  optionalItems: z
    .array(
      z.object({
        serviceItemName: z.string().describe("서비스 품목표에 있는 name과 정확히 동일한 값"),
      })
    )
    .describe("견적 합계에는 포함되지 않는 선택 부가서비스 목록 (예: SEO 등록). 문의 내용과 명확히 관련 있을 때만 포함."),
  notes: z.array(z.string()).describe("이 프로젝트에 특화된 참고사항 문장 목록 (가격 정책 관련 일반 안내는 제외)"),
  summary: z.string().describe("담당자에게 보여줄 1~2문장 요약: 왜 이 품목들을 골랐는지"),
});

export type EstimateDraftResult = z.infer<typeof draftSchema>;

export interface ServiceItemInfo {
  name: string;
  description: string;
  unitPrice: string;
  category: string;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!ENV.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다. .env를 확인해주세요.");
    }
    client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  }
  return client;
}

export async function generateEstimateDraft(
  inquiryText: string,
  serviceItems: ServiceItemInfo[],
  docType: "proposal" | "estimate"
): Promise<EstimateDraftResult> {
  const catalogText = serviceItems
    .map(i => `- ${i.name} | 단가: ${i.unitPrice || "미기재"} | 분류: ${i.category || "-"} | 설명: ${i.description || "-"}`)
    .join("\n");

  const docLabel = docType === "proposal" ? "제안서" : "견적서";

  const response = await getClient().messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    output_config: {
      format: zodOutputFormat(draftSchema),
    },
    messages: [
      {
        role: "user",
        content: `당신은 웹 에이전시 "달빛워크"의 ${docLabel} 초안을 작성하는 영업 보조입니다.
아래 "고객 문의 내용"을 분석해서 ${docLabel} 초안에 필요한 정보를 추출하세요.

# 견적 정책 (반드시 준수)
- 서비스 품목표에서 분류(category)가 "패키지"인 항목은 홈페이지 제작 패키지 상품입니다. 문의 내용에 가장 적합한 패키지를 **정확히 1개만** 고르세요. 여러 패키지를 동시에 넣지 마세요. 패키지 항목의 quantity는 항상 1입니다.
  - 결제/장바구니 기능이 필요하면 "쇼핑몰" 패키지를 고려하세요.
  - 페이지 수가 많거나(메뉴 5개 이상) 구성이 복잡하면 "베이직"을, 단순 소개 위주 1페이지면 "랜딩페이지"를, 고급스러운 반응형 풀 구성이면 "프리미엄"을 고려하세요.
  - 문의만으로 패키지 선택이 애매하면 가장 근접한 패키지 1개를 선택하고, 그 이유를 notes에 한 줄로 남기세요.
- 분류가 "패키지"가 아닌 품목(예: SEO 등록)은 문의 내용과 명확히 관련 있을 때만 optionalItems에 넣으세요(items에는 넣지 마세요). 관련성이 애매하면 아예 넣지 마세요.
- 패키지에 포함된 기본 범위(예: 베이직 기준 메뉴 5개/페이지당 5~7섹션, 랜딩페이지 5섹션)를 명백히 초과하는 요청(추가 메뉴/섹션, 별도 인터랙션·애니메이션 등)이 보이면 items/optionalItems에 임의로 추가 항목이나 금액을 넣지 말고, notes에 "정확한 범위와 추가 비용은 상담 후 별도 확정됩니다"처럼 안내만 하세요.
- items와 optionalItems의 serviceItemName은 반드시 아래 "서비스 품목표"에 있는 이름과 정확히 동일해야 합니다. 표에 없는 서비스는 절대 만들지 마세요.
- 도메인/호스팅/SSL 비용 안내는 시스템이 별도로 항상 표시하므로 notes에 다시 언급하지 마세요. notes에는 파비콘 무료 포함 안내와, 이 프로젝트에 특화된 참고사항만 간결하게 남기세요.
- platform은 문의에 언급이 없으면 "아임웹(I'mweb)"으로 하세요.

# 서비스 품목표
${catalogText || "(등록된 품목 없음)"}

# 고객 문의 내용
${inquiryText}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AI가 이 요청을 처리할 수 없습니다. 문의 내용을 확인해주세요.");
  }
  if (!response.parsed_output) {
    throw new Error("AI 응답을 해석하지 못했습니다. 다시 시도해주세요.");
  }
  return response.parsed_output;
}
