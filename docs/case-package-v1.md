# Case Package V1

Case Package 是項目控管的可攜式案件格式。每個 ZIP 只代表一個案件，網站可直接匯入 ZIP，不需要使用者解壓縮。

## 目標

- ChatGPT 可依公文與附件產生案件資料及 Word／Excel 初稿。
- 匯入前完整驗證與預覽。
- 一次建立案件、交付管道、應繳文件及文件版本。
- 所有資料寫入 Supabase；實體檔案寫入 Supabase Storage。
- 重複案件先阻擋，經使用者確認後才可強制匯入。
- 不完整或失敗的匯入不建立半套案件。

## ZIP 結構

```text
case-package.zip
├── case.json
└── files/
    ├── application.docx
    ├── roster.xlsx
    └── checklist.docx
```

ZIP 根目錄必須有且只有一份 `case.json`。實體檔案一律放在 `files/` 下，不允許絕對路徑、`../` 或巢狀 ZIP。

## 版本與識別

- `schemaVersion`：固定為 `1.0`。
- `packageId`：每次產生案件包時建立 UUID；同一案件包重複匯入時保持不變。
- `case.externalKey`：可選的外部案件識別，例如公文字號。
- 完全相同的 `packageId` 視為確定重複。
- `externalKey` 相同，或「收文日期＋正規化主旨」相同，視為疑似重複。
- 疑似重複預設阻擋；只有使用者明確確認才可強制匯入。

## 核心資料

`case.json` 必須符合 `schemas/case-package-v1.schema.json`。

- `case`：案件本體。
- `deliveries`：各繳交管道、期限與狀態。
- `documents`：應製作或繳交的文件。
- `artifacts`：ZIP 中實際存在的範本、初稿或完成版。
- `warnings`：資料不足、期限不明或需人工確認事項。

文件與交付管道是多對多關係，透過 `documents[].deliveryIds` 連結。

## 文件版本

`artifacts[].role`：

- `template`：正式範本或重建範本。
- `draft`：可繼續修改的初稿。
- `final`：已確認完成的版本。

`sourceType`：

- `official_template`：公文附件中的正式範本。
- `reconstructed`：由 PDF／圖片重建。
- `generated`：無範本時新建。
- `user_upload`：使用者日後上傳。
- `chatgpt_output`：ChatGPT 產出的文件。

同一文件可有多個版本；匯入時每個 artifact 建立一筆版本。日後上傳正式範本或修改版時新增版本，不覆寫舊檔。

## 匯入狀態

匯入流程使用 `case_imports.status`：

1. `validating`：解壓縮、Schema、路徑、大小與校驗檢查。
2. `staged`：檔案已上傳暫存區，尚未建立正式案件。
3. `committing`：建立案件關聯與文件版本。
4. `completed`：全部成功。
5. `failed`：失敗並記錄錯誤；暫存檔可清理。

前端不得在驗證完成前寫入正式案件資料。

## 安全限制（V1）

- 僅接受 ZIP。
- 單一案件包上限 50 MB。
- 最多 30 個實體檔案。
- 解壓縮後總大小上限 100 MB。
- 允許：PDF、DOC、DOCX、XLS、XLSX、CSV、TXT、JPG、JPEG、PNG。
- 拒絕可執行檔、HTML、JavaScript、巨集檔及加密 ZIP。
- 每個 artifact 必須提供 SHA-256，匯入時重新計算比對。

## 匯入成功條件

案件、交付管道、文件、文件與管道關聯、文件版本及 Storage 檔案全部存在，才標記 `completed`。任何一步失敗必須顯示原因，不得讓畫面呈現為已完成。
