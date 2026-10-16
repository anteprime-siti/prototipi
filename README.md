# prototipi

Anteprime dei siti realizzati su richiesta. Ogni sito vive in una sua sottocartella e viene pubblicato con GitHub Pages su:

`https://anteprime-siti.github.io/prototipi/<nome-sito>/`

Organizzazione GitHub: **anteprime-siti** (creata dall'account sebabreak).

- Elenco anteprime: https://anteprime-siti.github.io/prototipi/
- Artista pittore: https://anteprime-siti.github.io/prototipi/artista-pittore/

## Struttura

```
prototipi/
├── index.html          ← il banco: elenco + anteprima dal vivo (aggiungere un sito nella lista SITI dello <script>)
├── .nojekyll           ← dice a GitHub Pages di servire i file così come sono
└── artista-pittore/
    ├── index.html      ← il sito (dati delle opere in cima allo <script>)
    └── img/            ← foto dei quadri e ritratto
```

## Pubblicare le anteprime

1. Crea su GitHub un repository chiamato `prototipi` e carica il contenuto di questa cartella.
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, cartella `/ (root)`.
3. Dopo un minuto le anteprime sono online all'indirizzo sopra.

## Quando un sito è finito

1. Crea un repository dedicato (es. `nome-cognome-arte`), meglio ancora sull'account del cliente o con lui come collaboratore.
2. Copia lì il contenuto della sottocartella (l'`index.html` deve stare nella root).
3. Attiva GitHub Pages e in Settings → Pages → Custom domain inserisci il dominio (es. `nomecognome.it`). GitHub crea il file `CNAME`.
4. Dal registrar del dominio aggiungi i record DNS indicati da GitHub (A verso gli IP di GitHub Pages per il dominio principale, CNAME per `www`), poi spunta **Enforce HTTPS**.
5. Nell'`index.html` di `prototipi`, nella lista SITI, metti `stato: "online"` e sostituisci `url` con il nuovo dominio.

## Pulsante di ritorno

Ogni anteprima include `<script src="../banco.js"></script>` prima di `</body>`: mostra in basso a sinistra un pulsante per tornare al banco o al portfolio di Sebastyan. Non compare dentro il monitor del banco. Quando il sito va consegnato, togli quella riga.

## Aggiungere un sito al banco

In `index.html` copia un blocco della lista `SITI` e cambia nome, tipo, descrizione, url, stato (`bozza`, `anteprima`, `revisione`, `online`) e data. Per linkare direttamente un sito: `https://anteprime-siti.github.io/prototipi/#id-del-sito`.

## Note
- Foto dei quadri: JPG, lato lungo circa 2000 px, sotto i 500 KB ciascuna.
- Nomi file senza spazi né accenti (es. `tramonto-sul-po-2024.jpg`).
