# Pulse — Setup Guide



This guide will get your app live on the internet in about 30 minutes.
No coding knowledge needed. Just follow each step exactly.

You'll need a laptop/computer with a web browser. That's it.

---

## STEP 1: Create your free accounts (10 minutes)

You need 3 free accounts. Think of these as:
- **GitHub** = where your app's code lives (like Google Drive for code)
- **Supabase** = your app's database (stores everyone's tasks securely)
- **Vercel** = your app's home on the internet (makes it accessible to anyone)

### 1a. GitHub
1. Go to https://github.com
2. Click "Sign up" → create an account with your email
3. Verify your email

### 1b. Supabase
1. Go to https://supabase.com
2. Click "Start your project" → sign in with your GitHub account
3. Click "New Project"
4. Give it a name: `pulse-app`
5. Set a database password (save this somewhere safe!)
6. Choose region: closest to you (e.g., Mumbai for India)
7. Click "Create new project" — wait 2 minutes for it to set up

### 1c. Vercel
1. Go to https://vercel.com
2. Click "Sign Up" → sign in with your GitHub account
3. Done! You'll come back to this later.

---

## STEP 2: Set up your database (5 minutes)

This creates the tables where everyone's tasks will be stored.

1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase/schema.sql` from this project
4. Copy ALL the text from that file
5. Paste it into the SQL Editor
6. Click **"Run"** (the green play button)
7. You should see "Success. No rows returned" — that means it worked!

### Enable Google Sign-in (optional but recommended)
1. In Supabase, go to **Authentication** → **Providers**
2. Find **Google** and toggle it on
3. You'll need to set up Google OAuth credentials:
   - Go to https://console.cloud.google.com
   - Create a new project
   - Go to APIs & Services → Credentials → Create OAuth 2.0 Client ID
   - Add your Supabase URL as authorized redirect URI
   - Copy the Client ID and Secret back into Supabase

---

## STEP 3: Upload your code to GitHub (5 minutes)

1. Go to https://github.com/new
2. Repository name: `pulse-app`
3. Keep it **Public** (or Private if you prefer)
4. Click **"Create repository"**
5. Now you need to upload all the files from this project folder

### If you've never used GitHub before:
The easiest way is to use GitHub's web interface:
1. On your new repository page, click **"uploading an existing file"**
2. Drag and drop ALL files and folders from this `pulse-app` folder
3. Click **"Commit changes"**

### If you have Git installed:
Open Terminal/Command Prompt, navigate to this folder, and run:
```
git init
git add .
git commit -m "Initial commit - Pulse app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pulse-app.git
git push -u origin main
```

---

## STEP 4: Get your Supabase keys (2 minutes)

1. In Supabase, go to **Settings** → **API**
2. You'll see two values you need:
   - **Project URL** — looks like `https://xxxxx.supabase.co`
   - **anon / public key** — a long string of letters and numbers
3. Copy both of these. You'll need them in the next step.

---

## STEP 5: Deploy to Vercel (5 minutes)

This puts your app on the internet.

1. Go to https://vercel.com/new
2. It will show your GitHub repositories
3. Find **pulse-app** and click **"Import"**
4. Before clicking Deploy, click **"Environment Variables"**
5. Add these two variables:
   - Name: `NEXT_PUBLIC_SUPABASE_URL` → Value: your Project URL from Step 4
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Value: your anon key from Step 4
6. Click **"Deploy"**
7. Wait 2-3 minutes...
8. 🎉 Your app is LIVE! Vercel gives you a URL like `pulse-app.vercel.app`

---

## STEP 6: Create app icons (2 minutes)

Your app needs icons so it looks good when installed on phones.

1. Go to https://favicon.io/favicon-generator/
2. Type "P" as the text
3. Choose a blue background (#007AFF)
4. Download the icons
5. Create a folder called `icons` inside the `public` folder
6. Put the 192x192 and 512x512 PNG files there
7. Name them `icon-192.png` and `icon-512.png`
8. Push the update to GitHub (Vercel will auto-redeploy)

---

## STEP 7: Share with friends! 🚀

Send your friends the URL (e.g., `https://pulse-app.vercel.app`)

Tell them:
1. Open the link in Chrome (Android) or Safari (iPhone)
2. Sign up with email or Google
3. **To install on phone:**
   - **Android**: Tap the 3-dot menu → "Add to Home Screen"
   - **iPhone**: Tap the Share button → "Add to Home Screen"
4. Now it works like a real app!

---

## OPTIONAL: Custom domain

Want `pulse.yourdomain.com` instead of `pulse-app.vercel.app`?

1. Buy a domain from https://namecheap.com or https://domains.google (costs ~$10/year)
2. In Vercel, go to your project → Settings → Domains
3. Add your domain and follow the DNS instructions
4. Vercel handles SSL (the lock icon) automatically

---

## Troubleshooting

**"Something went wrong" on login:**
→ Check that your Supabase URL and key are correct in Vercel's Environment Variables

**Tasks disappear on refresh:**
→ Make sure you ran the SQL schema in Step 2

**Voice input doesn't work:**
→ Only works in Chrome and Safari. Make sure you allow microphone permission.

**App doesn't install on phone:**
→ Make sure you're opening it in Chrome (Android) or Safari (iPhone), not inside another app

---

## What's next?

Once your friends are using it, come back and we'll add:
- Google Calendar integration
- Stripe payments ($2/month after 6 months)
- Push notifications
- More features based on what your users want

---

Built with ❤️ using Next.js, Supabase, and Vercel.
