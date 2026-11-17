import {
  AGENTS,
  ASSISTANT_AGENT,
  DEFAULT_FREE_MODEL,
  HALL_AGENTS,
  OPENROUTER_API_URL,
  RETRY_CONFIG,
  getAgentRoleForMode,
  getModeMeta,
  normalizeWorkMode,
  type AgentId,
} from '../core/workModes';

export interface OpenRouterUsagePayload {
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  model?: string;
  error?: {
    message?: string;
    code?: number | string;
    status?: string;
  };
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: unknown;
      reasoning?: unknown;
      reasoning_content?: unknown;
      reasoning_details?: unknown;
    };
  }>;
}

export interface ApiErrorInfo {
  status: number;
  errorType: 'timeout' | 'api' | 'network';
  shortLabel: string;
  message: string;
}

export interface TaggedApiError extends Error {
  status?: number;
  shortLabel?: string;
  errorType?: 'timeout' | 'api' | 'network';
  isTimeout?: boolean;
  isNetworkError?: boolean;
  isEmptyContent?: boolean;
}

export interface OpenRouterCallResult {
  text: string;
  totalTokens: number;
  actualModel: string;
}

export interface OpenRouterKeyFallbackResult extends OpenRouterCallResult {
  attemptUsed: 1 | 2 | 3;
  usedKeyFallback: boolean;
  usedModelFallback: boolean;
  fallbackFromStatus?: number;
  rescueModel?: string;
}

export interface OpenRouterCallOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  maxTokens?: number;
  omitMaxTokens?: boolean;
  fallbackModel?: string;
  fallbackModels?: string[];
  systemPrompt?: string;
  rescueOnModelError?: boolean;
  fetchFn?: typeof fetch;
  onRetry?: (attempt: number, maxRetries: number, status: number | string) => void;
  onFallback?: (fallbackModel: string, reason: string) => void;
  onSilentRetry?: (
    attemptNum: number,
    maxSilent: number,
    meta: { status?: number | string; switchedKey?: boolean; modelId?: string; rescueModel?: string }
  ) => void;
  onKeyFallback?: (status: number, err: Error) => void;
}

export interface MarkedLike {
  parse: (md: string, opts?: Record<string, unknown>) => string;
}

export interface SanitizerLike {
  sanitize: (dirty: string, config?: Record<string, unknown>) => string;
}

export function extractOpenRouterUsageTokens(payload: unknown): number {
  const usage = (payload as OpenRouterUsagePayload | null | undefined)?.usage;
  if (!usage || typeof usage !== 'object') return 0;
  const total = Number(usage.total_tokens);
  if (Number.isFinite(total) && total > 0) return Math.round(total);
  const prompt = Number(usage.prompt_tokens);
  const completion = Number(usage.completion_tokens);
  const summed = (Number.isFinite(prompt) ? prompt : 0) + (Number.isFinite(completion) ? completion : 0);
  return summed > 0 ? Math.round(summed) : 0;
}

export function extractOpenRouterActualModel(payload: unknown, fallbackModel = ''): string {
  const raw =
    typeof (payload as OpenRouterUsagePayload | null | undefined)?.model === 'string'
      ? (payload as OpenRouterUsagePayload).model!.trim()
      : '';
  if (raw) return raw;
  return typeof fallbackModel === 'string' ? fallbackModel.trim() : '';
}

export function formatTokenCount(count: number): string {
  const val = Math.max(0, Math.round(Number(count) || 0));
  return `${new Intl.NumberFormat('vi-VN').format(val)} tokens`;
}

