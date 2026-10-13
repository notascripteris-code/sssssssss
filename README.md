# Kaboom

Aplikace ve stylu YouTube a TikToku se sdílením s kamarády. Nastavení serveru najdeš v NAVOD.md.

## APK bez Android Studia (GitHub Actions)

1. Na github.com vytvoř nový repozitář (třeba `kaboom`).
2. Nahraj do něj **všechny soubory z tohoto projektu**, včetně skryté složky `.github`.
   Nejjednodušeji: rozbal ZIP, na stránce repozitáře dej *Add file → Upload files* a přetáhni obsah složky.
   Pokud ti web složku `.github` nepřijme, použij `git push` z počítače.
3. Otevři záložku **Actions**. Workflow *Build APK* se spustí sám (případně *Run workflow*).
4. Za 4 až 6 minut dole na stránce běhu najdeš **Artifacts → kaboom-apk**. Stáhni ZIP a rozbal `app-debug.apk`.
5. Pošli APK do telefonu a otevři ho. Android se zeptá na povolení instalace z neznámých zdrojů.

## Lokální sestavení

```
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```
APK najdeš v `android/app/build/outputs/apk/debug/`.

## Úpravy

Celý kód aplikace je ve složce `www/` (`index.html`, `style.css`, `app.js`). Po změně stačí znovu nahrát na GitHub.

## Poznámky

- Ukázková videa jsou animované náhrady, žádný cizí obsah. Vlastní videa nahraná z telefonu se drží jen v paměti a po zavření aplikace zmizí.
- Lajky, komentáře, sledování a jméno se ukládají v telefonu.
- Jde o debug APK, hodí se pro vlastní telefon. Pro Google Play je potřeba podepsaný release build.
