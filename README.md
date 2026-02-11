# Vassana (formerly NostrMeet) 🤝

**Vassana** คือแอปพลิเคชันสำหรับค้นหาผู้คนที่มีความสนใจเหมือนกันในพิกัดใกล้เคียง โดยใช้โครงสร้างพื้นฐานแบบ Decentralized (Nostr Protocol) เน้นความเป็นส่วนตัวและการเจอตัวจริง (IRL - In Real Life)

## 🌟 ฟีเจอร์หลัก (Features)
*   **📍 ระบุพิกัดแม่นยำ (Location-Based):**
    *   ค้นหาเพื่อนใหม่ในรัศมีใกล้เคียง
    *   เช็คอิน (Check-in) เพื่อบอกว่า "ฉันอยู่ที่นี่และพร้อมคุย"
*   **🎭 เลือกบทบาท (Personas):** ระบุสถานะตัวเองได้ชัดเจน เช่น พ่อค้า (Merchant), นักลงทุน (Investor), สายเทค (Technologist) หรือศิลปิน (Artist)
*   **🗣️ จับคู่ความสนใจ (Topic Matching):**
    *   เลือกหัวข้อที่สนใจ เช่น Bitcoin, Economics, Privacy, Music, Art
    *   ระบุได้ว่าอยากเป็นฝ่าย "คุย" (Talk 🗣️) หรือ "ฟัง" (Listen 👂) หรือ "ไม่สนใจ" (Ignore ⚪)
*   **🕵️‍♂️ ค้นหาเพื่อน (Find Peers):** สแกนหาคนที่ Match กับเรา และแสดงผลแบบการ์ดข้อมูลพร้อมระยะห่าง
*   **🔐 ล็อกอินปลอดภัย (Secure Login):** ใช้ NIP-07 (Extension) หรือ Nsec (Private Key) โดยเก็บข้อมูลในเครื่องผู้ใช้เท่านั้น
*   **🗺️ Interactive Map:** แผนที่ตอบสนองไว พร้อมหมุดแสดงตำแหน่งและ Pop-up ข้อมูลครบถ้วน

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)
*   **Frontend:** Vanilla JavaScript (ES Modules), HTML5, CSS3
*   **Protocol:** [Nostr](https://nostr.com) (NIP-01, NIP-19, NIP-07)
*   **Map:** Leaflet.js & OpenStreetMap
*   **Cryptography:** `nostr-tools`, `@noble/secp256k1`
*   **Build Tool:** Vite

---

# Vassana (English Description) 🌍

**Vassana** is a location-based social discovery app built on the decentralized Nostr protocol. It fosters genuine In-Real-Life (IRL) connections by matching users based on proximity, personas, and shared interests.

## 🌟 Key Features
*   **📍 Location-Based Discovery:** Find like-minded peers nearby or check-in to broadcast your availability.
*   **🎭 Persona Selection:** Clearly define who you are (e.g., Merchant, Investor, Technologist, Artist).
*   **🗣️ Topic & Role Matching:**
    *   Select topics of interest (Bitcoin, Privacy, Art, etc.).
    *   Choose your role for each topic: "Talk" (🗣️), "Listen" (👂), or "Ignore" (⚪).
*   **🕵️‍♂️ Find Peers Scanner:** Intelligent scanning to find compatible peers and display them in interactable result cards.
*   **🔐 Decentralized Identity:** Secure login via Nostr keys (NIP-07 or direct Nsec), ensuring data stays on your device.
*   **🗺️ Modern UI/UX:** A sleek, dark-themed interface with an interactive map and floating action controls.

## 🚀 How to Run
1.  **Clone the repo:** `git clone https://github.com/your-username/vassana.git`
2.  **Install dependencies:** `npm install`
3.  **Run dev server:** `npm run dev`
4.  **Build for production:** `npm run build`

## 📜 License
MIT License