export function normalizeMemoryBullets(rawText: string, maxBullets = 5): string {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^#{1,6}\s*\[?ký ức/i.test(line))
    .map((line) => line.replace(/^([-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of lines) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(`- ${item}`);
    }
    if (deduped.length >= maxBullets) break;
  }
  return deduped.join('\n');
}

export function parseAssistantMemoryExtraction(
  assistantText: string,
  existingMemory = ''
): { cleanReport: string; extractedMemory: string; mergedMemory: string } {
  const raw = String(assistantText || '');
  const headingRegex = /(?:^|\n)#{1,4}\s*\[?Ký ức cần ghi nhớ\]?[^\n]*\n([\s\S]*)$/i;
  const match = raw.match(headingRegex);
  if (!match || match.index === undefined) {
    return {
      cleanReport: raw.trim(),
      extractedMemory: '',
      mergedMemory: normalizeMemoryBullets(existingMemory, 5),
    };
  }
  const cleanReport = raw.slice(0, match.index).trim();
  const extractedBlock = match[1] || '';
  const newBullets = normalizeMemoryBullets(extractedBlock, 5);
  const mergedMemory = newBullets
    ? normalizeMemoryBullets(`${newBullets}\n${existingMemory || ''}`, 5)
    : normalizeMemoryBullets(existingMemory, 5);
  return {
    cleanReport: cleanReport || raw.trim(),
    extractedMemory: newBullets,
    mergedMemory,
  };
}

export function extractCoreSummary(markdownText: string): string {
  const raw = String(markdownText || '').trim();
  if (!raw) return '';
  const headingMatch = raw.match(/(?:^|\n)(?:#{1,4}\s*)?\[Tóm tắt cốt lõi\][^\n]*\n([\s\S]*)$/i);
  if (!headingMatch) return '';
  let body = (headingMatch[1] || '').trim();
  const nextHeadingIdx = body.search(/\n#{1,3}\s+[^\[]/);
  if (nextHeadingIdx !== -1) {
    body = body.slice(0, nextHeadingIdx).trim();
  }
  return body ? `### [Tóm tắt cốt lõi]\n${body}` : '';
}

export function formatContextForBeat3(markdownText: string | undefined, label: string): string {
  const raw = typeof markdownText === 'string' ? markdownText.trim() : '';
  if (!raw) return `(Bàn ${label} chưa có kết quả hoặc đang chờ chạy lại.)`;
  const core = extractCoreSummary(raw);
  if (core) return core;
  return raw;
}

export function buildFullReportMarkdown({
  mode,
  topic,
  outputs = {},
  actualModels = {},
  usedModels = {},
  tokenCounts = {},
}: {
  mode: string;
  topic: string;
  outputs?: Partial<Record<AgentId, string>>;
  actualModels?: Partial<Record<AgentId, string>>;
  usedModels?: Partial<Record<AgentId, string>>;
  tokenCounts?: Partial<Record<AgentId, number>>;
}): string {
  const modeTitle = getModeMeta(mode).label;
  const totalTokens = AGENTS.reduce((acc, a) => acc + (Number(tokenCounts[a.id]) || 0), 0);
  const parts: string[] = [
    `# BÁO CÁO HỘI ĐỒNG CHUYÊN GIA AI 3D`,
    `**Chế độ làm việc:** ${modeTitle}`,
    `**Yêu cầu:** ${topic || ''}`,
    `**Tổng tiêu thụ:** ${formatTokenCount(totalTokens)}`,
    '',
  ];

  if (outputs.assistant) {
    const role5 = getAgentRoleForMode(mode, 'assistant');
    const modelLabel = actualModels.assistant || usedModels.assistant || '';
    const tCount = Number(tokenCounts.assistant) || 0;
    parts.push(`---`);
    parts.push(
      `## BÁO CÁO ĐIỀU HÀNH (EXECUTIVE SUMMARY) — ${role5.name}${modelLabel ? ` — Model: ${modelLabel}` : ''}${tCount > 0 ? ` · ${formatTokenCount(tCount)}` : ''}`
    );
    parts.push(outputs.assistant);
    parts.push('');
  }

  HALL_AGENTS.forEach((agent) => {
    if (outputs[agent.id]) {
      const role = getAgentRoleForMode(mode, agent.id);
      const modelLabel = actualModels[agent.id] || usedModels[agent.id] || '';
      const tCount = Number(tokenCounts[agent.id]) || 0;
      parts.push(`---`);
      parts.push(
        `## ${agent.step}. ${role.name} (${role.titleVi})${modelLabel ? ` — Model: ${modelLabel}` : ''}${tCount > 0 ? ` · ${formatTokenCount(tCount)}` : ''}`
      );
      parts.push(outputs[agent.id]!);
      parts.push('');
    }
  });

  return parts.join('\n');
}

export function buildAgentPrompt(
  agentId: AgentId,
  mode: string,
  userTopic: string,
  previousOutputs: Partial<Record<AgentId, string>> = {},
  companyMemory = ''
): string {
  const normMode = normalizeWorkMode(mode);
  const modeMeta = getModeMeta(normMode);
  const role1 = getAgentRoleForMode(normMode, 'researcher');
  const role2 = getAgentRoleForMode(normMode, 'quant');
  const role3 = getAgentRoleForMode(normMode, 'strategist');
  const role4 = getAgentRoleForMode(normMode, 'critic');
  const selfRole = getAgentRoleForMode(normMode, agentId);
  const trimmedMemory = typeof companyMemory === 'string' ? companyMemory.trim() : '';
  const memoryBlock = trimmedMemory
    ? `\nSổ tay Ký ức Công ty (Áp dụng ràng buộc & thói quen dài hạn):\n"""\n${trimmedMemory}\n"""\n`
    : '';

  const safeOut = (key: AgentId, label: string): string =>
    previousOutputs[key] && previousOutputs[key]!.trim()
      ? previousOutputs[key]!.trim()
      : `(Bàn ${label} chưa có kết quả hoặc đang chờ chạy lại.)`;

  if (agentId === 'researcher') {
    return `Chế độ làm việc: ${modeMeta.label}
Vai trò của bạn: Bàn 1 — ${selfRole.name} (Nhịp 1/3)
${memoryBlock}
Yêu cầu / Đề bài từ CEO Phúc:
"""
${userTopic}
"""

Hãy phân tích dữ liệu nền thật súc tích (bằng bảng Markdown và gạch đầu dòng), gắn nhãn [Ước tính] trước mọi con số/giá cả/định mức chưa có nguồn kiểm chứng thực tế, và kết thúc bằng mục \`### [Tóm tắt cốt lõi]\` (tối đa 5 gạch đầu dòng) để Nhịp 2 và Nhịp 3 sử dụng.`;
  }

  if (agentId === 'quant') {
    return `Chế độ làm việc: ${modeMeta.label}
Vai trò của bạn: Bàn 2 — ${selfRole.name} (Nhịp 2/3)
${memoryBlock}
Yêu cầu / Đề bài gốc:
"""
${userTopic}
"""

Dữ liệu nền từ Nhịp 1 (${role1.name}):
"""
${safeOut('researcher', role1.name)}
"""

Hãy triển khai nhiệm vụ chuyên môn của ${selfRole.name} thật súc tích bằng bảng Markdown và gạch đầu dòng (dùng KaTeX $...$ / $$...$$ nếu có công thức hoặc con số định lượng), và kết thúc bằng mục \`### [Tóm tắt cốt lõi]\` (tối đa 5 gạch đầu dòng).`;
  }

  if (agentId === 'strategist') {
    return `Chế độ làm việc: ${modeMeta.label}
Vai trò của bạn: Bàn 3 — ${selfRole.name} (Nhịp 2/3)
${memoryBlock}
Yêu cầu / Đề bài gốc:
"""
${userTopic}
"""

Dữ liệu nền từ Nhịp 1 (${role1.name}):
"""
${safeOut('researcher', role1.name)}
"""

Hãy triển khai nhiệm vụ chuyên môn của ${selfRole.name} thật súc tích bằng bảng Markdown và gạch đầu dòng, và kết thúc bằng mục \`### [Tóm tắt cốt lõi]\` (tối đa 5 gạch đầu dòng).`;
  }

  if (agentId === 'critic') {
    return `Chế độ làm việc: ${modeMeta.label}
Vai trò của bạn: Bàn 4 — ${selfRole.name} (Nhịp 3/3)
${memoryBlock}
Yêu cầu / Đề bài gốc:
"""
${userTopic}
"""

Tóm tắt cốt lõi từ 3 bàn trước đó (ưu tiên khối [Tóm tắt cốt lõi] để tiết kiệm ngữ cảnh):
[1] Bàn 1 — ${role1.name}:
"""
${formatContextForBeat3(previousOutputs.researcher, role1.name)}
"""

[2] Bàn 2 — ${role2.name}:
"""
${formatContextForBeat3(previousOutputs.quant, role2.name)}
"""

[3] Bàn 3 — ${role3.name}:
"""
${formatContextForBeat3(previousOutputs.strategist, role3.name)}
"""

Hãy kiểm duyệt, đối chiếu giới hạn ngân sách/quỹ giờ/logic. Nếu có vượt hạn mức hoặc sai lệch, BẮT BUỘC tự tính lại và xuất ra bảng số liệu/lịch trình đã cắt giảm chuẩn xác nằm trong giới hạn cho phép để Bàn 5 (${getAgentRoleForMode(normMode, 'assistant').name}) đưa thẳng vào báo cáo cuối.`;
  }

  const getAssistantReportTemplate = (modeKey: string): string => {
    if (modeKey === 'econ_business') {
      return `Bắt buộc trình bày đúng 4 mục theo cấu trúc Markdown:
### 1. Chốt mô hình/sản phẩm cụ thể & Verdict
### 2. Bảng phân bổ vốn & chỉ số hòa vốn (BEP, lợi nhuận dự kiến)
### 3. Kế hoạch triển khai 7 ngày đầu
### 4. Rủi ro cần kiểm soát từ Critic`;
    }
    if (modeKey === 'project_plan') {
      return `Bắt buộc trình bày đúng 4 mục theo cấu trúc Markdown:
### 1. Chốt mục tiêu & Phương án tối ưu
### 2. Bảng phân bổ nguồn lực & Mốc thời gian (Timeline)
### 3. Các bước thực thi ưu tiên ngay
### 4. Điểm nghẽn & Rủi ro tiến độ`;
    }
    if (modeKey === 'study_research') {
      return `Bắt buộc trình bày đúng 4 mục theo cấu trúc Markdown:
### 1. Câu trả lời cốt lõi / Kết luận tổng hợp
### 2. Bảng so sánh kiến thức / Khái niệm trọng tâm
### 3. Lộ trình học / Áp dụng thực tế
### 4. Lỗi sai thường gặp cần tránh`;
    }
    return `Bắt buộc trình bày đúng 4 mục theo cấu trúc Markdown:
### 1. Chốt giải pháp tối ưu nhất
### 2. Bảng phân tích các yếu tố/lựa chọn then chốt
### 3. Hành động cần làm ngay
### 4. Lưu ý & Rủi ro phản biện từ Critic`;
  };

  return `Chế độ làm việc: ${modeMeta.label}
Vai trò của bạn: Bàn 5 — ${selfRole.name} (Nhịp 3/3 — Trình CEO Phúc)
${memoryBlock}
Yêu cầu / Đề bài gốc:
"""
${userTopic}
"""

Tóm tắt cốt lõi từ Bàn 1–3 & Bảng điều chỉnh từ Bàn 4:
[1] Bàn 1 — ${role1.name}:
"""
${formatContextForBeat3(previousOutputs.researcher, role1.name)}
"""

[2] Bàn 2 — ${role2.name}:
"""
${formatContextForBeat3(previousOutputs.quant, role2.name)}
"""

[3] Bàn 3 — ${role3.name}:
"""
${formatContextForBeat3(previousOutputs.strategist, role3.name)}
"""

[4] Bàn 4 — ${role4.name} (Kiểm duyệt & Bảng số liệu đã chuẩn hóa):
"""
${safeOut('critic', role4.name)}
"""

QUY TẮC BẮT BUỘC:
- Trả lời TRỰC DIỆN vào yêu cầu của CEO ngay tại mục 1 (nêu rõ Tên phương án, Sản phẩm, Công cụ, Lộ trình hoặc Giải pháp cụ thể đã chốt — tuyệt đối không tóm tắt chung chung).
- Viết tiếng Việt tự nhiên, chuẩn xác, cấm bịa từ vô nghĩa và TUYỆT ĐỐI KHÔNG dùng ký hiệu LaTeX phức tạp (như $I_0$); mọi bảng số liệu trình bày bằng bảng GFM Markdown chuẩn.
${getAssistantReportTemplate(normMode)}

Cuối phản hồi thêm mục \`### [Ký ức cần ghi nhớ]\` (3–5 gạch đầu dòng ngắn gọn BẮT BUỘC khái quát hóa thành nguyên tắc quản trị dùng chung về kỷ luật vốn, khẩu vị rủi ro, KPI chuẩn; TUYỆT ĐỐI KHÔNG lưu tên sản phẩm hay ngành hàng cụ thể của đề bài).`;
}

export function buildAssistantFollowupPrompt({
  mode,
  userTopic,
  outputs = {},
  currentSummary = '',
  followupRequest = '',
  companyMemory = '',
}: {
  mode: string;
  userTopic: string;
  outputs?: Partial<Record<AgentId, string>>;
  currentSummary?: string;
  followupRequest?: string;
  companyMemory?: string;
}): string {
  const normMode = normalizeWorkMode(mode);
  const modeMeta = getModeMeta(normMode);
  const role1 = getAgentRoleForMode(normMode, 'researcher');
  const role2 = getAgentRoleForMode(normMode, 'quant');
  const role3 = getAgentRoleForMode(normMode, 'strategist');
  const role4 = getAgentRoleForMode(normMode, 'critic');
  const trimmedMemory = typeof companyMemory === 'string' ? companyMemory.trim() : '';

  return `Chế độ làm việc: ${modeMeta.label}
Nhiệm vụ: Hỏi đáp & Chỉnh sửa trực tiếp Báo cáo Điều hành cho CEO Phúc (KHÔNG chạy lại 4 bàn trước).
${trimmedMemory ? `\nSổ tay Ký ức Công ty:\n"""\n${trimmedMemory}\n"""\n` : ''}
Đề bài gốc:
"""
${userTopic}
"""

Tóm tắt ngữ cảnh 4 chuyên gia trước đó:
[1] ${role1.name}: ${formatContextForBeat3(outputs.researcher, role1.name)}
[2] ${role2.name}: ${formatContextForBeat3(outputs.quant, role2.name)}
[3] ${role3.name}: ${formatContextForBeat3(outputs.strategist, role3.name)}
[4] ${role4.name}: ${outputs.critic ? outputs.critic.trim() : '(Chưa có)'}

Báo cáo Điều hành hiện tại:
"""
${currentSummary || '(Chưa có)'}
"""

Yêu cầu chỉnh sửa / đào sâu / hỏi thêm mới nhất từ CEO Phúc:
"""
${followupRequest}
"""

Hãy trả về phiên bản Báo cáo Điều hành ĐÃ CẬP NHẬT hoàn chỉnh (giữ cấu trúc mạch lạc, dùng bảng Markdown và KaTeX $...$/$$...$$ khi cần, súc tích bằng tiếng Việt).`;
}

export function buildMemoryExtractionPrompt({
  userTopic,
  outputs = {},
  currentMemory = '',
}: {
  userTopic: string;
  outputs?: Partial<Record<AgentId, string>>;
  currentMemory?: string;
}): string {
  return `Từ phiên làm việc dưới đây, hãy trích xuất 3–5 gạch đầu dòng thật ngắn gọn (mỗi dòng <= 18 từ) để lưu vào Sổ tay Ký ức Công ty. BẮT BUỘC khái quát hóa thành nguyên tắc quản trị dùng chung (về kỷ luật vốn, khẩu vị rủi ro, KPI chuẩn, tiêu chuẩn chất lượng), TUYỆT ĐỐI KHÔNG lưu tên sản phẩm, mặt hàng, thương hiệu hay ngành hàng cụ thể của đề bài vào sổ tay. Chỉ xuất ra các dòng bắt đầu bằng "- ", không giải thích thêm.

Ký ức hiện có:
"""
${currentMemory || '(Trống)'}
"""

Đề bài phiên này:
"""
${userTopic}
"""

Báo cáo Điều hành:
"""
${outputs.assistant || ''}
"""`;
}

export function protectMathInMarkdown(markdown: string): { markdown: string; tokens: string[] } {
  const input = String(markdown || '');
  const tokens: string[] = [];
  const stash = (value: string): string => {
    const placeholder = `@@MATH_TOKEN_${tokens.length}@@`;
    tokens.push(value);
    return placeholder;
  };

  const codeTokens: string[] = [];
  let working = input
    .replace(/```[\s\S]*?```/g, (m) => {
      const id = `@@CODE_BLOCK_${codeTokens.length}@@`;
      codeTokens.push(m);
      return id;
    })
    .replace(/`[^`\n]+`/g, (m) => {
      const id = `@@CODE_INLINE_${codeTokens.length}@@`;
      codeTokens.push(m);
      return id;
    });

  working = working
    .replace(/\$\$([\s\S]+?)\$\$/g, (m) => stash(m))
    .replace(/\\\[([\s\S]+?)\\\]/g, (m) => stash(m))
    .replace(/\\\(([\s\S]+?)\\\)/g, (m) => stash(m))
    .replace(/(?<!\\)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (m) => stash(m));

  working = working.replace(/@@CODE_(?:BLOCK|INLINE)_(\d+)@@/g, (_, idx) => codeTokens[Number(idx)] ?? '');

  return { markdown: working, tokens };
}

export function restoreMathInHtml(html: string, tokens: string[]): string {
  if (!tokens || tokens.length === 0) return String(html || '');
  return String(html || '').replace(/@@MATH_TOKEN_(\d+)@@/g, (_, idx) => {
    const raw = tokens[Number(idx)] ?? '';
    return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
}

export function normalizeMarkdownTables(mdText: string): string {
  let text = String(mdText || '').replace(/\r\n?/g, '\n');
  if (!text.includes('\n') && text.includes('\\n')) {
    text = text.replace(/\\n/g, '\n');
  }
  const lines = text.split('\n');
  const out: string[] = [];
  let inFence = false;

  const isSeparatorLine = (line: string): boolean => {
    const trimmed = String(line || '').trim();
    if (!trimmed.includes('|') && !/^\s*:?[-—–]{2,}:?\s*\|/.test(trimmed)) return false;
    const cleaned = trimmed.replace(/^[-*+]\s+/, '').replace(/^\|/, '').replace(/\|$/, '');
    const cells = cleaned.split('|');
    if (cells.length < 2) return false;
    return cells.every((c) => /^\s*:?[-—–]{2,}:?\s*$/.test(c));
  };

  const hasTablePipes = (line: string): boolean => {
    const trimmed = String(line || '').trim();
    return trimmed.includes('|') && trimmed.replace(/[^|]/g, '').length >= 1;
  };

  const formatRowPipes = (line: string): string => {
    const trimmed = String(line || '')
      .trim()
      .replace(/^[-*+]\s+(?=\|)/, '');
    const withLeft = trimmed.startsWith('|') ? trimmed : `| ${trimmed}`;
    return withLeft.endsWith('|') ? withLeft : `${withLeft} |`;
  };

  const formatSeparatorRow = (line: string): string => {
    const trimmed = String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '');
    const cells = trimmed.split('|').map((c) => {
      const s = c.trim();
      const left = s.startsWith(':');
      const right = s.endsWith(':');
      if (left && right) return ':---:';
      if (left) return ':---';
      if (right) return '---:';
      return '---';
    });
    return `| ${cells.join(' | ')} |`;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      i += 1;
      continue;
    }
    if (!inFence && i + 1 < lines.length && hasTablePipes(line) && isSeparatorLine(lines[i + 1])) {
      if (out.length > 0 && out[out.length - 1].trim() !== '') {
        out.push('');
      }
      out.push(formatRowPipes(line));
      out.push(formatSeparatorRow(lines[i + 1]));
      i += 2;
      while (i < lines.length && hasTablePipes(lines[i]) && !/^\s*```/.test(lines[i])) {
        out.push(formatRowPipes(lines[i]));
        i += 1;
      }
      if (i < lines.length && lines[i].trim() !== '') {
        out.push('');
      }
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join('\n');
}

export function escapeHtmlText(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderInlineMarkdownFallback(text: string): string {
  const safe = escapeHtmlText(text);
  return safe
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function renderFallbackMarkdownToHtml(markdown: string): string {
  const lines = normalizeMarkdownTables(markdown).split('\n');
  const html: string[] = [];
  let i = 0;

  const isSep = (l: string): boolean => /^\|\s*:?-{2,}:?(?:\s*\|\s*:?-{2,}:?)+\s*\|$/.test(String(l || '').trim());
  const splitTableCells = (l: string): string[] =>
    String(l || '')
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      html.push(
        `<pre><code${lang ? ` class="language-${escapeHtmlText(lang)}"` : ''}>${escapeHtmlText(codeLines.join('\n'))}</code></pre>`
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInlineMarkdownFallback(headingMatch[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (i + 1 < lines.length && trimmed.startsWith('|') && isSep(lines[i + 1])) {
      const headers = splitTableCells(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitTableCells(lines[i]));
        i += 1;
      }
      const thead = `<thead><tr>${headers.map((h) => `<th>${renderInlineMarkdownFallback(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(
          (r) =>
            `<tr>${headers
              .map((_, colIdx) => `<td>${renderInlineMarkdownFallback(r[colIdx] ?? '')}</td>`)
              .join('')}</tr>`
        )
        .join('')}</tbody>`;
      html.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      html.push(`<blockquote><p>${quoteLines.map(renderInlineMarkdownFallback).join('<br>')}</p></blockquote>`);
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const rawItem = lines[i].trim().replace(/^[-*+]\s+/, '');
        const checkMatch = rawItem.match(/^\[( |x|X)\]\s+(.*)$/);
        if (checkMatch) {
          const checked = checkMatch[1].toLowerCase() === 'x';
          items.push(
            `<li><input type="checkbox" disabled${checked ? ' checked' : ''} /> ${renderInlineMarkdownFallback(checkMatch[2])}</li>`
          );
        } else {
          items.push(`<li>${renderInlineMarkdownFallback(rawItem)}</li>`);
        }
        i += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${renderInlineMarkdownFallback(lines[i].trim().replace(/^\d+[.)]\s+/, ''))}</li>`);
        i += 1;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,4}\s+|```|>\s?|[-*+]\s+|\d+[.)]\s+)/.test(lines[i].trim()) &&
      !(i + 1 < lines.length && lines[i].trim().startsWith('|') && isSep(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    if (paraLines.length > 0) {
      html.push(`<p>${paraLines.map(renderInlineMarkdownFallback).join('<br>')}</p>`);
    }
  }
  return html.join('\n');
}

export function wrapHtmlTables(htmlStr: string): string {
  return String(htmlStr || '').replace(
    /(<div class="table-wrap">\s*)?<table\b[\s\S]*?<\/table>(\s*<\/div>)?/gi,
    (match, openWrap, closeWrap) => {
      if (openWrap && closeWrap) return match;
      const cleanTable = match.replace(/^<div class="table-wrap">\s*/i, '').replace(/\s*<\/div>$/i, '');
      return `<div class="table-wrap">${cleanTable}</div>`;
    }
  );
}

export function sanitizeReportHtml(htmlStr: string, sanitizer: SanitizerLike | null = null): string {
  if (sanitizer && typeof sanitizer.sanitize === 'function') {
    return sanitizer.sanitize(String(htmlStr || ''), {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel'],
    });
  }
  return String(htmlStr || '');
}

export function renderMarkdownToHtml(
  mdText: string,
  markedLib: MarkedLike | null = null,
  sanitizer: SanitizerLike | null = null
): string {
  const normalized = normalizeMarkdownTables(mdText);
  const { markdown, tokens } = protectMathInMarkdown(normalized);
  let rawHtml = '';
  if (markedLib && typeof markedLib.parse === 'function') {
    try {
      rawHtml = markedLib.parse(markdown, { gfm: true, breaks: true });
    } catch {
      rawHtml = renderFallbackMarkdownToHtml(markdown);
    }
  } else {
    rawHtml = renderFallbackMarkdownToHtml(markdown);
  }

  rawHtml = String(rawHtml || '').replace(/<p>([\s\S]*?)<\/p>/gi, (full, inner: string) => {
    const decoded = inner.replace(/<br\s*\/?>/gi, '\n');
    if (/\|[^\n]+\|\s*\n\s*\|\s*:?-{2,}:?/.test(decoded)) {
      return renderFallbackMarkdownToHtml(decoded);
    }
    return full;
  });

  rawHtml = wrapHtmlTables(rawHtml);
  const restoredHtml = restoreMathInHtml(rawHtml, tokens);
  return sanitizeReportHtml(restoredHtml, sanitizer);
}

export function parseApiErrorBody(errorBodyText: string): {
  parsedMsg: string;
  parsedCode: number;
  parsedStatusStr: string;
} {
  let parsedMsg = '';
  let parsedCode = 0;
  let parsedStatusStr = '';
  try {
    const json = JSON.parse(errorBodyText || '{}') as OpenRouterUsagePayload & { message?: string };
    parsedMsg = json?.error?.message || json?.message || '';
    parsedCode = Number(json?.error?.code) || 0;
    parsedStatusStr = typeof json?.error?.status === 'string' ? json.error.status : '';
  } catch {
    parsedMsg = errorBodyText || '';
  }
  return { parsedMsg, parsedCode, parsedStatusStr };
}

export function buildExactApiErrorInfo(
  provider: string,
  status: number,
  errorBodyText: string,
  rawError: TaggedApiError | Error | null,
  modelId = ''
): ApiErrorInfo {
  if ((rawError as TaggedApiError | null)?.isTimeout) {
    return {
      status: 408,
      errorType: 'timeout',
      shortLabel: 'Lỗi Timeout >35s',
      message:
        rawError?.message ||
        `Lỗi Timeout >35s khi gọi model "${modelId || 'hiện tại'}". Bạn có thể bấm "Chạy lại" riêng nhân viên này.`,
    };
  }

  const { parsedMsg, parsedCode, parsedStatusStr } = parseApiErrorBody(errorBodyText);
  const effectiveStatus = Number(status) || parsedCode || 0;
  const combined = `${parsedMsg} ${parsedStatusStr} ${rawError?.message || ''}`.trim();
  const providerLabel = provider === 'gemini' ? 'Google Gemini' : 'OpenRouter';

  if (
    effectiveStatus === 429 ||
    (![400, 401, 402, 403, 404].includes(effectiveStatus) &&
      effectiveStatus < 500 &&
      /rate limit|too many requests|quota|resource_exhausted|overloaded/i.test(combined))
  ) {
    return {
      status: effectiveStatus || 429,
      errorType: 'api',
      shortLabel: 'Lỗi 429: Quá lượt gọi/phút',
      message: `Lỗi 429: Quá lượt gọi/phút (${providerLabel} - "${modelId || 'hiện tại'}") sau khi tự động chờ 6s thử lại. Bạn có thể bấm "Chạy lại" riêng nhân viên này.`,
    };
  }
  if (effectiveStatus === 402 || /insufficient credits|payment required|more credits/i.test(combined)) {
    return {
      status: 402,
      errorType: 'api',
      shortLabel: 'Lỗi 402: Hết hạn mức ngày',
      message: `Lỗi 402: Hết hạn mức ngày / không đủ Credits (${providerLabel}) cho model "${modelId || 'hiện tại'}".`,
    };
  }
  if (effectiveStatus === 400) {
    const exactMsg = (parsedMsg || rawError?.message || '').trim() || 'Yêu cầu không hợp lệ';
    return {
      status: 400,
      errorType: 'api',
      shortLabel: `Lỗi 400: ${exactMsg}`,
      message: `Lỗi 400 (${providerLabel}): ${exactMsg}`,
    };
  }
  if (
    effectiveStatus === 401 ||
    /invalid api key|api_key_invalid|unauthorized|no auth credentials/i.test(combined)
  ) {
    return {
      status: effectiveStatus || 401,
      errorType: 'api',
      shortLabel: `Lỗi ${effectiveStatus || 401}: Sai API Key`,
      message: `Lỗi ${effectiveStatus || 401}: Sai API Key ${providerLabel} hoặc khóa đã hết hạn. Vui lòng kiểm tra lại API Key.`,
    };
  }
  if (effectiveStatus === 403) {
    const isQuota = /quota|limit/i.test(combined);
    return {
      status: 403,
      errorType: 'api',
      shortLabel: isQuota ? 'Lỗi 403: Hết hạn mức / Bị chặn' : 'Lỗi 403: Không có quyền API',
      message: `Lỗi 403 (${providerLabel}${modelId ? ` · "${modelId}"` : ''}): ${parsedMsg || 'Từ chối quyền truy cập.'}`,
    };
  }
  if (effectiveStatus === 404) {
    return {
      status: 404,
      errorType: 'api',
      shortLabel: 'Lỗi 404: Không tìm thấy model',
      message: `Lỗi 404: Không tìm thấy model "${modelId || 'đã chọn'}" trên ${providerLabel}.`,
    };
  }
  if (effectiveStatus >= 500) {
    return {
      status: effectiveStatus,
      errorType: 'api',
      shortLabel: `Lỗi ${effectiveStatus}: Server quá tải`,
      message: `Lỗi ${effectiveStatus}: Máy chủ ${providerLabel} đang tạm quá tải sau khi thử lại. Bạn có thể bấm "Chạy lại" riêng nhân viên này.`,
    };
  }
  if (effectiveStatus > 0) {
    const compact = parsedMsg ? parsedMsg.slice(0, 30) : 'Lỗi API';
    return {
      status: effectiveStatus,
      errorType: 'api',
      shortLabel: `Lỗi ${effectiveStatus}: ${compact}`,
      message: `Lỗi ${effectiveStatus} (${providerLabel}): ${parsedMsg || rawError?.message || 'Không rõ nguyên nhân.'}`,
    };
  }
  return {
    status: 0,
    errorType: 'network',
    shortLabel: 'Lỗi mạng: Không thể kết nối',
    message: `Lỗi mạng: Không thể kết nối đến ${providerLabel} API (${combined || 'Lỗi mạng hoặc bị trình duyệt chặn'}).`,
  };
}

export function classifyOpenRouterError(
  status: number,
  errorBodyText: string,
  rawError: Error | null,
  modelId = ''
): string {
  return buildExactApiErrorInfo('openrouter', status, errorBodyText, rawError, modelId).message;
}

export function extractOpenRouterContent(payload: unknown): string {
  const extractTextValue = (val: unknown): string => {
    if (typeof val === 'string') return val.trim();
    if (Array.isArray(val)) {
      return val
        .map((part) =>
          typeof part === 'string'
            ? part
            : ((part as { text?: string; content?: string } | null)?.text ||
                (part as { content?: string } | null)?.content ||
                '')
        )
        .join('')
        .trim();
    }
    return '';
  };
  const message = (payload as OpenRouterUsagePayload | null | undefined)?.choices?.[0]?.message;
  const contentText = extractTextValue(message?.content);
  if (contentText) return contentText;
  return (
    extractTextValue(message?.reasoning) ||
    extractTextValue(message?.reasoning_content) ||
    extractTextValue(message?.reasoning_details)
  );
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      reject(abortErr);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      reject(abortErr);
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function callOpenRouterAgent(
  apiKey: string,
  modelId: string,
  promptText: string,
  signal?: AbortSignal,
  options: OpenRouterCallOptions = {}
): Promise<OpenRouterCallResult> {
  const trimmedKey = (apiKey || '').trim();
  const trimmedModel = (modelId || '').trim();
  if (!trimmedModel) {
    throw new Error('Vui lòng chọn hoặc nhập mã model OpenRouter hợp lệ.');
  }

  const fetchImpl = options.fetchFn || globalThis.fetch;
  const maxRetries =
    typeof options.maxRetries === 'number' ? options.maxRetries : RETRY_CONFIG.maxRetries;
  const retryDelayMs =
    typeof options.retryDelayMs === 'number' ? options.retryDelayMs : RETRY_CONFIG.retryDelayMs;
  const timeoutMs =
    typeof options.timeoutMs === 'number' ? options.timeoutMs : RETRY_CONFIG.requestTimeoutMs;
  const maxTokens =
    typeof options.maxTokens === 'number' && options.maxTokens > 0
      ? options.maxTokens
      : options.omitMaxTokens
        ? undefined
        : RETRY_CONFIG.defaultMaxTokens;
  const fallbackCandidates =
    Array.isArray(options.fallbackModels) && options.fallbackModels.length > 0
      ? options.fallbackModels
      : RETRY_CONFIG.autoFallbackModels;
  const explicitFallback =
    typeof options.fallbackModel === 'string' && options.fallbackModel.trim()
      ? options.fallbackModel.trim()
      : '';
  const orderedFallbacks = explicitFallback
    ? [explicitFallback, ...fallbackCandidates.filter((m) => m !== explicitFallback)]
    : fallbackCandidates;
  const onRetry = typeof options.onRetry === 'function' ? options.onRetry : null;
  const onFallback = typeof options.onFallback === 'function' ? options.onFallback : null;
  const systemPrompt = typeof options.systemPrompt === 'string' ? options.systemPrompt.trim() : '';

  const messages = systemPrompt
    ? [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText },
      ]
    : [{ role: 'user', content: promptText }];

  async function executeFetchWithTimeout(activeModel: string): Promise<{
    response: Response;
    rawBody: string;
    payload: OpenRouterUsagePayload | null;
  }> {
    if (signal?.aborted) {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    const attemptCtrl = new AbortController();
    let timedOut = false;
    const onOuterAbort = () => attemptCtrl.abort();
    signal?.addEventListener('abort', onOuterAbort, { once: true });
    const timerId =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            attemptCtrl.abort();
          }, timeoutMs)
        : null;

    const payloadBody: Record<string, unknown> = {
      model: activeModel,
      messages,
    };
    if (maxTokens) {
      payloadBody.max_tokens = maxTokens;
    }

    let response: Response;
    let rawBody = '';
    try {
      response = await fetchImpl(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
          'Content-Type': 'application/json',
        },
        signal: attemptCtrl.signal,
        body: JSON.stringify(payloadBody),
      });
      rawBody = await response.text();
    } catch (err) {
      if (timedOut && !signal?.aborted) {
        const timeoutErr: TaggedApiError = new Error(
          `Lỗi Timeout >${Math.round(timeoutMs / 1000)}s khi gọi model "${activeModel}". Bạn có thể bấm "Chạy lại" riêng nhân viên này.`
        );
        timeoutErr.name = 'TimeoutError';
        timeoutErr.isTimeout = true;
        timeoutErr.shortLabel = 'Lỗi Timeout >35s';
        timeoutErr.errorType = 'timeout';
        throw timeoutErr;
      }
      if ((err as Error | null)?.name === 'AbortError' || signal?.aborted) {
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      const info = buildExactApiErrorInfo('openrouter', 0, '', err as Error, activeModel);
      const netErr: TaggedApiError = new Error(info.message);
      netErr.isNetworkError = true;
      netErr.status = 0;
      netErr.shortLabel = info.shortLabel;
      netErr.errorType = info.errorType;
      throw netErr;
    } finally {
      if (timerId !== null) clearTimeout(timerId);
      signal?.removeEventListener('abort', onOuterAbort);
    }

    let payload: OpenRouterUsagePayload | null = null;
    try {
      payload = rawBody ? (JSON.parse(rawBody) as OpenRouterUsagePayload) : null;
    } catch {
      payload = null;
    }

    return { response, rawBody, payload };
  }

  const totalAttempts = 1 + Math.max(0, maxRetries);
  let activeModel = trimmedModel;
  let fallbackCursor = 0;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      const { response, rawBody, payload } = await executeFetchWithTimeout(activeModel);

      if (!response.ok || payload?.error) {
        const status = response.ok ? Number(payload?.error?.code) || 400 : response.status;
        const isRetryable = RETRY_CONFIG.retryableStatuses.includes(status);
        if (isRetryable && attempt < totalAttempts - 1) {
          if (trimmedModel === DEFAULT_FREE_MODEL && fallbackCursor < orderedFallbacks.length) {
            const nextModel = orderedFallbacks[fallbackCursor++];
            onFallback?.(nextModel, String(status));
            activeModel = nextModel;
          }
          onRetry?.(attempt + 1, maxRetries, status);
          await abortableSleep(retryDelayMs, signal);
          continue;
        }
        const info = buildExactApiErrorInfo('openrouter', status, rawBody, null, activeModel);
        const apiErr: TaggedApiError = new Error(info.message);
        apiErr.status = info.status;
        apiErr.shortLabel = info.shortLabel;
        apiErr.errorType = info.errorType;
        throw apiErr;
      }

      const text = extractOpenRouterContent(payload);
      if (!text) {
        const reason = payload?.choices?.[0]?.finish_reason || 'NO_CONTENT';
        const emptyErr: TaggedApiError = new Error(
          `Model "${activeModel}" không trả về nội dung (Mã kết thúc: ${reason}).`
        );
        emptyErr.isEmptyContent = true;
        emptyErr.shortLabel = `Lỗi nội dung (${reason})`;
        emptyErr.errorType = 'api';
        throw emptyErr;
      }

      return {
        text,
        totalTokens: extractOpenRouterUsageTokens(payload),
        actualModel: extractOpenRouterActualModel(payload, activeModel),
      };
    } catch (err) {
      const tagged = err as TaggedApiError;
      if (tagged?.name === 'AbortError' && !tagged?.isTimeout) throw err;
      const canRetryNetwork = Boolean(tagged?.isNetworkError) && attempt < totalAttempts - 1;
      const canTimeoutFallback =
        Boolean(tagged?.isTimeout) &&
        trimmedModel === DEFAULT_FREE_MODEL &&
        fallbackCursor < orderedFallbacks.length &&
        !signal?.aborted;

      if (canRetryNetwork) {
        if (trimmedModel === DEFAULT_FREE_MODEL && fallbackCursor < orderedFallbacks.length) {
          const nextModel = orderedFallbacks[fallbackCursor++];
          onFallback?.(nextModel, 'network');
          activeModel = nextModel;
        }
        onRetry?.(attempt + 1, maxRetries, 'network');
        await abortableSleep(retryDelayMs, signal);
        continue;
      }

      if (canTimeoutFallback) {
        const nextModel = orderedFallbacks[fallbackCursor++];
        onFallback?.(nextModel, 'timeout');
        activeModel = nextModel;
        if (attempt >= totalAttempts - 1) {
          const { response, rawBody, payload } = await executeFetchWithTimeout(activeModel);
          if (!response.ok || payload?.error) {
            const status = response.ok ? Number(payload?.error?.code) || 400 : response.status;
            const info = buildExactApiErrorInfo('openrouter', status, rawBody, null, activeModel);
            const apiErr: TaggedApiError = new Error(info.message);
            apiErr.status = info.status;
            apiErr.shortLabel = info.shortLabel;
            apiErr.errorType = info.errorType;
            throw apiErr;
          }
          const text = extractOpenRouterContent(payload);
          if (!text) {
            throw new Error(`Model "${activeModel}" không trả về nội dung.`);
          }
          return {
            text,
            totalTokens: extractOpenRouterUsageTokens(payload),
            actualModel: extractOpenRouterActualModel(payload, activeModel),
          };
        }
        continue;
      }

      throw err;
    }
  }

  throw new Error(`Không nhận được phản hồi hợp lệ từ model "${activeModel}".`);
}

export async function callOpenRouterWithKeyFallback({
  primaryKey,
  fallbackKey = '',
  modelId,
  promptText,
  signal,
  options = {},
}: {
  primaryKey: string;
  fallbackKey?: string;
  modelId: string;
  promptText: string;
  signal?: AbortSignal;
  options?: OpenRouterCallOptions;
}): Promise<OpenRouterKeyFallbackResult> {
  const cleanPrimary = String(primaryKey || '').trim();
  const cleanFallback = String(fallbackKey || '').trim();
  const globalOrPrimaryKey = cleanFallback || cleanPrimary;
  const cleanModel = String(modelId || '').trim();
  const waitMs =
    typeof options.retryDelayMs === 'number'
      ? options.retryDelayMs
      : RETRY_CONFIG.silentRetryDelayMs;
  const singleShotOpts: OpenRouterCallOptions = {
    ...options,
    maxRetries: 0,
    maxTokens:
      typeof options.maxTokens === 'number' && options.maxTokens > 0
        ? options.maxTokens
        : RETRY_CONFIG.defaultMaxTokens,
  };

  const resolveFinalRescueModel = (): string => {
    const pool = Array.isArray(RETRY_CONFIG.stableRescueModels) ? RETRY_CONFIG.stableRescueModels : [];
    const autoRouter = pool.find((m) => m === DEFAULT_FREE_MODEL);
    return autoRouter || DEFAULT_FREE_MODEL;
  };

  const isSilentRescuableError = (err: TaggedApiError): boolean => {
    if (err?.name === 'AbortError' && !err?.isTimeout) return false;
    const st = Number(err?.status) || 0;
    if (RETRY_CONFIG.keyFallbackStatuses.includes(st)) return true;
    if (err?.isEmptyContent || err?.isNetworkError || err?.isTimeout) return true;
    return false;
  };

  // Lần 1: Gọi bằng API Key ưu tiên (Key riêng nếu có, hoặc Key gốc) & Model đã chọn
  try {
    const res1 = await callOpenRouterAgent(cleanPrimary, cleanModel, promptText, signal, singleShotOpts);
    return { ...res1, attemptUsed: 1, usedKeyFallback: false, usedModelFallback: false };
  } catch (err1Raw) {
    const err1 = err1Raw as TaggedApiError;
    if (err1?.name === 'AbortError' && !err1?.isTimeout) throw err1;
    const err1Status = Number(err1?.status) || 0;
    const isModel404 = err1Status === 404;
    const isModel400 = err1Status === 400 && Boolean(options.rescueOnModelError);
    const shouldAttempt2 = !isModel404 && !isModel400 && isSilentRescuableError(err1);

    if (!shouldAttempt2 && !isModel404 && !isModel400) {
      throw err1;
    }

    const switchedToGlobal = Boolean(cleanFallback) && cleanFallback !== cleanPrimary;
    const finalRescueModel = resolveFinalRescueModel();

    // Lần 2: Chờ 3s, chuyển sang Key gốc ở cột trái và giữ nguyên Model (trừ lỗi 404/400 bỏ qua sang bước đổi model)
    if (shouldAttempt2) {
      options?.onSilentRetry?.(2, 3, {
        status: err1Status || (err1?.isEmptyContent ? 'empty' : err1?.isTimeout ? 'timeout' : 'network'),
        switchedKey: switchedToGlobal,
        modelId: cleanModel,
      });
      if (switchedToGlobal) {
        options?.onKeyFallback?.(err1Status, err1);
      }
      if (waitMs > 0) {
        await abortableSleep(waitMs, signal);
      }
      try {
        const res2 = await callOpenRouterAgent(
          globalOrPrimaryKey,
          cleanModel,
          promptText,
          signal,
          singleShotOpts
        );
        return {
          ...res2,
          attemptUsed: 2,
          usedKeyFallback: switchedToGlobal,
          usedModelFallback: false,
          fallbackFromStatus: err1Status,
        };
      } catch (err2Raw) {
        const err2 = err2Raw as TaggedApiError;
        if (err2?.name === 'AbortError' && !err2?.isTimeout) throw err2;
        const err2Status = Number(err2?.status) || 0;

        // Lần 3: Chờ 3s, dùng Key gốc và bắt buộc chuyển sang model dự phòng cuối cùng 'openrouter/free'
        options?.onSilentRetry?.(3, 3, {
          status: err2Status || (err2?.isEmptyContent ? 'empty' : err2?.isTimeout ? 'timeout' : 'network'),
          switchedKey: switchedToGlobal,
          rescueModel: finalRescueModel,
        });
        options?.onFallback?.(finalRescueModel, String(err2Status || 'rescue'));
        if (waitMs > 0) {
          await abortableSleep(waitMs, signal);
        }
        const res3 = await callOpenRouterAgent(
          globalOrPrimaryKey,
          finalRescueModel,
          promptText,
          signal,
          singleShotOpts
        );
        return {
          ...res3,
          attemptUsed: 3,
          usedKeyFallback: switchedToGlobal,
          usedModelFallback: cleanModel !== finalRescueModel,
          fallbackFromStatus: err2Status || err1Status,
          rescueModel: finalRescueModel,
        };
      }
    }

    // Lỗi HTTP 404 (hoặc 400 với rescueOnModelError): Cứu hộ trực tiếp bằng model dự phòng cuối cùng 'openrouter/free' và Key gốc
    options?.onSilentRetry?.(3, 3, {
      status: err1Status,
      switchedKey: switchedToGlobal,
      rescueModel: finalRescueModel,
    });
    options?.onFallback?.(finalRescueModel, String(err1Status));
    if (waitMs > 0) {
      await abortableSleep(waitMs, signal);
    }
    const resRescue = await callOpenRouterAgent(
      globalOrPrimaryKey,
      finalRescueModel,
      promptText,
      signal,
      singleShotOpts
    );
    return {
      ...resRescue,
      attemptUsed: 3,
      usedKeyFallback: switchedToGlobal,
      usedModelFallback: cleanModel !== finalRescueModel,
      fallbackFromStatus: err1Status,
      rescueModel: finalRescueModel,
    };
  }
}

export async function callAgentModel(
  apiKey: string,
  modelId: string,
  promptText: string,
  signal?: AbortSignal,
  options: OpenRouterCallOptions = {}
): Promise<OpenRouterCallResult> {
  return callOpenRouterAgent(apiKey, modelId, promptText, signal, options);
}

export interface AgentExecutionOutcome {
  agent?: { id: AgentId | string; name: string };
  ok: boolean;
  error?: string;
}

export async function runHybrid3BeatSequence({
  runAgent,
  beat1CooldownMs = RETRY_CONFIG.beat1CooldownMs,
  staggerDelayMs = RETRY_CONFIG.staggerDelayMs,
  signal,
  onBeatChange,
}: {
  runAgent: (agentId: AgentId, staggerMs: number) => Promise<AgentExecutionOutcome>;
  beat1CooldownMs?: number;
  staggerDelayMs?: number;
  signal?: AbortSignal;
  onBeatChange?: (beat: 'beat1' | 'beat1_cooldown' | 'beat2' | 'beat3_critic' | 'beat3_assistant') => void;
}): Promise<{ ok: boolean; failedBeat: number | null; failedAgents: AgentExecutionOutcome[] }> {
  // Nhịp 1: Researcher chạy độc lập đầu tiên
  onBeatChange?.('beat1');
  const beat1Res = await runAgent('researcher', 0);
  if (!beat1Res || !beat1Res.ok) {
    return {
      ok: false,
      failedBeat: 1,
      failedAgents: beat1Res ? [beat1Res] : [{ agent: AGENTS[0], ok: false, error: 'Lỗi Researcher' }],
    };
  }

  // Khoảng nghỉ 3 giây sau khi Nhịp 1 hoàn thành trước khi kích hoạt Nhịp 2 (Anti-Rate-Limit)
  if (beat1CooldownMs > 0) {
    onBeatChange?.('beat1_cooldown');
    await abortableSleep(beat1CooldownMs, signal);
  }

  // Nhịp 2: Quant & Finance + Strategist nhận kết quả Researcher và chạy song song (trễ nhau 4s)
  onBeatChange?.('beat2');
  const beat2Ids: AgentId[] = ['quant', 'strategist'];
  const settled = await Promise.allSettled(
    beat2Ids.map((id, idx) => runAgent(id, idx * staggerDelayMs))
  );
  const beat2Failures: AgentExecutionOutcome[] = [];
  for (let i = 0; i < settled.length; i++) {
    const item = settled[i];
    if (item.status === 'fulfilled' && item.value && !item.value.ok) {
      beat2Failures.push(item.value);
    } else if (item.status === 'rejected') {
      if ((item.reason as Error | null)?.name === 'AbortError') throw item.reason;
      beat2Failures.push({
        agent: AGENTS.find((a) => a.id === beat2Ids[i]) || { id: beat2Ids[i], name: beat2Ids[i] },
        ok: false,
        error: (item.reason as Error | null)?.message || 'Lỗi API',
      });
    }
  }
  if (beat2Failures.length > 0) {
    return { ok: false, failedBeat: 2, failedAgents: beat2Failures };
  }

  // Nhịp 3A: Critic nhận kết quả của cả 3 Agent trên để phản biện rủi ro
  onBeatChange?.('beat3_critic');
  const criticRes = await runAgent('critic', 0);
  if (!criticRes || !criticRes.ok) {
    return {
      ok: false,
      failedBeat: 3,
      failedAgents: criticRes ? [criticRes] : [{ agent: AGENTS[3], ok: false, error: 'Lỗi Critic' }],
    };
  }

  // Nhịp 3B: Nhân viên thứ 2 trong Nhịp 3 (Trợ lý CEO) trễ hơn Critic 4 giây trước khi tổng hợp
  onBeatChange?.('beat3_assistant');
  const assistantRes = await runAgent('assistant', staggerDelayMs);
  if (!assistantRes || !assistantRes.ok) {
    return {
      ok: false,
      failedBeat: 3,
      failedAgents: assistantRes
        ? [assistantRes]
        : [{ agent: ASSISTANT_AGENT, ok: false, error: 'Lỗi Trợ lý CEO' }],
    };
  }

  return { ok: true, failedBeat: null, failedAgents: [] };
}
