# Văn phòng AI 3D — Hệ thống Hội đồng Chuyên gia Đa năng

Ứng dụng web **React + TypeScript + Vite + Three.js** mô phỏng một **Văn phòng AI 3D Isometric** phong cách *Cyber-Executive* gồm 4 bàn chuyên môn ngoài đại sảnh, khu vực điều hành **Phòng CEO Phúc**, nhân vật **⚡ Siêu nhân Điện quang** tuần tra/tiếp năng lượng cho các bàn đang xử lý, hệ thống âm thanh Web Audio (`SoundEngine`), **Chế độ Quay** (`Live Neural Ticker`) và **Tab Thống kê Chi tiết**.

---

## 1. Tính năng nổi bật

- **Kiến trúc Lai 3 Nhịp (`1 → 2 → 2`) trên OpenRouter**:
  - **Nhịp 1 (`researcher`)**: Phân tích nền tảng, mục tiêu, ràng buộc hoặc bối cảnh độc lập.
  - **Nhịp 2 (`quant` & `strategist`)**: Chạy song song (giãn cách 4s chống Rate Limit), nhận trọn bộ dữ liệu từ Nhịp 1.
  - **Nhịp 3 (`critic` → `assistant`)**: Phản biện rủi ro/kiểm chứng số liệu trước, sau đó Trợ lý Điều hành tổng hợp *Executive Summary*, đối chiếu mâu thuẫn và trích xuất **Sổ tay Ký ức (`### [Ký ức cần ghi nhớ]`)** cho **CEO Phúc**.
- **4 Chế độ Làm việc Đa năng**:
  1. `Kế hoạch & Dự án` (`project_plan`)
  2. `Học tập & Nghiên cứu` (`study_research`)
  3. `Kinh tế & Kinh doanh` (`econ_business`)
  4. `Đa năng / Tùy chỉnh` (`general_custom`)
- **Cơ chế Cấu hình 5 API Key trên UI (1 Key Gốc + 4/5 Key Riêng Tùy chọn)**:
  - Nhập **1 OpenRouter API Key gốc (Global)** ở bảng điều khiển bên trái để dùng chung cho toàn bộ văn phòng.
  - Có thể nhập thêm **API Key riêng (tùy chọn)** trực tiếp trên thẻ của từng chuyên gia ở cột phải (4 chuyên gia đại sảnh + Trợ lý CEO) nhằm phân tải hạn mức hoặc dùng key dự phòng khác nhau.
  - Hệ thống tự động **Fallback 3 bước** (`callOpenRouterWithKeyFallback`): nếu Key riêng gặp lỗi hạn mức/xác thực/quá tải (`429`, `401`, `402`, `403`, `502`, `503`), hệ thống tự động chờ 3s chuyển về **API Key gốc** rồi tiếp tục chuyển sang model dự phòng ổn định (`openrouter/free`) nếu cần.
- **Không gian 3D & HUD Cyber-Executive**:
  - Góc nhìn `Tổng quan` và `Phòng CEO Phúc` mượt mà, bảng tên CSS2D trực quan (`Đang ngủ Zzz`, vòng tròn tiến độ `SVG`, `Lỗi Timeout >35s`, `Chích điện` bởi ⚡ Siêu nhân Điện quang, tia năng lượng 3 nhịp).
  - **Chế độ Quay** (`cinema-mode`) ẩn các điều khiển kỹ thuật để hiển thị sân khấu 3D kèm *Live Neural Ticker* chạy chữ theo từng nhịp.
  - **Nội quy / Chỉ thị riêng (`systemPrompt`)**, **Chỉnh sửa/Hỏi đáp trực tiếp với Thư ký**, **Lưu 10 phiên gần nhất**, **Xuất Markdown (`.md`)**, **Sao chép báo cáo** (hỗ trợ GFM Tables + KaTeX + `DOMPurify.sanitize`).
  - **Tab Thống kê Chi tiết**: Biểu đồ KPI phiên chạy, so sánh Token / Tốc độ / Tỉ lệ thành công theo 5 bàn, Donut phân bổ chế độ, phân bổ model và bảng nhật ký kiểm toán xuất CSV.

