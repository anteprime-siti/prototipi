# Fuori Tono

Il gioco dell’impostore da fare a voce. Il monitor fa da tavolo, ogni giocatore usa il proprio telefono.

- **index.html**: il monitor (QR, giocatori, turni, voto, risultati, impostazioni)
- **gioca.html**: la pagina che si apre dal telefono inquadrando il QR

Non serve un server: monitor e telefoni si collegano direttamente tra loro (WebRTC con PeerJS). Basta pubblicare la cartella.

## Dove si trova

Progetto personale di Sebastyan Buryas, nella sezione **laboratorio** del repository `prototipi`. Online sarà su:

`https://anteprime-siti.github.io/prototipi/fuori-tono/`

Apri quell’indirizzo sul computer collegato al monitor e premi il tasto “schermo intero”. I giocatori inquadrano il QR oppure aprono `.../fuori-tono/gioca.html` e scrivono il codice di 4 lettere.

Se un giorno vorrai dargli un indirizzo suo, basta copiare questa cartella in un repository dedicato e attivare GitHub Pages.

## Come si gioca

1. **Scopri la carta**: tutti ricevono la parola segreta, tranne l’impostore (o gli impostori).
2. **Di’ una parola**: a turno, ad alta voce, una parola collegata. Il monitor indica chi parla.
3. **Vota**: dal telefono si vota chi è fuori tono. Se l’impostore viene scoperto può provare a indovinare la parola per rubare la vittoria.

Punti: +1 a ogni innocente se vincono gli innocenti, +2 a ogni impostore se vincono gli impostori, +1 extra a chi indovina la parola.

## Impostazioni (dal monitor)

- Temi: 18 temi pronti (Cibo, Luoghi, Animali, Oggetti, Colori con campione, Film e serie, Sport, Mestieri, Arte, Musica, Città e paesi, Tech e app, Viaggi, Scuola e uni, Fantasy ed eroi, Feste, Emozioni, Torino) più le vostre parole.
- Numero di impostori, oppure “a sorpresa”.
- Cosa vede l’impostore: niente, la categoria, una parola simile come indizio, oppure **Undercover** (riceve la parola simile senza sapere di essere l’impostore).
- Giri di indizi prima del voto, tempo per turno, parola visibile una sola volta o sempre, categoria sul monitor, ultima chance, votazione unica o fino all’ultimo.

## Da sapere

- Serve internet sia sul monitor sia sui telefoni (il collegamento iniziale passa dal server gratuito di PeerJS).
- La pagina del monitor deve restare aperta: se si ricarica, la stanza e i giocatori vengono ripresi.
- Funziona meglio con tutti sulla stessa rete Wi‑Fi. Con alcune reti mobili molto chiuse il collegamento diretto può non riuscire.
- Per aggiungere parole o temi: `js/parole.js`.

## Prova in locale

Serve un piccolo server (i file aperti con doppio clic non funzionano):

```
python -m http.server 8080
```

e poi `http://localhost:8080` sul computer. Per i telefoni sulla stessa rete usa l’indirizzo IP del computer.
