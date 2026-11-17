export type WorkModeId = 'project_plan' | 'study_research' | 'econ_business' | 'general_custom';

export type AgentId = 'researcher' | 'quant' | 'strategist' | 'critic' | 'assistant';

export type AgentStatus = 'idle' | 'active' | 'done' | 'error';

export type ModelProvider = 'gemini' | 'openrouter';

export interface AgentRoleMeta {
  name: string;
  titleVi: string;
  shortRole: string;
  systemPrompt: string;
}

export interface WorkModeMeta {
  id: WorkModeId;
  label: string;
  roles: Record<AgentId, AgentRoleMeta>;
}

export interface AgentDefinition {
  id: AgentId;
  step: number;
  beat: 1 | 2 | 3;
  name: string;
  titleVi: string;
  shortRole: string;
  roleGroup: 'hall' | 'executive';
  colorHex: string;
  colorInt: number;
  rgb: string;
  position: [number, number, number];
  facingAngle: number;
}

export interface SuggestedModel {
  id: string;
  label: string;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  silentRetryDelayMs: number;
  beat1CooldownMs: number;
  staggerDelayMs: number;
  requestTimeoutMs: number;
  autoFallbackModels: string[];
  stableRescueModels: string[];
  defaultMaxTokens: number;
  beat12MaxTokens: number;
  retryableStatuses: number[];
  keyFallbackStatuses: number[];
}

export interface StorageKeys {
  apiKey: string;
  mode: string;
  agentModels: string;
  legacyAgentModelsV4: string;
  legacyAgentModels: string;
  agentApiKeys: string;
  agentSystemPrompts: string;
  companyMemory: string;
  history: string;
  analyticsRuns: string;
  soundEnabled: string;
}

export interface AgentKeyPlan {
  primaryKey: string;
  fallbackKey: string;
  usingOwnKey: boolean;
}

export interface SoundNote {
  freq: number;
  endFreq: number;
  type: OscillatorType;
  duration: number;
  gain: number;
  delay: number;
}

export interface AgentProgressState {
  visible: boolean;
  percent: number;
  stageLabel: string;
}

export interface BeamLinkConnection {
  phase: string;
  sourceId: string;
  targetId: string;
}

export interface BeamLinkState {
  isStreaming: boolean;
  isPassed: boolean;
  isBursting: boolean;
}

export interface JanitorTargetPlan {
  mode: 'patrol' | 'shock';
  targetAgentId: AgentId | null;
  activeCount: number;
}