---

## 2. Kiến trúc mã nguồn (React + TypeScript + Vite)

```text
├── index.html                        # HTML entry point gọn sạch, nạp Google Fonts, Marked, KaTeX và /src/main.tsx
├── metadata.json                     # Metadata ứng dụng (khớp tên, mô tả & capabilities)
├── vite.config.ts                    # Cấu hình Vite React + Tailwind CSS v4
├── src/
│   ├── main.tsx                      # React root mount <App /> và nạp ./index.css
│   ├── index.css                     # Tailwind CSS v4 (@import "tailwindcss") + CSS Cyber-Executive, Nameplate, KaTeX
│   ├── App.tsx                       # Thành phần điều phối trung tâm: state phiên làm việc, pipeline 3 nhịp, fallback 5 API Key, Sound & Analytics
│   ├── types/
│   │   └── office.ts                 # Kiểu dữ liệu TypeScript dùng chung cho toàn bộ UI & 3D canvas
│   ├── core/
│   │   ├── workModes.ts              # Cấu hình 4 chế độ, 5 vai trò chuyên gia, Storage Keys, Sound Presets, logic Key Fallback & Beam Link
│   │   └── analytics.ts              # Chuẩn hóa bản ghi phiên chạy, tính KPI, gộp nguồn & xuất CSV
│   ├── services/
│   │   └── openrouter.ts             # Giao tiếp OpenRouter API, phân loại lỗi, Render/Normalize Markdown + bảo vệ KaTeX + chạy Hybrid 3-Beat
│   ├── utils/
│   │   ├── markdownRenderer.ts       # Cấu hình Marked + DOMPurify.sanitize + KaTeX auto-render
│   │   └── soundEngine.ts            # Bộ tổng hợp âm thanh Web Audio API (click, beat transition, complete, electricZap, error)
│   └── components/
│       ├── Office3DCanvas.tsx        # Cảnh Three.js + CSS2DRenderer + OrbitControls + Phòng CEO Phúc + Siêu nhân Điện quang + tia dữ liệu
│       ├── ViewSwitcher.tsx          # Thanh chuyển đổi toàn màn hình (Văn phòng 3D / Thống kê Chi tiết)
│       ├── ControlPanel.tsx          # Cột trái: Chế độ Quay, Âm thanh, Camera, 1 API Key gốc, 4 Chế độ làm việc & Sổ tay Ký ức
│       ├── ExpertCouncilSidebar.tsx  # Cột phải: Tiến độ pipeline, Lịch sử 10 phiên, Xuất MD/Copy, Datalist Model & 5 thẻ chuyên gia
│       ├── AgentCard.tsx             # Thẻ cấu hình từng bàn: Model selector, API Key riêng (tùy chọn), Nội quy riêng & nút Chạy lại/Tổng hợp
│       ├── HistoryPanel.tsx          # Danh sách 10 phiên làm việc gần nhất lưu trong localStorage
│       ├── ReportSections.tsx        # Báo cáo Điều hành (Executive Summary), khung Hỏi đáp Thư ký & báo cáo chi tiết từng bàn
│       ├── AnalyticsDashboard.tsx    # Giao diện Tab Thống kê Chi tiết toàn màn hình
│       └── PromptDock.tsx            # Thanh nhập đề bài dưới đáy, Error Banner & Live Neural Ticker
└── tests/
    └── office_logic.test.ts          # Bộ Unit Test bằng node:test (kiểm tra workModes, openrouter, analytics & kiến trúc React)
```

---

## 3. Phát triển & Kiểm thử cục bộ

### Yêu cầu môi trường
- **Node.js 20+**

### Cài đặt & chạy ứng dụng
```bash
npm install
npm run dev
```
Truy cập `http://localhost:3000`.

### Kiểm tra kiểu, Lint, Build và Unit Test
```bash
# Chạy kiểm tra build production (Vite)
npm run build

# Kiểm tra TypeScript & ESLint
npm run lint

# Chạy toàn bộ Unit Tests logic cốt lõi & kiểm tra cấu trúc React
npx tsx --test tests/office_logic.test.ts
```
