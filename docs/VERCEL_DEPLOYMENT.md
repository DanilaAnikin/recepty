# Vercel Deployment

Tato aplikace je pripravena jako Flutter web/PWA build pro Vercel.

## Co je hotove

- Web build prochazi pres `flutter build web`
- Persistenci resi `sembast_web`, takze data zustanou v prohlizeci i po obnoveni stranky
- PWA metadata jsou nastavena pro `Recepty Terinky`
- Projekt obsahuje `vercel.json`
- Projekt obsahuje `scripts/vercel_install_flutter.sh`
- Projekt obsahuje build skript `scripts/vercel_build.sh`

## Nasazeni na Vercel

1. Nahraj repozitar na GitHub.
2. Ve Vercelu zvol `Add New -> Project`.
3. Vyber tento repozitar.
4. Ponech `Framework Preset` jako `Other`.
5. Vercel si nacte `vercel.json`.
6. Spust prvni deploy.

Pokud by Vercel neprevzal konfiguraci automaticky, nastav rucne:

- Build Command: `bash scripts/vercel_build.sh`
- Output Directory: `build/web`
- Install Command: `bash scripts/vercel_install_flutter.sh`

## Domena

Po prvnim deployi:

1. Otevri projekt ve Vercelu.
2. Jdi do `Settings -> Domains`.
3. Pridej `recepty-terinky.cz`.
4. Pridej i `www.recepty-terinky.cz`, pokud chces pouzivat obe varianty.
5. DNS nastav podle hodnot, ktere ti ukaze Vercel pro konkretni projekt.

## iPhone home screen

Po nasazeni:

1. Otevri web v Safari na iPhonu.
2. Klepni na `Sdilet`.
3. Zvol `Add to Home Screen`.
4. Potvrd pridani.

Pak se bude aplikace otevirat z plochy jako web app.