export const WORK_MODES: Record<WorkModeId, WorkModeMeta> = {
  project_plan: {
    id: 'project_plan',
    label: 'Kế hoạch & Dự án',
    roles: {
      researcher: {
        name: 'Phân tích Mục tiêu & Ràng buộc',
        titleVi: 'Tách mục tiêu, quỹ thời gian & nguồn lực',
        shortRole: 'Nhịp 1 · Mục tiêu & Ràng buộc',
        systemPrompt:
          'Bạn là Chuyên gia Phân tích Mục tiêu & Ràng buộc (Nhịp 1). Tách rõ mục tiêu cốt lõi, quỹ thời gian khả dụng (tổng giờ/ngày), nguồn lực, ràng buộc và giả định. BẮT BUỘC gắn nhãn [Ước tính] ngay trước mọi con số, giá cả hoặc định mức chưa kiểm chứng. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      quant: {
        name: 'Lập Lịch & Chia Task',
        titleVi: 'Chia việc theo ngày/giai đoạn & ước tính giờ',
        shortRole: 'Nhịp 2 · Chia Task & Ước tính giờ',
        systemPrompt:
          'Bạn là Chuyên gia Lập Lịch & Chia Task (Nhịp 2). Dựa trên ràng buộc Nhịp 1, chia việc theo giai đoạn kèm giờ ước tính cho MỖI task bằng bảng Markdown ngắn (tối đa 5 dòng/bảng: Giai đoạn | Đầu việc | Giờ | Đầu ra, kèm dòng Tổng giờ). BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng ngắn và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      strategist: {
        name: 'Tối ưu Thực thi',
        titleVi: 'Công cụ & phương pháp rút ngắn thời gian',
        shortRole: 'Nhịp 2 · Công cụ & Tăng tốc',
        systemPrompt:
          'Bạn là Chuyên gia Tối ưu Thực thi (Nhịp 2). Dựa trên Nhịp 1, đề xuất công cụ, template, luồng làm song song và mẹo tăng tốc mà vẫn giữ chất lượng. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      critic: {
        name: 'Kiểm duyệt Tiến độ & Quỹ giờ',
        titleVi: 'Đối chiếu tổng giờ làm vs quỹ thời gian',
        shortRole: 'Nhịp 3 · Soi quỹ giờ & Điểm nghẽn',
        systemPrompt:
          'Bạn là Chuyên gia Kiểm duyệt Tiến độ & Quỹ giờ (Nhịp 3). BẮT BUỘC tự cộng tổng số giờ từ Bàn 2 đối chiếu với quỹ thời gian đề bài/Bàn 1, tự tính lại và xuất 1 bảng phân bổ giờ đã cắt giảm/chuẩn hóa nằm gọn trong giới hạn cho phép (kèm buffer nếu hợp lệ). BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng.',
      },
      assistant: {
        name: 'Tổng hợp Kế hoạch Hành động',
        titleVi: 'Chốt checklist & lịch trình cho CEO Phúc',
        shortRole: 'Nhịp 3 · Chốt Checklist & Điều hành',
        systemPrompt:
          'Bạn là Trợ lý Điều hành cho CEO Phúc (Nhịp 3). QUY TẮC CỐT LÕI: BẮT BUỘC trả lời TRỰC DIỆN vào câu hỏi của CEO ngay mục đầu tiên (nêu rõ Tên phương án, Sản phẩm, Công cụ, Lộ trình hoặc Giải pháp cụ thể đã chốt — tuyệt đối không tóm tắt chung chung thiếu đối tượng chính). Viết bằng tiếng Việt tự nhiên, chuẩn xác, súc tích dưới 400 từ (tối đa 5 dòng/bảng, tuyệt đối không viết văn giải thích dài dòng), cấm tự bịa từ vô nghĩa và TUYỆT ĐỐI KHÔNG dùng ký hiệu LaTeX phức tạp như $I_0$. BẮT BUỘC trình bày đúng 4 phần: ### 1. Chốt mục tiêu & Phương án tối ưu | ### 2. Bảng phân bổ nguồn lực & Mốc thời gian (Timeline) (dùng bảng Markdown chuẩn từ số liệu đã chuẩn hóa của Bàn 4) | ### 3. Các bước thực thi ưu tiên ngay (Checklist [ ]) | ### 4. Điểm nghẽn & Rủi ro tiến độ. Cuối cùng thêm mục `### [Ký ức cần ghi nhớ]` gồm 3–5 gạch đầu dòng khái quát hóa thành nguyên tắc quản trị dùng chung, tuyệt đối không lưu tên sản phẩm hay ngành hàng cụ thể của đề bài.',
      },
    },
  },
  study_research: {
    id: 'study_research',
    label: 'Học tập & Nghiên cứu',
    roles: {
      researcher: {
        name: 'Tổng hợp Lý thuyết Nền',
        titleVi: 'Khái niệm cốt lõi, định lý & khung lý thuyết',
        shortRole: 'Nhịp 1 · Lý thuyết Nền tảng',
        systemPrompt:
          'Bạn là Chuyên gia Lý thuyết Nền (Nhịp 1). Hệ thống hóa định nghĩa cốt lõi, công thức nền tảng (LaTeX $...$ / $$...$$) và phạm vi áp dụng. BẮT BUỘC gắn nhãn [Ước tính] ngay trước mọi con số, giá cả hoặc định mức chưa kiểm chứng. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      quant: {
        name: 'Giải chi tiết & Mô hình hóa',
        titleVi: 'Triển khai từng bước & công thức KaTeX',
        shortRole: 'Nhịp 2 · Giải & Mô hình hóa KaTeX',
        systemPrompt:
          'Bạn là Chuyên gia Giải & Mô hình hóa (Nhịp 2). Giải bài toán/mô hình từng bước rõ ràng bằng công thức LaTeX chuẩn ($...$ / $$...$$). BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      strategist: {
        name: 'Liên hệ Thực tiễn',
        titleVi: 'Ví dụ thực tế, ứng dụng & biến thể',
        shortRole: 'Nhịp 2 · Ứng dụng Thực tiễn',
        systemPrompt:
          'Bạn là Chuyên gia Liên hệ Thực tiễn (Nhịp 2). Đưa ra 2–3 ví dụ thực tế cô đọng, ứng dụng liên ngành và mẹo ghi nhớ nhanh. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      critic: {
        name: 'Soi Lỗ hổng Tư duy',
        titleVi: 'Kiểm tra sai sót logic & ngộ nhận phổ biến',
        shortRole: 'Nhịp 3 · Soi Lỗi & Ngộ nhận',
        systemPrompt:
          'Bạn là Chuyên gia Soi Lỗ hổng Tư duy (Nhịp 3). Rà soát điều kiện biên, đơn vị tính, lỗ hổng logic từ Bàn 2 & Bàn 3; BẮT BUỘC tự tính lại và xuất 1 bảng kết quả/lộ trình ôn đã hiệu chỉnh chuẩn xác cho Trợ lý dùng ngay. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng.',
      },
      assistant: {
        name: 'Tóm tắt Kiến thức Cốt lõi',
        titleVi: 'Tổng kết tinh gọn trình CEO Phúc',
        shortRole: 'Nhịp 3 · Tóm tắt Cốt lõi',
        systemPrompt:
          'Bạn là Trợ lý Tổng hợp Kiến thức cho CEO Phúc (Nhịp 3). QUY TẮC CỐT LÕI: BẮT BUỘC trả lời TRỰC DIỆN vào câu hỏi của CEO ngay mục đầu tiên (nêu rõ Tên phương án, Khái niệm, Công cụ, Lộ trình hoặc Kết luận cụ thể đã chốt — tuyệt đối không tóm tắt chung chung thiếu đối tượng chính). Viết bằng tiếng Việt tự nhiên, chuẩn xác, súc tích dưới 400 từ (tối đa 5 dòng/bảng, tuyệt đối không viết văn giải thích dài dòng), cấm tự bịa từ vô nghĩa và TUYỆT ĐỐI KHÔNG dùng ký hiệu LaTeX phức tạp như $I_0$. BẮT BUỘC trình bày đúng 4 phần: ### 1. Câu trả lời cốt lõi / Kết luận tổng hợp | ### 2. Bảng so sánh kiến thức / Khái niệm trọng tâm (dùng bảng Markdown chuẩn từ Bàn 4) | ### 3. Lộ trình học / Áp dụng thực tế | ### 4. Lỗi sai thường gặp cần tránh. Cuối cùng thêm mục `### [Ký ức cần ghi nhớ]` gồm 3–5 gạch đầu dòng khái quát hóa thành nguyên tắc quản trị dùng chung, tuyệt đối không lưu tên sản phẩm hay ngành hàng cụ thể của đề bài.',
      },
    },
  },
  econ_business: {
    id: 'econ_business',
    label: 'Kinh tế & Kinh doanh',
    roles: {
      researcher: {
        name: 'Researcher',
        titleVi: 'Nghiên cứu Thị trường & Vĩ mô',
        shortRole: 'Nhịp 1 · Dữ liệu & Mặt bằng giá',
        systemPrompt:
          'Bạn là Researcher (Nhịp 1). Phân tích ngắn cung-cầu, mặt bằng giá và khung chi phí tham chiếu cho Nhịp 2. BẮT BUỘC gắn nhãn [Ước tính] ngay trước mọi con số, giá cả hoặc định mức chưa kiểm chứng; dùng LaTeX ($...$) cho biến số. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      quant: {
        name: 'Quant & Finance',
        titleVi: 'Phân tích Tài chính & Định lượng',
        shortRole: 'Nhịp 2 · Số liệu & Hòa vốn',
        systemPrompt:
          'Bạn là Quant & Finance (Nhịp 2). Lập mô hình tài chính ($I_0$, $COGS$, $BEP = \\frac{FC}{P - VC}$, ROI) và 3 kịch bản (Thận trọng / Cơ sở / Lạc quan) bằng bảng Markdown ngắn rõ đơn vị. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      strategist: {
        name: 'Strategist',
        titleVi: 'Chiến lược & Mô hình Kinh doanh',
        shortRole: 'Nhịp 2 · SWOT, 4P & Thực thi',
        systemPrompt:
          'Bạn là Strategist (Nhịp 2). Đề xuất định vị, SWOT, 4P và lộ trình thực thi ngắn/trung hạn. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      critic: {
        name: 'Critic',
        titleVi: 'Phản biện Tài chính & Quản trị Rủi ro',
        shortRole: 'Nhịp 3 · Soi Ngân sách & Rủi ro',
        systemPrompt:
          'Bạn là Critic (Nhịp 3). BẮT BUỘC tự cộng tổng chi phí từ Quant đối chiếu với ngân sách/vốn ban đầu, tự tính lại và xuất 1 bảng phân bổ vốn điều chỉnh nằm gọn trong hạn mức, kèm 3–5 Red flags. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng.',
      },
      assistant: {
        name: 'Trợ lý CEO',
        titleVi: 'Tổng hợp & Báo cáo Điều hành',
        shortRole: 'Nhịp 3 · Đối chiếu & Executive Summary',
        systemPrompt:
          'Bạn là Trợ lý CEO cho CEO Phúc (Nhịp 3). QUY TẮC CỐT LÕI: BẮT BUỘC trả lời TRỰC DIỆN vào câu hỏi của CEO ngay mục đầu tiên (nêu rõ Tên mô hình, Sản phẩm, Công cụ, Lộ trình hoặc Giải pháp kinh doanh cụ thể đã chốt — tuyệt đối không tóm tắt chung chung thiếu đối tượng chính). Viết bằng tiếng Việt tự nhiên, chuẩn xác, súc tích dưới 400 từ (tối đa 5 dòng/bảng, tuyệt đối không viết văn giải thích dài dòng), cấm tự bịa từ vô nghĩa và TUYỆT ĐỐI KHÔNG dùng ký hiệu LaTeX phức tạp như $I_0$ (hãy viết rõ bằng tiếng Việt như Vốn ban đầu, Điểm hòa vốn BEP, Lợi nhuận dự kiến). BẮT BUỘC trình bày đúng 4 phần: ### 1. Chốt mô hình/sản phẩm cụ thể & Verdict (Go / Conditional Go / Pivot) | ### 2. Bảng phân bổ vốn & chỉ số hòa vốn (BEP, lợi nhuận dự kiến) (dùng bảng Markdown chuẩn từ Bàn 4) | ### 3. Kế hoạch triển khai 7 ngày đầu | ### 4. Rủi ro cần kiểm soát từ Critic. Cuối cùng thêm mục `### [Ký ức cần ghi nhớ]` gồm 3–5 gạch đầu dòng khái quát hóa thành nguyên tắc quản trị dùng chung, tuyệt đối không lưu tên sản phẩm hay ngành hàng cụ thể của đề bài.',
      },
    },
  },
  general_custom: {
    id: 'general_custom',
    label: 'Đa năng / Tùy chỉnh',
    roles: {
      researcher: {
        name: 'Phân tích Bối cảnh',
        titleVi: 'Làm rõ yêu cầu, dữ kiện & tiêu chí',
        shortRole: 'Nhịp 1 · Bối cảnh & Dữ kiện',
        systemPrompt:
          'Bạn là Chuyên gia Phân tích Bối cảnh (Nhịp 1). Làm rõ mục tiêu, dữ kiện và tiêu chí thành công. BẮT BUỘC gắn nhãn [Ước tính] ngay trước mọi con số, giá cả hoặc định mức chưa kiểm chứng. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      quant: {
        name: 'Giải pháp Trọng tâm',
        titleVi: 'Phương án chính, số liệu & cấu trúc',
        shortRole: 'Nhịp 2 · Giải pháp Trọng tâm',
        systemPrompt:
          'Bạn là Chuyên gia Giải pháp Trọng tâm (Nhịp 2). Đề xuất phương án trực diện nhất kèm các bước và KPI đo lường (dùng KaTeX $...$ nếu có công thức). BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      strategist: {
        name: 'Góc nhìn Mở rộng',
        titleVi: 'Phương án thay thế & sáng tạo',
        shortRole: 'Nhịp 2 · Góc nhìn Mở rộng',
        systemPrompt:
          'Bạn là Chuyên gia Góc nhìn Mở rộng (Nhịp 2). Đưa ra Plan B hoặc hướng tiếp cận khác biệt. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng. Kết thúc bài BẮT BUỘC có mục `### [Tóm tắt cốt lõi]` (tối đa 5 gạch đầu dòng chốt số liệu và ý chính).',
      },
      critic: {
        name: 'Phản biện Rủi ro',
        titleVi: 'Soi điểm yếu, mâu thuẫn & kiểm chứng',
        shortRole: 'Nhịp 3 · Phản biện & Kiểm chứng',
        systemPrompt:
          'Bạn là Chuyên gia Phản biện Rủi ro (Nhịp 3). Soi mâu thuẫn, giả định yếu hoặc vượt ngân sách/quỹ giờ; BẮT BUỘC tự tính lại và xuất 1 bảng phương án đã hiệu chỉnh chuẩn cho Trợ lý dùng ngay. BẮT BUỘC trình bày tiếng Việt súc tích dưới 400 từ, ưu tiên bảng Markdown ngắn (tối đa 5 dòng/bảng) và gạch đầu dòng cô đọng, tuyệt đối không viết văn giải thích dài dòng.',
      },
      assistant: {
        name: 'Tổng hợp Quyết định',
        titleVi: 'Bản chốt hành động trình CEO Phúc',
        shortRole: 'Nhịp 3 · Chốt Quyết định',
        systemPrompt:
          'Bạn là Trợ lý Tổng hợp Quyết định cho CEO Phúc (Nhịp 3). QUY TẮC CỐT LÕI: BẮT BUỘC trả lời TRỰC DIỆN vào câu hỏi của CEO ngay mục đầu tiên (nêu rõ Tên phương án, Sản phẩm, Công cụ, Lộ trình hoặc Giải pháp cụ thể đã chốt — tuyệt đối không tóm tắt chung chung thiếu đối tượng chính). Viết bằng tiếng Việt tự nhiên, chuẩn xác, súc tích dưới 400 từ (tối đa 5 dòng/bảng, tuyệt đối không viết văn giải thích dài dòng), cấm tự bịa từ vô nghĩa và TUYỆT ĐỐI KHÔNG dùng ký hiệu LaTeX phức tạp như $I_0$. BẮT BUỘC trình bày đúng 4 phần: ### 1. Chốt giải pháp tối ưu nhất | ### 2. Bảng phân tích các yếu tố/lựa chọn then chốt (dùng bảng Markdown chuẩn từ Bàn 4) | ### 3. Hành động cần làm ngay | ### 4. Lưu ý & Rủi ro phản biện từ Critic. Cuối cùng thêm mục `### [Ký ức cần ghi nhớ]` gồm 3–5 gạch đầu dòng khái quát hóa thành nguyên tắc quản trị dùng chung, tuyệt đối không lưu tên sản phẩm hay ngành hàng cụ thể của đề bài.',
      },
    },
  },
};

