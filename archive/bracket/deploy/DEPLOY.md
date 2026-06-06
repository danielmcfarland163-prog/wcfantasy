# Deploy /worldcup to garageapothecary.com

Run these two commands from this folder in your terminal:

```
wrangler login
wrangler deploy
```

That's it. The page will be live at garageapothecary.com/worldcup.

---

**What this does:**
- Creates a new Cloudflare Worker called `worldcup-2026`
- Serves `public/worldcup.html` at garageapothecary.com/worldcup
- Runs alongside the main site without touching it

**If you get a "zones" error on deploy:**
Go to dash.cloudflare.com → garageapothecary.com → Workers Routes → Add route:
- Route: `garageapothecary.com/worldcup*`
- Worker: `worldcup-2026`
