# JT2Go Web Viewer (3D CAD & PMI PWA)

這是一個基於 **Three.js** 與 **Progressive Web App (PWA)** 架構打造的工業級 3D CAD 網頁檢視器，專為檢視組合件結構（BOM）、PMI 幾何公差標註、剖面切割與爆炸視圖而設計，可直接部署至 **GitHub Pages** 並安裝為桌面或手機離線應用程式。

## 專案檔案結構

```text
jt2go-pwa-viewer/
├── index.html             # 主網頁介面與 UI 佈局
├── app.js                 # Three.js 3D 渲染、匯入器、剖面/爆炸與 PMI 邏輯
├── manifest.webmanifest   # PWA 應用程式清單與檔案關聯設定
├── sw.js                  # Service Worker 離線快取策略
├── icons/
│   └── icon.svg           # PWA 向量應用程式圖示
└── README.md              # 部署與使用說明
```

## 快速上傳至 GitHub 並啟用 GitHub Pages

1. 在 GitHub 建立一個新的 Repository（例如 `jt2go-web-viewer`）。
2. 將本資料夾內的所有檔案上傳至該 Repository 的根目錄：
   ```bash
   git init
   git add .
   git commit -m "Initial commit: JT2Go Web PWA 3D Viewer"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/jt2go-web-viewer.git
   git push -u origin main
   ```
3. 前往 Repository 的 **Settings → Pages**：
   - **Source** 選擇 `Deploy from a branch`
   - **Branch** 選擇 `main` / `/ (root)`，點擊 **Save**。
4. 等待約 1 分鐘後，開啟產生的 `https://<你的帳號>.github.io/jt2go-web-viewer/` 網址，即可在瀏覽器網址列右側點擊「安裝」將其安裝為離線 PWA 桌面應用。

## 支援功能

- **多格式匯入**：支援拖放或選擇本機 `.glb`、`.gltf`、`.stl`、`.obj` 模型檔案，並支援 `.jt` 檔案結構解析預覽模式。
- **工程視角與渲染模式**：等角 ISO、前視、上視、右視、一鍵全覽，以及著色、著色+邊線、線框、X光模式。
- **組合件分析**：即時 XYZ 軸剖面切割（Section Plane）與組合件爆炸視圖滑桿。
- **離線可用 (PWA)**：首次載入後會自動快取核心程式與 3D 引擎模組，斷網狀態下仍可開啟本機 3D 模型。