export const DEFAULT_WORK_MODE: WorkModeId = 'project_plan';

export function normalizeWorkMode(mode: string | null | undefined): WorkModeId {
  if (mode && mode in WORK_MODES) return mode as WorkModeId;
  if (mode === 'case_study') return 'study_research';
  if (mode === 'business_idea') return 'econ_business';
  return DEFAULT_WORK_MODE;
}

export function getModeMeta(mode: string | null | undefined): WorkModeMeta {
  return WORK_MODES[normalizeWorkMode(mode)];
}

export function getAgentRoleForMode(mode: string | null | undefined, agentId: AgentId): AgentRoleMeta {
  const modeMeta = getModeMeta(mode);
  return modeMeta.roles[agentId] || WORK_MODES[DEFAULT_WORK_MODE].roles[agentId];
}

export function getDefaultSystemPrompt(mode: string | null | undefined, agentId: AgentId): string {
  return getAgentRoleForMode(mode, agentId)?.systemPrompt || '';
}

export const AGENTS: AgentDefinition[] = [
  {
    id: 'researcher',
    step: 1,
    beat: 1,
    name: WORK_MODES[DEFAULT_WORK_MODE].roles.researcher.name,
    titleVi: WORK_MODES[DEFAULT_WORK_MODE].roles.researcher.titleVi,
    shortRole: WORK_MODES[DEFAULT_WORK_MODE].roles.researcher.shortRole,
    roleGroup: 'hall',
    colorHex: '#3B82F6',
    colorInt: 0x3b82f6,
    rgb: '59, 130, 246',
    position: [-4.4, 0, -3.4],
    facingAngle: Math.PI * 0.25,
  },
  {
    id: 'quant',
    step: 2,
    beat: 2,
    name: WORK_MODES[DEFAULT_WORK_MODE].roles.quant.name,
    titleVi: WORK_MODES[DEFAULT_WORK_MODE].roles.quant.titleVi,
    shortRole: WORK_MODES[DEFAULT_WORK_MODE].roles.quant.shortRole,
    roleGroup: 'hall',
    colorHex: '#10B981',
    colorInt: 0x10b981,
    rgb: '16, 185, 129',
    position: [4.4, 0, -3.4],
    facingAngle: -Math.PI * 0.25,
  },
  {
    id: 'strategist',
    step: 3,
    beat: 2,
    name: WORK_MODES[DEFAULT_WORK_MODE].roles.strategist.name,
    titleVi: WORK_MODES[DEFAULT_WORK_MODE].roles.strategist.titleVi,
    shortRole: WORK_MODES[DEFAULT_WORK_MODE].roles.strategist.shortRole,
    roleGroup: 'hall',
    colorHex: '#8B5CF6',
    colorInt: 0x8b5cf6,
    rgb: '139, 92, 246',
    position: [4.4, 0, 3.4],
    facingAngle: -Math.PI * 0.75,
  },
  {
    id: 'critic',
    step: 4,
    beat: 3,
    name: WORK_MODES[DEFAULT_WORK_MODE].roles.critic.name,
    titleVi: WORK_MODES[DEFAULT_WORK_MODE].roles.critic.titleVi,
    shortRole: WORK_MODES[DEFAULT_WORK_MODE].roles.critic.shortRole,
    roleGroup: 'hall',
    colorHex: '#F97316',
    colorInt: 0xf97316,
    rgb: '249, 115, 22',
    position: [-4.4, 0, 3.4],
    facingAngle: Math.PI * 0.75,
  },
  {
    id: 'assistant',
    step: 5,
    beat: 3,
    name: WORK_MODES[DEFAULT_WORK_MODE].roles.assistant.name,
    titleVi: WORK_MODES[DEFAULT_WORK_MODE].roles.assistant.titleVi,
    shortRole: WORK_MODES[DEFAULT_WORK_MODE].roles.assistant.shortRole,
    roleGroup: 'executive',
    colorHex: '#F59E0B',
    colorInt: 0xf59e0b,
    rgb: '245, 158, 11',
    position: [-9.45, 0.24, 2.25],
    facingAngle: -Math.PI * 0.62,
  },
];

