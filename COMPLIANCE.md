# Enterprise Compliance, Privacy Architecture & Regulatory Applicability Statement
# 企業級合規、隱私架構與法規適用性聲明

Last Updated / 最後修訂日期: 2026-09-17  
System / 系統名稱: AskIf Real-Time Q&A System  
Operator / 維運主體: Enterprise Event Operations / Jacky Law  

---

## 1. Technical Boundary & AI Scope Exclusion / 技術邊界與非 AI 系統聲明

### English
**AskIf** is a deterministic, ephemeral, memory-native communication middleware designed strictly for live conference Q&A facilitation.
* **No Artificial Intelligence / Machine Learning**: The system does not utilize machine learning models, natural language processing (NLP), generative AI (GenAI), deep learning pipelines, automated decision-making engines, or algorithmic profiling.
* **Human-in-the-Loop Exclusivity**: Question selection, spotlighting, and rejection are conducted solely through manual human moderation by the designated event host.
* **Regulatory Determination**:
  * **EU Artificial Intelligence Act (EU AI Act - Regulation (EU) 2024/1689)**: **OUT OF SCOPE**. AskIf does not qualify as an AI System under Article 3(1). It entails no unacceptable, high, or specific transparency risk classifications.
  * **ISO/IEC 42001 (Artificial Intelligence Management System)**: **OUT OF SCOPE**. Formal AI system risk treatment does not apply due to the total absence of algorithmic inference.
  * **Cyberspace Administration of China (CAC) Algorithmic Provisions**: **OUT OF SCOPE**. The platform does not deploy algorithmic recommendation, deep synthesis, or generative content generation algorithms.

### 繁體中文
**AskIf** 為確定性、短暫駐留、純邊緣記憶體運作之即時通訊中繼架構，專為現場會議論壇提問而設計。
* **無人工智慧與機器學習成分**：本系統不包含任何機器學習模型、自然語言處理（NLP）、生成式 AI（GenAI）、深度學習管道、自動化決策引導或演算法用戶畫像。
* **純人工審核架構（Human-in-the-Loop）**：提問之審核、大螢幕推題與封存，完全由主辦方主持人即時手動操控，絕無演算法介入排序。
* **法規適用性判定**：
  * **歐盟人工智慧法案（EU AI Act）**：**不適用（Out of Scope）**。本系統不符合 Article 3(1) 定義之 AI 系統，免除風險評級及高風險 AI 合規義務。
  * **ISO/IEC 42001（人工智慧管理系統）**：**不適用（Out of Scope）**。因無演算法生命週期管理與自主推理元件，豁免 AI 治理標準。
  * **國家互聯網信息辦公室（CAC）演算法規範**：**不適用（Out of Scope）**。不具備生成式合成技術或推薦演算法機制，無演算法備案程序之適用。

---

## 2. Global Privacy & Data Protection Compliance / 全球隱私與個人資料合規

### 2.1 Hong Kong Personal Data (Privacy) Ordinance (PDPO, Cap. 486)
* **Principle 1 (Purpose & Manner of Collection)**: Zero Personally Identifiable Information (Zero-PII) architecture. No names, phone numbers, email addresses, device identifiers, or tracking cookies are gathered from audiences.
* **Principle 2 (Accuracy & Duration of Retention)**: Ephemeral memory runtime. All question payloads and transient tokens reside exclusively in Cloudflare edge volatile memory (Durable Objects). Upon session termination or tab closure, active memory states are instantaneously wiped.
* **Principle 4 (Security of Personal Data)**: All data in transit is protected by strict TLS 1.3 encryption and cryptographically authenticated with HMAC-SHA256 4-part tickets.

### 2.2 EU General Data Protection Regulation (GDPR - Regulation (EU) 2016/679)
* **Data Protection by Design & by Default (Art. 25)**: Radical data minimization. Transient attendee connections produce zero database records.
* **No Persistent Storage (Art. 17 - Right to Erasure)**: Physical auto-purge upon room lifecycle conclusion satisfies instantaneous erasure requirements without residual risk.
* **Data Processor Status**: Cloudflare Workers and Cloudflare Durable Objects serve strictly as real-time stateless relays.

### 2.3 中華人民共和國個人信息保護法 (PIPL)
* 系統設計貫徹「最小必要原則」，提問內容僅供現場大螢幕即時投影與口頭答覆，不留存個人生物特徵、帳號資訊或行蹤軌跡，無跨境數據傳輸問題。

---

## 3. Information Security Standards Alignment / 資訊安全標準架構對齊

* **ISO/IEC 27001 (Information Security Management)**:
  * Strict Content Security Policy (`CSP`) headers restricting unauthorized script injection.
  * Constant-time comparison (`timingSafeEqual`) defending against cryptographic timing side-channel attacks.
  * In-flight input sanitization mitigating cross-site scripting (XSS) up to 200 characters.
* **ISO/IEC 27701 (Privacy Information Management)**:
  * Transparent data-flow disclosures.
  * Denial-of-Service mitigation via edge-native rate limiting (`AUTH_RATE_LIMITER`).
  * Total capacity cap of 725 concurrent rooms to prevent shared memory starvation.

---

## 4. Legal Disclaimer & Limitation of Liability / 法律免責與責任限制條款

1. **User Content**: Content submitted by attendees represents the sole perspective of the participant. The operator provides solely the transit mechanism and assumes no editorial liability prior to manual moderator authorization.
2. **Security Guarantee**: While the system enforces TLS 1.3, HMAC-SHA256 signatures, and strict input scrubbing, transmissions occur over public distributed internet infrastructures without warranties against force majeure disruptions.
3. **Intellectual Property & Licensing**: AskIf source code is published under an open, verifiable engineering standard.