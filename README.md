# Björklunds Rapport

Webbapp (PWA) för att rapportera skott och fällt vilt under jakt. Den körs i
mobilens webbläsare, kan installeras på hemskärmen och fungerar utan
täckning ute i skogen.

**Öppna appen:** <https://stevoxa.github.io/bjorklunds-rapport/>

<p>
  <img src="docs/screenshots/skott.png" width="240" alt="Fliken Skott: knapparna Avlossat skott och Ny såt, med en lista över loggade skott">
  <img src="docs/screenshots/fallt-vilt.png" width="240" alt="Fliken Fällt vilt: kronhjort, vildsvin och rådjur med skytt, pass och om köttet är fördelat">
  <img src="docs/screenshots/kottfordelning.png" width="240" alt="Köttfördelning grupperad på Till slakteriet och Till annan plats">
</p>

## Vad appen gör

- **Skott:** ett tryck på _Avlossat skott_ loggar klockslaget. _Ny såt_
  delar in skotten per såt. Varje skott kan verifieras och kopplas till
  ett fällt vilt.
- **Fällt vilt:** viltslag, skytt, pass, tid och köttfördelning, med
  snabbval för vanliga fördelningar. Visar direkt vilket vilt som ännu inte
  är fördelat.
- **Rapporter & admin:**
  - Köttfördelningen sammanställs per jakt och kan kopieras eller delas
    som text.
  - Hela jakten kan exporteras som CSV, anpassad för svensk Excel.
  - Varje jakttillfälle sparas för sig och kan öppnas igen eller tas bort.
- **Dela appen** med QR-kod, plus ljust och mörkt tema.

All data sparas lokalt i webbläsaren (`localStorage`) på den enhet där den
matas in. Inget skickas till någon server. Data som rensas, eller ligger
på en annan telefon, finns alltså inte kvar någon annanstans. Exportera
CSV om något ska sparas.

## Installera på mobilen

- **Android (Chrome):** meny ⋮ → _Installera appen_ eller _Lägg till på
  startskärmen_.
- **iPhone (Safari):** Dela-knappen → _Lägg till på hemskärmen_.

Appens hjälpsida (knappen högst upp) beskriver alla funktioner i detalj.

## Teknik

Vanlig HTML, CSS och JavaScript utan ramverk och utan byggsteg. Filerna
serveras precis som de ligger i repot:

| Fil                | Innehåll                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `index.html`       | Sidans struktur: flikar, formulär och dialoger                                                 |
| `styles.css`       | Utseende, ljust och mörkt tema                                                                 |
| `storage.js`       | All läsning och skrivning i `localStorage`                                                     |
| `app.js`           | Appens logik: skott, såtar, fällt vilt, köttfördelning, CSV-export och sparade jakter          |
| `sw.js`            | Service worker. Appens filer hämtas från nätet i första hand och från cachen utan nät          |
| `manifest.json`    | PWA-manifest: namn, ikoner, färger                                                             |
| `videos/intro.mp4` | Introfilm (4 s, 720×1280, utan ljud), högst en gång per dag. Cachas inte, hoppas över utan nät |

QR-koden genereras med [QRious](https://github.com/neocotic/qrious), som
laddas från cdnjs och cachas för offlinebruk.

### Köra lokalt

Service workern kräver `http://localhost` eller HTTPS. Att öppna filen
direkt fungerar inte. Kör i repots rot:

```bash
python -m http.server 8000
```

Öppna sedan <http://localhost:8000>.

### Lint och formatering

`package.json` finns bara för utvecklingsverktygen (ESLint och Prettier).
Appen själv har inga beroenden.

```bash
npm install
```

```bash
npm run lint
```

`npm run format` formaterar om alla filer. Samma kontroll som `npm run lint`
körs i GitHub Actions vid varje push och pull request.

### Publicering

GitHub Pages publicerar `main` direkt från rotkatalogen. Höj `CACHE_NAME` i
`sw.js` när ikonerna eller QRious-versionen ändras. Övriga filer hämtas alltid
färska när det finns nät.

## Licens

[MIT](LICENSE)