export const HALL_AGENTS: AgentDefinition[] = AGENTS.filter((a) => a.roleGroup === 'hall');
export const ASSISTANT_AGENT: AgentDefinition = AGENTS.find((a) => a.id === 'assistant') || AGENTS[4];

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const DEFAULT_FREE_MODEL = 'openrouter/free';

export const DEFAULT_REQUEST_TIMEOUT_MS = 60000;

export const DEPRECATED_FREE_MODELS = [
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
] as const;

export const SUGGESTED_MODELS: SuggestedModel[] = [
  { id: 'openrouter/free', label: 'OpenRouter Auto (Free)' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B (Free)' },
  { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (Free)' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1 24B (Free)' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (OpenRouter)' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (OpenRouter)' },
  { id: 'qwen/qwq-32b', label: 'Qwen QwQ 32B' },
  { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 Chat' },
];

export const DEFAULT_AGENT_MODELS: Record<AgentId, string> = {
  researcher: DEFAULT_FREE_MODEL,
  quant: DEFAULT_FREE_MODEL,
  strategist: DEFAULT_FREE_MODEL,
  critic: DEFAULT_FREE_MODEL,
  assistant: DEFAULT_FREE_MODEL,
};

export const RETRY_CONFIG: RetryConfig = {
  maxRetries: 1,
  retryDelayMs: 6000,
  silentRetryDelayMs: 3000,
  beat1CooldownMs: 3000,
  staggerDelayMs: 4000,
  requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  autoFallbackModels: [DEFAULT_FREE_MODEL],
  stableRescueModels: [DEFAULT_FREE_MODEL],
  defaultMaxTokens: 4096,
  beat12MaxTokens: 4096,
  retryableStatuses: [429, 502, 503],
  keyFallbackStatuses: [429, 401, 402, 403, 502, 503],
};

export const STORAGE_KEYS: StorageKeys = {
  apiKey: 'ai_office_openrouter_api_key',
  mode: 'ai_office_work_mode_v2',
  agentModels: 'ai_office_openrouter_agent_models_v5',
  legacyAgentModelsV4: 'ai_office_openrouter_agent_models_v4',
  legacyAgentModels: 'ai_office_openrouter_agent_models_v3',
  agentApiKeys: 'ai_office_openrouter_agent_api_keys_v1',
  agentSystemPrompts: 'ai_office_agent_system_prompts_v1',
  companyMemory: 'ai_office_company_memory_v1',
  history: 'ai_office_session_history_v1',
  analyticsRuns: 'ai_office_analytics_runs_v1',
  soundEnabled: 'ai_office_sound_enabled_v1',
};

export function isGeminiDirectModel(modelId: string | null | undefined): boolean {
  const trimmed = String(modelId || '').trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith('models/gemini-')) return true;
  if (trimmed.includes('/')) return false;
  return trimmed.startsWith('gemini-');
}

export function getModelProvider(modelId: string | null | undefined): ModelProvider {
  return isGeminiDirectModel(modelId) ? 'gemini' : 'openrouter';
}

export function isDeprecatedFreeModel(modelId: string | null | undefined): boolean {
  const trimmed = String(modelId || '').trim().toLowerCase();
  return (DEPRECATED_FREE_MODELS as readonly string[]).includes(trimmed);
}

export function loadSavedAgentModels(rawJson: string | null | undefined): Record<AgentId, string> {
  const result: Record<AgentId, string> = { ...DEFAULT_AGENT_MODELS };
  if (!rawJson) return result;
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      AGENTS.forEach((a) => {
        const rawVal = parsed[a.id];
        if (typeof rawVal === 'string' && rawVal.trim()) {
          const candidate = rawVal.trim();
          result[a.id] =
            isGeminiDirectModel(candidate) || isDeprecatedFreeModel(candidate)
              ? DEFAULT_AGENT_MODELS[a.id]
              : candidate;
        }
      });
    }
  } catch {
    // fallback to defaults
  }
  return result;
}

