# AskIf — 現場即時互動問答系統 | Enterprise Live Q&A System

<div align="center">

![AskIf Banner](./AskIf512icon.png)

**純邊緣記憶體運算・無痕私隱防護・會後物理銷毀・企業級即時互動**  
*Edge-native memory computing · Zero-PII privacy · Session auto-purge · Enterprise real-time engagement*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%26%20Durable%20Objects-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![GitHub Pages](https://img.shields.io/badge/Deployment-GitHub%20Pages-222222?logo=github)](https://jackylawck.github.io/AskIf/)
[![Privacy: Zero-PII](https://img.shields.io/badge/Privacy-Zero--PII%20Compliant-00b894)](#-隱私與安全架構--privacy--security-architecture)

[繁體中文](#繁體中文) | [English](#english)

</div>

---

<a name="繁體中文"></a>
## 🇭🇰 繁體中文

### 📌 產品定位與核心理念
**AskIf** 專為大型國際年會、商業論壇、董事會與企業大會設計。傳統現場問答工具往往高度依賴雲端資料庫、蒐集參與者隱私數據，且操作繁瑣。AskIf 採用 **Privacy by Design（預設隱私保護）** 原則：
* **零資料庫持久化（Zero-Persistence）**：完全依賴 Cloudflare Workers 邊緣節點記憶體與 Durable Objects 進行極速即時運算。
* **零個人身分識別（Zero-PII）**：不強制登入、不記名、不蒐集 IP、電話、Email 或 Cookie，徹底杜絕資料外洩風險。
* **會後物理銷毀（Session Auto-Purge）**：會議結束或關閉分頁，記憶體中狀態隨即自動抹除清空。

---

### ✨ 主要功能特色
* **🎙️ 主持人戰情室（Host Moderation Board）**：
  * 主持人開房時**自訂管理密碼**（4~16 位），密鑰與房號透過 HMAC-SHA256 簽名防偽。
  * 支援長按防手滑推題（0.8 秒長按防誤觸推上大螢幕）、口頭答畢一鍵移除。
* **📱 觀眾極簡加入（Audience Web App）**：
  * 支援 6 位數字房號手動輸入或大螢幕動態 QR Code 掃描，免密碼直接參與。
  * 支援即時提問（微秒級 XSS 過濾、200 字限制）與匿名附議（Upvote）。
* **🖥️ 舞台大螢幕投影（Stage Spotlight Display）**：
  * 雙擊全螢幕切換、滑鼠閒置 3 秒自動隱藏游標。
  * 待機狀態展示大 QR Code，推題時無縫平滑過渡放大聚焦點，右下角常駐 Mini QR 便於遲到觀眾掃碼。
* **🛡️ 企業級高可用防護**：
  * 全域設有 **725 間活躍房間** 硬上限防禦，杜絕惡意呼叫耗盡邊緣運算額度。
  * 內建單一 IP 頻率限制（Rate Limiting）防刷保護。
* **🌐 雙語模組化（Bilingual Localization）**：
  * 全站支援繁體中文（zh-HK）與英文（en）即時切換並持久化於本地偏好。
* **📱 PWA 支援**：
  * 完整 `manifest.json` 與雙尺寸高質感圖示，手機瀏覽器可一鍵「加入主畫面」全螢幕運行。

---

### 🏛️ 架構概觀

```

[ 觀眾端 Audience ]  ───┐
├── TLS 1.3 / WSS ──► [ Cloudflare Workers Relay ]
[ 主持端 Host ]      ───┤                          │
│                     Durable Objects
[ 大螢幕 Display ]   ───┘                    (RoomHub 邊緣記憶體)

```

---

### 🛡️ 隱私與安全架構
* **傳輸防護**：全站強制採用 TLS 1.3、嚴格 Content Security Policy (CSP) 與 Permissions-Policy。
* **時序攻擊防禦**：密鑰比對全數採用常數時間比對（Constant-Time `timingSafeEqual`）。
* **非 AI 聲明與法規適用性**：本系統為純確定性傳輸中繼軟體，不涉及機器學習演算法與自動化決策，豁免 EU AI Act 與 ISO 42001，嚴格遵循 GDPR 與香港《個人資料（私隱）條例》（PDPO）。詳情參閱 [`COMPLIANCE.md`](./COMPLIANCE.md)。

---

### 🚀 快速本地開發與部署

#### 1. 前端（Static Pages）
前端可直接由 GitHub Pages 或任何靜態 HTTP 伺服器託管：
```bash
# 本地預覽
npx serve .

```

#### 2. 後端（Cloudflare Workers & Durable Objects）

```bash
cd backend
npm install

# 部署至 Cloudflare 生產環境
npx wrangler deploy

```

---

## 🌐 English

### 📌 Vision & Core Philosophy

**AskIf** is a mission-critical, enterprise-ready live Q&A interaction system architected for executive summits, academic symposia, and confidential board sessions. Built squarely upon **Privacy by Design**:

* **Zero Database Persistence**: Operates entirely within Cloudflare Workers edge-native volatile memory and Durable Objects.
* **Zero-PII Compliance**: Gathers no names, emails, phone numbers, persistent cookies, or IP tracking profiles.
* **Ephemeral Auto-Purge**: All state representations are automatically discarded once active WebSocket sessions conclude.

---

### ✨ Core Capabilities

* **🎙️ Host War Room & Moderation Board**:
* Hosts set their own **custom passcode** (4-16 chars) upon room creation; authentication is validated via cryptographically signed HMAC-SHA256 tickets.
* Press-and-hold (0.8s) gesture protection to prevent accidental push/pull to the stage display.


* **📱 Frictionless Audience Interaction**:
* Instant join via 6-digit room PIN or stage QR scan—no registration or password required.
* Microsecond XSS sanitization (200-character cap) with real-time upvoting.


* **🖥️ Stage Display Engine**:
* Double-click fullscreen toggle and 3-second auto-hiding cursor for immaculate presentations.
* Idle view features crisp vector QR codes; spotlight view scales up selected inquiries with a persistent mini-QR badge.


* **🛡️ Enterprise Resource Protection**:
* Global hard ceiling capping concurrent active sessions at **725 rooms** to eliminate infrastructure exhaustion.
* Edge-native IP-based rate limiting on room creation endpoints.


* **🌐 Native Bilingual Experience**:
* Seamless runtime switching between Traditional Chinese (`zh-HK`) and English (`en`).


* **📱 Progressive Web App (PWA)**:
* Packed with `manifest.json` and high-res adaptive squircle icons for native-like home screen launch on iOS/Android.



---

### 🛡️ Security & Privacy Assurance

* **Network Security**: Strict TLS 1.3, Content Security Policy (CSP), and restrictive Permissions-Policy headers.
* **Side-Channel Mitigation**: Constant-time comparison (`timingSafeEqual`) on all ticket and signature verifications.
* **Regulatory Exclusions & Alignment**: Purely deterministic middleware without autonomous models or automated profiling—fully exempt from the EU AI Act and ISO 42001 while thoroughly aligned with GDPR (Data Minimization) and HK PDPO. See [`COMPLIANCE.md`](https://www.google.com/search?q=./COMPLIANCE.md&utm_source=gemini) for legal assessments.

---

### 🚀 Quick Start & Deployment

#### 1. Frontend

Static files can be hosted directly on GitHub Pages or any static CDN:

```bash
# Serve locally
npx serve .

```

#### 2. Backend Relay

```bash
cd backend
npm install

# Deploy to Cloudflare production
npx wrangler deploy

```

---

### 📄 License

Released under the [MIT License](https://www.google.com/search?q=LICENSE&utm_source=gemini).