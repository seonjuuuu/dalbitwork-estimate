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

const siteStructureSchema = z.object({
  menuStructure: z
    .array(
      z.object({
        label: z.string().describe("메뉴명 (예: Home, About, Services)"),
        subItems: z.array(z.string()).describe("하위 메뉴 또는 페이지 내 주요 섹션 목록. 없으면 빈 배열."),
      })
    )
    .describe("대략적인 사이트 메뉴 구성 (1depth 메뉴 + 하위 섹션)"),
  questions: z
    .array(z.string())
    .describe("구성안을 확정하기 위해 고객에게 반드시 확인해야 할 질문 목록. 상담 내용에 이미 답이 있는 것은 제외."),
  summary: z.string().describe("담당자에게 보여줄 1~2문장 요약"),
});

export type SiteStructureResult = z.infer<typeof siteStructureSchema>;

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
  - 결제/장바구니 기능이 필요하면 "쇼핑몰" 패키지를 고려하세요. 쇼핑몰 패키지는 최소 80만원부터 시작하는 상품입니다.
  - 페이지 수가 많거나(메뉴 5개 이상) 구성이 복잡하면 "베이직"을, 단순 소개 위주 1페이지면 "랜딩페이지"를, 고급스러운 반응형 풀 구성이면 "프리미엄"을 고려하세요.
  - 문의만으로 패키지 선택이 애매하면 가장 근접한 패키지 1개를 선택하고, 그 이유를 notes에 한 줄로 남기세요.
- 분류가 "패키지"가 아닌 품목은 문의 내용과 명확히 관련 있을 때만 optionalItems에 넣으세요(items에는 넣지 마세요). 관련성이 애매하면 아예 넣지 마세요. 단, "SEO 등록"은 시스템이 별도로 항상 선택사항에 추가하므로 직접 넣지 마세요.
- 페이지 수(추가 메뉴/서브페이지)가 선택한 패키지의 기본 제공 페이지 수(각 패키지 설명 참고)를 명백히 초과하고, 초과 페이지 수를 문의 내용에서 명확히 셀 수 있는 경우에만: items에 "추가 페이지"를 quantity=초과 페이지 수로 추가하세요(페이지당 15만원, 서비스 품목표의 단가를 그대로 사용). 초과 페이지 수가 애매하면 추가하지 말고 notes에 "정확한 페이지 수는 상담 후 확정됩니다"처럼만 안내하세요.
- 페이지 수가 아닌 다른 범위 초과(섹션 수, 별도 인터랙션·애니메이션 등)는 가격을 임의로 산정하지 말고, notes에 "정확한 범위와 추가 비용은 상담 후 별도 확정됩니다"처럼 안내만 하세요.
- items와 optionalItems의 serviceItemName은 반드시 아래 "서비스 품목표"에 있는 이름과 정확히 동일해야 합니다. 표에 없는 서비스는 절대 만들지 마세요.
- 도메인/호스팅/SSL 비용 안내와 SEO 등록은 시스템이 별도로 항상 표시하므로 notes에 다시 언급하지 마세요. notes에는 파비콘 무료 포함 안내와, 이 프로젝트에 특화된 참고사항만 간결하게 남기세요.
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

export interface PreviousSiteStructure {
  menuStructure: { label: string; subItems: string[] }[];
  questions: string[];
  summary: string;
}

export async function generateSiteStructure(
  consultationText: string,
  previous?: PreviousSiteStructure
): Promise<SiteStructureResult> {
  const previousText = previous
    ? `# 이전에 생성한 구성안 (참고용, 이 위에 새 내용을 얹어서 업데이트하세요)
■ 메뉴 구성
${previous.menuStructure.map(m => `- ${m.label}${m.subItems.length > 0 ? '\n' + m.subItems.map(s => `  · ${s}`).join('\n') : ''}`).join('\n')}

■ 이전에 확인이 필요했던 사항
${previous.questions.length > 0 ? previous.questions.map(q => `- ${q}`).join('\n') : '(없음)'}

`
    : '';

  const response = await getClient().messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    output_config: {
      format: zodOutputFormat(siteStructureSchema),
    },
    messages: [
      {
        role: "user",
        content: `당신은 웹 에이전시 "달빛워크"에서 고객과의 상담 내용을 바탕으로 홈페이지 구성안을 잡아주는 기획 보조입니다.
아래 "상담 내용"을 분석해서 대략적인 메뉴 구성과, 구성안을 확정하기 전에 고객에게 반드시 확인해야 할 질문 목록을 뽑아주세요.

# 지침
- 메뉴 구성은 실제 웹사이트에서 흔히 쓰이는 1depth 메뉴 단위(Home, About, Service, Portfolio, Contact 등)로 정리하고, 각 메뉴 아래 들어갈 만한 주요 섹션/하위 페이지를 subItems로 함께 제시하세요.
- 상담 내용에 언급된 업종·목적·요청사항을 최대한 반영해 실제 그 고객사에 맞는 구성으로 만드세요. 일반적인 템플릿을 그대로 베끼지 마세요.
- questions는 상담 내용만으로는 알 수 없어서 구성안을 확정하려면 고객에게 물어봐야 하는 것만 담으세요 (예: 보유 콘텐츠/이미지 여부, 로그인·회원 기능 필요 여부, 다국어 지원 여부, 참고하고 싶은 레퍼런스 사이트, 메인 컬러/톤앤매너 선호 등). 상담 내용에 이미 답이 나와있는 항목은 questions에 넣지 마세요.
- 메뉴/질문 모두 이 프로젝트에 특화되게, 너무 뻔하거나 일반적인 내용은 피하세요.
${previous ? `- 이전에 생성한 구성안이 있습니다. 완전히 새로 만들지 말고 그 위에 얹어서 업데이트하세요: 기존 메뉴는 유지하되 새 상담 내용에 맞게 다듬고, 필요하면 새 메뉴를 추가하세요. 이전 질문 중 새 상담 내용으로 답이 확인된 것은 questions에서 빼고, 여전히 확인이 안 된 것과 새로 생긴 질문만 남기세요.` : ''}

${previousText}# 상담 내용
${consultationText}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AI가 이 요청을 처리할 수 없습니다. 상담 내용을 확인해주세요.");
  }
  if (!response.parsed_output) {
    throw new Error("AI 응답을 해석하지 못했습니다. 다시 시도해주세요.");
  }
  return response.parsed_output;
}