export function loadSavedAgentApiKeys(rawJson: string | null | undefined): Record<AgentId, string> {
  const result = AGENTS.reduce(
    (acc, a) => {
      acc[a.id] = '';
      return acc;
    },
    {} as Record<AgentId, string>
  );
  if (!rawJson) return result;
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      AGENTS.forEach((a) => {
        const rawVal = parsed[a.id];
        if (typeof rawVal === 'string') {
          result[a.id] = rawVal.trim();
        }
      });
    }
  } catch {
    // fallback to empty keys
  }
  return result;
}

export function resolveAgentApiKey(
  agentId: AgentId,
  globalApiKey: string,
  agentApiKeys: Partial<Record<AgentId, string>> = {}
): string {
  const ownKey = typeof agentApiKeys?.[agentId] === 'string' ? agentApiKeys[agentId]!.trim() : '';
  if (ownKey) return ownKey;
  return typeof globalApiKey === 'string' ? globalApiKey.trim() : '';
}

export function resolveAgentKeyPlan(
  agentId: AgentId,
  globalApiKey: string,
  agentApiKeys: Partial<Record<AgentId, string>> = {},
  keyOverride = ''
): AgentKeyPlan {
  const ownKey = typeof agentApiKeys?.[agentId] === 'string' ? agentApiKeys[agentId]!.trim() : '';
  const globalKey = typeof globalApiKey === 'string' ? globalApiKey.trim() : '';
  const override = typeof keyOverride === 'string' ? keyOverride.trim() : '';

  if (override) {
    if (ownKey && override === ownKey) {
      return {
        primaryKey: ownKey,
        fallbackKey: globalKey && globalKey !== ownKey ? globalKey : '',
        usingOwnKey: true,
      };
    }
    return { primaryKey: override, fallbackKey: '', usingOwnKey: false };
  }
  if (ownKey) {
    return {
      primaryKey: ownKey,
      fallbackKey: globalKey && globalKey !== ownKey ? globalKey : '',
      usingOwnKey: true,
    };
  }
  return {
    primaryKey: globalKey,
    fallbackKey: '',
    usingOwnKey: false,
  };
}

