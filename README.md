# 台灣地震觀測 Dashboard

把台灣近兩年主要有感地震分析樣本轉成一般民眾可閱讀的互動式 Dashboard。頁面依照提供的 Figma 視覺稿配置：摘要 KPI、月份趨勢、震央區域分布、規模與深度散點圖，以及五項洞察。

## 在本機執行

需要 Node.js 20.19+ 或 22.12+。

    npm install
    npm run dev

開啟 Vite 顯示的本機網址。正式打包與資料檢查：

    npm run check:data
    npm run build
    npm run preview

## 資料與計算

Dashboard 直接讀取 public/data/taiwan_major_felt_earthquakes_2024-09-25_to_2026-09-25.csv。CSV 解析後才計算 KPI、月份序列、座標群聚、相關係數、回歸線與五項洞察；程式沒有放入固定事件數或示意圖表資料。

- 事件數、最大規模、最大震度：由目前篩選後的事件列計算。
- 月份趨勢：依 CSV 的最早與最晚事件月份建立連續月份，沒有事件的月份顯示 0。
- 空間群聚：用經緯度的 Haversine 距離建立 50 公里連通群聚，再依群聚中心歸納區域名稱。兩個單筆連通群聚合併標為「其他／孤立事件」。
- 規模與深度：Pearson 相關係數與線性趨勢線由目前顯示事件計算。
- 規模與最大震度：使用 CSV 的「最大震度序位_分析用」欄位計算 Spearman 相關係數。
- 點選月份或區域可篩選；篩選器也支援最低規模。點選散點可開啟事件明細與 CSV 中的中央氣象署來源連結。

資料檢查腳本以 Python 標準函式庫獨立確認提供的 CSV 筆數、欄位、指標與 50 公里群聚。

## 資料限制

此資料集是 39 筆主要有感地震分析樣本，**不是台灣完整地震目錄**。沒有被選入的地震不會出現在圖表中；0 筆月份不代表台灣沒有發生地震。群聚比例與相關係數只描述此樣本，不能直接推論因果或普遍地震風險。

中央氣象署事件網址保留在 CSV 的 source_url 欄。專案目前使用本機靜態 CSV，沒有即時 API、完整地震地圖或後端。

## 技術

- React + Vite
- Apache ECharts
- Papa Parse
- Tabler Icons

## 專案狀態

本地工作副本以 GitHub main 初始版本 fbc7ca1ec1381fa48688b6c2f1626ed028d4a820 為基底。完成本地建置與畫面驗證後，尚未推送或部署。

## 畫面驗證

Figma 參考圖、桌機／手機截圖、互動測試與已知限制整理於 [design-qa.md](design-qa.md)。Linux 系統若沒有繁體中文字型，請提供 Noto Sans CJK TC 等系統字型；其他平台會使用 PingFang TC 或 Microsoft JhengHei 等字型回退。
