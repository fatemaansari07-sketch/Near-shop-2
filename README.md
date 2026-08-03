# ShopNear

Hyperlocal neighbourhood marketplace app — prototype/demo (frontend only, no backend yet).

## Local me chalane ke liye

```bash
npm install
npm run dev
```

Browser me `http://localhost:5173` khul jaayega.

## GitHub pe daalna

```bash
git init
git add .
git commit -m "ShopNear v1"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## Render pe deploy karna (Static Site)

1. Render dashboard me **"New +" → "Static Site"** chuno
2. Apna GitHub repo connect karo
3. Settings:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. "Create Static Site" dabao — kuch minute me live ho jaayega

## ⚠️ Zaroor padhiye — abhi ki limitations

Ye app **poori tarah frontend-only** hai — sab data (shops, products, stock, bids, users) sirf browser ki memory me hai:

- Page reload karte hi sab data reset ho jaayega
- Do alag phone/browser me alag data dikhega — kisi ek ko sync nahi hoga
- Payments (Flash Deal, Feed post) sab mock/fake hain, koi asli paisa nahi katega
- Barcode scanning simulate hoti hai (asli camera scanning nahi)

**Live/real business ke liye chahiye:**
- Backend server (Node/Express ya similar) + database (Postgres/MongoDB)
- Real authentication (OTP service jaisa Twilio/MSG91)
- Real payment gateway (Razorpay/PayU) Flash Deals aur Feed posts ke liye
- Real barcode scanning library (camera access ke saath)

Ye deploy hone ke baad ek **shareable demo/prototype** ban jaayega jo investors, potential shop owners, ya testers ko dikhaya ja sakta hai — lekin production business ke liye backend zaroori hai.