export type SavedSystemPromptsMap = Partial<Record<WorkModeId, Partial<Record<AgentId, string>>>>;

export function loadSavedSystemPrompts(rawJson: string | null | undefined): SavedSystemPromptsMap {
  const result: SavedSystemPromptsMap = {};
  if (!rawJson) return result;
  try {
    const parsed = JSON.parse(rawJson) as Record<string, Record<string, unknown>>;
    if (parsed && typeof parsed === 'object') {
      (Object.keys(WORK_MODES) as WorkModeId[]).forEach((mId) => {
        if (parsed[mId] && typeof parsed[mId] === 'object') {
          const modePrompts: Partial<Record<AgentId, string>> = {};
          AGENTS.forEach((a) => {
            const val = parsed[mId][a.id];
            if (typeof val === 'string') {
              modePrompts[a.id] = val;
            }
          });
          result[mId] = modePrompts;
        }
      });
    }
  } catch {
    // fallback to empty map
  }
  return result;
}

export function resolveAgentSystemPrompt(
  mode: string | null | undefined,
  agentId: AgentId,
  savedPromptsMap: SavedSystemPromptsMap = {}
): string {
  const normMode = normalizeWorkMode(mode);
  const saved = savedPromptsMap?.[normMode]?.[agentId];
  if (typeof saved === 'string' && saved.trim()) {
    return saved.trim();
  }
  return getDefaultSystemPrompt(normMode, agentId);
}

