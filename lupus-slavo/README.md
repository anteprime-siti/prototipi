# Lupus slavo · v1

Il gioco del lupo mannaro da fare a voce, ambientato tra le leggende slave. Progetto personale di Sebastyan Buryas, sezione laboratorio di `prototipi`. Gioco separato da Fuori Tono, con cui condivide solo la base tecnica (collegamento, QR, profili, ripresa delle partite).

- **index.html**: pagina iniziale, si sceglie *Ospita una partita* o *Entra nel villaggio*
- **host.html**: lo schermo del narratore (TV, computer, tablet): QR, abitanti, notte, alba, giorno, voto, cimitero, impostazioni
- **gioca.html**: il telefono di ogni giocatore (ci si arriva anche dal QR)

Online: `https://anteprime-siti.github.io/prototipi/lupus-slavo/`

## Come si gioca (da 4 a 20, meglio 6 o più)
1. **Ruoli.** Ognuno tiene premuta la carta sul telefono e scopre chi è. I lupi vedono gli altri lupi.
2. **Notte.** Tutti prendono il telefono e scelgono un nome dalla lista, con la stessa schermata: così nessuno capisce chi ha un potere.
   - **Lupo (Vovkulaka)**: i lupi scelgono la preda e vedono le scelte degli altri; devono essere d’accordo.
   - **Veggente (Vorozhka)**: scopre subito se una persona è un lupo.
   - **Guaritore (Znakhar)**: protegge una persona, anche sé stesso, ma non la stessa due notti di fila.
   - **Cacciatore (Myslyvets)** e **Abitante (Selianyn)**: scelgono un sospetto, senza effetto.
3. **Alba.** Lo schermo svela chi è stato sbranato (o che nessuno è morto).
4. **Giorno.** Si discute (tempo libero o con timer), poi si vota dal telefono. Pareggio: ballottaggio; secondo pareggio: nessuno cacciato.
5. **Cacciatore.** Se muore, sceglie dal telefono chi colpire con l’ultima freccia.
6. **Fine.** Vince il villaggio se i lupi sono zero; vincono i lupi quando sono tanti quanti gli altri. Chi vince prende 1 punto.

## Impostazioni
- Combo pronte: Classica, Completa, Al buio, Veloce, Prima notte tranquilla.
- Numero di lupi automatico (1 fino a 6 giocatori, 2 fino a 11, 3 fino a 16, poi 4) o scelto a mano.
- Veggente, guaritore e cacciatore attivabili uno per uno; con pochi giocatori si tolgono da soli, resta sempre almeno un abitante.
- Svelare o no il ruolo di chi muore, uccisione già dalla prima notte, tempo di discussione, voce del narratore.

## Da sapere
- Il narratore parla con la voce italiana del dispositivo dell’host (si spegne dal pulsante con l’altoparlante).
- L’host può forzare l’alba («Fai sorgere il sole») se qualcuno non sceglie, interrompere la partita o chiudere la stanza (X in alto).
- «Gioco anch’io»: chi ospita può giocare dallo stesso dispositivo, con la scheda privata «Il mio ruolo». Funziona, ma di notte gli altri non devono guardare.
- Ricaricando la scheda la stanza riparte da sola; riaprendo più tardi si sceglie se riprenderla.
- Serve internet su tutti i dispositivi (PeerJS, con relay per reti diverse). Il profilo del giocatore è lo stesso di Fuori Tono.
