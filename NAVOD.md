# Kaboom: zapnutí sdílení s kamarády

Aby aplikace fungovala "doopravdy" (účty, videa, přátelé, live), potřebuje server. Použijeme zdarma Supabase.

## 1. Supabase (jednou)
1. Jdi na supabase.com, zaregistruj se a klikni **New project**. Vyplň název (kaboom) a heslo databáze, region nech nejbližší (třeba Frankfurt) a počkej, než se projekt vytvoří.
2. Vlevo otevři **SQL Editor** → **New query**, vlož celý obsah souboru `supabase.sql` a klikni **Run**. Mělo by to napsat Success.
3. Vlevo **Authentication** → **Sign In / Providers** (nebo Providers) → **Email** → vypni **Confirm email** a ulož.
4. Vlevo dole **Project Settings** → **API** (někde to může být **API Keys**). Zkopíruj **Project URL** a klíč **anon public**.

## 2. Vlož klíče do aplikace
1. V GitHub repozitáři otevři `www/config.js`, klikni na tužku.
2. Místo `VLOZ_SUPABASE_URL` vlož Project URL, místo `VLOZ_ANON_KEY` anon klíč. Nech uvozovky.
3. **Commit changes**. APK se sestaví znovu (záložka Actions).

## 3. Použití
- Každý kamarád si nainstaluje stejné APK a vytvoří si účet.
- Přidáte se přes 🔍 (hledání jména) → Přidat do přátel → druhý žádost přijme v Profilu.
- Live: záložka Live → Spustit live → ➕ pošle kód místnosti, kamarádi ho zadají nebo live uvidí v seznamu.

## Limity
- Zdarma je ve Supabase 1 GB videí a nejvýš 50 MB na jedno video.
- Live je přímé spojení mezi telefony (až 5 lidí). V některých mobilních sítích se spojení nemusí podařit.