export const SOUND_PRESETS: Record<string, SoundNote[]> = {
  click: [{ freq: 920, endFreq: 640, type: 'triangle', duration: 0.042, gain: 0.055, delay: 0 }],
  beat2: [
    { freq: 523.25, endFreq: 523.25, type: 'sine', duration: 0.16, gain: 0.075, delay: 0 },
    { freq: 783.99, endFreq: 783.99, type: 'triangle', duration: 0.24, gain: 0.06, delay: 0.075 },
  ],
  beat3: [
    { freq: 659.25, endFreq: 659.25, type: 'sine', duration: 0.17, gain: 0.075, delay: 0 },
    { freq: 987.77, endFreq: 987.77, type: 'triangle', duration: 0.28, gain: 0.06, delay: 0.085 },
  ],
  complete: [
    { freq: 523.25, endFreq: 523.25, type: 'sine', duration: 0.35, gain: 0.07, delay: 0 },
    { freq: 659.25, endFreq: 659.25, type: 'sine', duration: 0.38, gain: 0.065, delay: 0.09 },
    { freq: 783.99, endFreq: 783.99, type: 'sine', duration: 0.42, gain: 0.065, delay: 0.18 },
    { freq: 987.77, endFreq: 987.77, type: 'triangle', duration: 0.55, gain: 0.055, delay: 0.27 },
    { freq: 1174.66, endFreq: 1174.66, type: 'sine', duration: 0.72, gain: 0.05, delay: 0.36 },
  ],
  electricZap: [
    { freq: 440, endFreq: 185, type: 'sawtooth', duration: 0.055, gain: 0.036, delay: 0 },
    { freq: 690, endFreq: 230, type: 'square', duration: 0.045, gain: 0.026, delay: 0.045 },
    { freq: 520, endFreq: 150, type: 'sawtooth', duration: 0.06, gain: 0.03, delay: 0.09 },
  ],
  errorApi: [
    { freq: 330, endFreq: 220, type: 'sawtooth', duration: 0.14, gain: 0.05, delay: 0 },
    { freq: 240, endFreq: 150, type: 'triangle', duration: 0.2, gain: 0.045, delay: 0.11 },
  ],
  errorTimeout: [
    { freq: 415, endFreq: 290, type: 'triangle', duration: 0.12, gain: 0.045, delay: 0 },
    { freq: 290, endFreq: 170, type: 'triangle', duration: 0.22, gain: 0.045, delay: 0.12 },
  ],
  errorNetwork: [
    { freq: 280, endFreq: 180, type: 'sawtooth', duration: 0.13, gain: 0.045, delay: 0 },
    { freq: 210, endFreq: 130, type: 'sawtooth', duration: 0.18, gain: 0.04, delay: 0.1 },
  ],
};

export function getSoundPreset(name: string): SoundNote[] {
  return SOUND_PRESETS[name] || SOUND_PRESETS.click;
}

export function getPipelineProgressPercent(
  statuses: Partial<Record<AgentId, AgentStatus | string>> = {},
  isRunning = false
): number {
  if (!statuses || typeof statuses !== 'object') return 0;
  const doneCount = AGENTS.filter((a) => statuses[a.id] === 'done').length;
  if (doneCount === AGENTS.length) return 100;
  if (statuses.assistant === 'active') return 90;
  if (statuses.critic === 'done') return 82;
  if (statuses.critic === 'active') return 72;
  if (statuses.quant === 'done' && statuses.strategist === 'done') return 64;
  if (statuses.quant === 'active' || statuses.strategist === 'active') return 48;
  if (statuses.researcher === 'done') return 34;
  if (statuses.researcher === 'active') return 16;
  return isRunning ? 8 : Math.min(95, doneCount * 18);
}

export function getAgentProgressState(
  status: AgentStatus | string = 'idle',
  retryText = '',
  startedAtMs = 0,
  nowMs = 0
): AgentProgressState {
  if (status !== 'active') {
    return {
      visible: false,
      percent: status === 'done' ? 100 : 0,
      stageLabel: status === 'done' ? 'Hoàn tất' : status === 'error' ? 'Lỗi' : '',
    };
  }
  const safeStart = startedAtMs > 0 ? startedAtMs : nowMs;
  const dtSec = Math.max(0, (nowMs - safeStart) / 1000);
  const percent = Math.min(94, Math.max(12, Math.round(12 + 82 * (1 - Math.exp(-dtSec / 4.2)))));
  const trimmedRetry = typeof retryText === 'string' ? retryText.trim() : '';
  const stageLabel = trimmedRetry
    ? trimmedRetry
    : percent < 35
      ? 'Khởi tạo'
      : percent < 72
        ? 'Phân tích'
        : 'Hoàn thiện';
  return { visible: true, percent, stageLabel };
}

