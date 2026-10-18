# Fuori Tono · v2

Il gioco dell’impostore da fare a voce. Progetto personale di Sebastyan Buryas, sezione laboratorio di `prototipi`.

- **index.html**: pagina iniziale, si sceglie *Ospita una partita* o *Entra in una partita*
- **host.html**: lo schermo comune (TV, computer, tablet o telefono): QR, sospettati, turni, voto, risultati, impostazioni
- **gioca.html**: il telefono di ogni giocatore (ci si arriva anche dal QR)

Online: `https://anteprime-siti.github.io/prototipi/fuori-tono/`

## Novità della v2
- Nuovo look scuro, tra noir e quiz show; la parola segreta è sotto una barra censurata e si legge tenendo premuto.
- Pagina iniziale con scelta tra host e giocatore; l’host funziona anche da telefono.
- **Gioco anch’io**: chi ospita può partecipare dallo stesso dispositivo, con la scheda privata «La mia carta».
- Profilo del giocatore: nome, simbolo (16 icone) oppure una propria foto. Resta salvato sul telefono per le volte successive.
- Il giocatore può modificare il profilo o uscire dalla stanza; l’host può rinominare, cambiare simbolo e colore, togliere la foto o togliere un giocatore, anche a partita in corso.
- Voto in due passaggi: si sceglie il sospettato, poi **Conferma** o **Annulla**; dopo il voto c’è **Cambia voto**.

## Novità della v3
- Collegamento più affidabile: oltre al collegamento diretto, il gioco usa i relay gratuiti di PeerJS quando i telefoni sono su reti diverse (es. uno in 4G e uno in Wi‑Fi).
- Lo schermo resta acceso durante la partita, su host e telefoni (dove il browser lo permette).
- Chi parla può passare il turno dal proprio telefono con «Ho detto la mia», senza toccare lo schermo dell’host.
- Nel risultato si vede chi ha votato chi.
- Sul telefono c’è «Come si gioca»; l’host su telefono ha le schede Tavolo / La mia carta su una riga.

## Novità della v4
- **Termina la partita** (X in alto sullo schermo dell’host): interrompi e torna alla sala d’attesa, oppure chiudi la stanza per tutti.
- **Partite in sospeso**: ricaricando la stessa scheda la stanza riparte da sola; riaprendo il gioco più tardi si sceglie se riprenderla o aprirne una nuova. La pagina iniziale propone «Riprendi la stanza» o «Rientra nella stanza».
- **Ruoli combinati**: impostori e undercover insieme, ognuno con il suo numero, più le combo pronte Classica, Undercover, Misto, Caos, Veloce, Esperti.
- **Fuori dal gioco** sullo schermo: chi è stato votato (con il ruolo), chi ha lasciato e chi è stato tolto; avviso sullo schermo e sui telefoni.
- Chi viene tolto dall’host non rientra più da solo; segnale di vita ogni 3 secondi, così i telefoni si ricollegano in fretta se lo schermo dell’host cade.

## Da sapere
- Serve internet su tutti i dispositivi (collegamento iniziale tramite il server gratuito di PeerJS; librerie PeerJS e QR caricate dalla cartella lib/).
- Lo schermo dell’host deve restare aperto; se si ricarica, stanza e giocatori vengono ripresi.
- Meglio tutti sullo stesso Wi‑Fi: con alcune reti mobili molto chiuse il collegamento diretto può non riuscire.
- Parole e temi: `js/parole.js`.
