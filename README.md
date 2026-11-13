# JT2Go Web Viewer (3D CAD & PMI 響應式 PWA)

支援 **桌面電腦** 與 **iOS / Android 手機** 雙平台自適應介面（RWD）的工業級 3D CAD 網頁檢視器，可直接部署至 **GitHub Pages** 或 **Cloudflare Pages** 並安裝為離線 PWA 應用程式。

## 響應式介面設計 (Desktop & Mobile)

- **桌面端 (`>= 1024px`)**：三欄式工程工作區（左側產品結構樹 BOM、中央全尺寸 3D 畫布、右側屬性與 PMI 公差面板），頂部整合完整標準視角與著色/邊線/線框/X光切換列。
- **手機端 (`< 1024px`)**：
  - 3D 畫布全寬顯示，並支援單指旋轉、雙指縮放平移與 iPhone 瀏海安全區域（`100dvh` + `safe-area-inset`）。
  - 頂部提供橫向滑動的視角與渲染模式快捷列。
  - 底部配置四顆主要導覽按鈕（**結構樹 BOM**、**屬性 / PMI**、**剖面 / 爆炸**、**匯入檔案**），點擊後以流暢的底部上滑抽屜（Bottom Sheet Drawer）展開。
