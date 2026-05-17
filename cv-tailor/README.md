# CV Tailor 🎯

AI-powered CV customisation app. Upload your CV, paste a job description, get a tailored CV instantly — free, private, no data stored.

## Stack
- **Next.js 14** — frontend + API routes
- **Groq API** — free AI inference (llama-3.3-70b-versatile)
- **pdf-lib** — client-side PDF generation
- **mammoth** — DOCX text extraction
- **Vercel** — free hosting

---

## 🚀 Deploy in 5 minutes

### Step 1 — Get a free Groq API key
1. Go to [console.groq.com](https://console.groq.com)
2. Sign in with Google
3. Click **API Keys → Create API Key**
4. Copy the key (starts with `gsk_`)

### Step 2 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cv-tailor.git
git push -u origin main
```

### Step 3 — Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project**
3. Import your `cv-tailor` repository
4. Click **Deploy** — no environment variables needed (users bring their own Groq key)
5. Done! Your app is live at `https://cv-tailor-xxx.vercel.app`

---

## 🖥️ Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## How it works

1. User enters their **free Groq API key** (never stored, used for this request only)
2. User uploads their **CV files** — DOCX, PDF, or TXT (multiple files supported)
3. User pastes the **job description** or enters a URL
4. The app parses the files, sends everything to Groq's Llama 3.3 70B model
5. The AI rewrites bullets to mirror JD language, reorders for relevance, rewrites the summary
6. User sees a **changes summary** and can **download a formatted PDF**

---

## Notes
- No database, no login, no data persistence — fully stateless
- All file processing happens server-side per request, nothing is saved
- The Groq free tier allows 14,400 requests/day — plenty for personal use
