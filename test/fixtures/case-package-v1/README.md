# Case Package V1 測試資料

`case.json` 用來驗證案件、兩個交付管道、三份應繳文件及多對多關聯。

目前 fixture 刻意不含二進位 Word／Excel，作為「純資料案件包」的第一個驗證案例。後續 ZIP 匯入器完成時，會再加入：

1. 完整有效案件包：DOCX＋XLSX。
2. 缺少 manifest。
3. manifest 格式錯誤。
4. manifest 指向不存在檔案。
5. SHA-256 不相符。
6. 相同 packageId。
7. 相同公文字號。
8. 相同收文日期＋主旨。
9. 不支援副檔名。
10. 超過檔案數量或大小限制。
