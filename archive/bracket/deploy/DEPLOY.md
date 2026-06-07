# Deploy /soccer-fantasy-bracket to garageapothecary.com

Run these two commands from this folder in your terminal:

```
wrangler login
wrangler deploy
```

That's it. The page will be live at garageapothecary.com/soccer-fantasy-bracket.

---

**What this does:**
- Creates a new Cloudflare Worker called `soccer-fantasy-bracket`
- Serves `public/soccer-fantasy-bracket.html` at garageapothecary.com/soccer-fantasy-bracket
- Runs alongside the main site without touching it

**If you get a "zones" error on deploy:**
Go to dash.cloudflare.com → garageapothecary.com → Workers Routes → Add route:
- Route: `garageapothecary.com/soccer-fantasy-bracket*`
- Worker: `soccer-fantasy-bracket`