export function getNeuralTickerMessage(
  mode: string | null | undefined,
  statuses: Partial<Record<AgentId, AgentStatus | string>> = {},
  isRunning = false
): string {
  const rName = getAgentRoleForMode(mode, 'researcher').name;
  const qName = getAgentRoleForMode(mode, 'quant').name;
  const sName = getAgentRoleForMode(mode, 'strategist').name;
  const cName = getAgentRoleForMode(mode, 'critic').name;
  const aName = getAgentRoleForMode(mode, 'assistant').name;

  const hasError = AGENTS.some((a) => statuses[a.id] === 'error');
  const allHallDone = HALL_AGENTS.every((a) => statuses[a.id] === 'done');

  if (statuses.assistant === 'done' && allHallDone) {
    return 'Luồng dữ liệu vàng kim đã trình CEO Phúc · Hoàn tất Báo cáo Điều hành.';
  }
  if (hasError && !isRunning) {
    return 'Cảnh báo: Phát hiện lỗi kết nối ở nhánh chuyên môn · Chờ khôi phục.';
  }
  if (statuses.assistant === 'active') {
    return `Nhịp 3/3 · ${aName} đang tổng hợp dữ liệu trình CEO Phúc...`;
  }
  if (statuses.critic === 'active') {
    return `Nhịp 3/3 · Dữ liệu Nhịp 2 hội tụ về ${cName} để kiểm duyệt...`;
  }
  if (statuses.quant === 'active' || statuses.strategist === 'active') {
    return `Nhịp 2/3 · Bàn 1 truyền luồng dữ liệu sang ${qName} & ${sName}...`;
  }
  if (statuses.researcher === 'done' && isRunning) {
    return `Nhịp 1 hoàn tất · Đang kích hoạt luồng sáng sang 2 bàn Nhịp 2...`;
  }
  if (statuses.researcher === 'active') {
    return `Nhịp 1/3 · ${rName} đang giải mã đề bài và dữ liệu nền...`;
  }
  if (allHallDone && statuses.assistant !== 'done') {
    return '4 bàn chuyên môn đã xong · Sẵn sàng tổng hợp trình CEO Phúc.';
  }
  return 'Hệ thống Hội đồng Chuyên gia 3D sẵn sàng · Chờ chỉ thị từ CEO Phúc.';
}

export function resolveBeamLinkState(
  conn: BeamLinkConnection,
  statuses: Partial<Record<AgentId, AgentStatus | string>> = {},
  outputs: Partial<Record<AgentId, string>> = {},
  nowMs = 0,
  burstTimers: { beat1DoneAt?: number; beat2DoneAt?: number; allDoneAt?: number } = {}
): BeamLinkState {
  const { phase, sourceId, targetId } = conn;
  const resDone = statuses.researcher === 'done';
  const beat2Done = statuses.quant === 'done' && statuses.strategist === 'done';
  const assistantActive = statuses.assistant === 'active';
  const assistantDone = statuses.assistant === 'done';
  const allHallDone = HALL_AGENTS.every((a) => statuses[a.id] === 'done');

  const inBurst = (ts: number | undefined, windowMs = 2600): boolean =>
    typeof ts === 'number' && ts > 0 && nowMs - ts >= 0 && nowMs - ts < windowMs;

  let isStreaming = false;
  let isPassed = false;
  let isBursting = false;

  if (phase === 'beat1') {
    isStreaming = statuses[targetId as AgentId] === 'active';
    isPassed = resDone;
  } else if (phase === 'beat2') {
    isBursting = resDone && inBurst(burstTimers.beat1DoneAt, 2600);
    isStreaming = resDone && (statuses[targetId as AgentId] === 'active' || isBursting);
    isPassed = resDone && statuses[targetId as AgentId] === 'done';
  } else if (phase === 'beat3_critic') {
    const hasSrc = Boolean(outputs[sourceId as AgentId]) || statuses[sourceId as AgentId] === 'done';
    isBursting =
      beat2Done &&
      (sourceId === 'quant' || sourceId === 'strategist') &&
      inBurst(burstTimers.beat2DoneAt, 2600);
    isStreaming = hasSrc && (statuses.critic === 'active' || isBursting);
    isPassed = hasSrc && statuses.critic === 'done';
  } else if (phase === 'synthesize') {
    const hasSrc = Boolean(outputs[sourceId as AgentId]) || statuses[sourceId as AgentId] === 'done';
    isBursting =
      beat2Done &&
      (sourceId === 'quant' || sourceId === 'strategist') &&
      inBurst(burstTimers.beat2DoneAt, 2600);
    isStreaming = hasSrc && (assistantActive || isBursting);
    isPassed = hasSrc && assistantDone;
  } else if (phase === 'director') {
    isBursting = assistantDone && inBurst(burstTimers.allDoneAt, 4500);
    isStreaming = assistantActive || isBursting;
    isPassed = assistantDone && (allHallDone || Boolean(outputs.assistant));
  }

  return { isStreaming, isPassed, isBursting };
}

export function resolveJanitorTargetPlan(
  statuses: Partial<Record<AgentId, AgentStatus | string>> = {},
  elapsedSec = 0,
  agentsList: ReadonlyArray<{ id: AgentId }> = AGENTS
): JanitorTargetPlan {
  const list: ReadonlyArray<{ id: AgentId }> = Array.isArray(agentsList) ? agentsList : AGENTS;
  const activeAgents = list.filter((a) => statuses && statuses[a.id] === 'active');
  if (activeAgents.length === 0) {
    return { mode: 'patrol', targetAgentId: null, activeCount: 0 };
  }
  const safeElapsed = Math.max(0, Number(elapsedSec) || 0);
  const slotIdx = Math.floor(safeElapsed / 2.6) % activeAgents.length;
  return {
    mode: 'shock',
    targetAgentId: activeAgents[slotIdx].id,
    activeCount: activeAgents.length,
  };
}
