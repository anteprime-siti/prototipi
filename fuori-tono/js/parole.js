// Pacchetti di parole: [parola, parola simile]. Nel tema Colori: [nome, hex, simile, hex].
window.FT_PACKS = [
  { id: 'cibo', name: 'Cibo', color: '#FF5B3A', items: [
    ['Pizza','Piadina'],['Lasagne','Cannelloni'],['Gelato','Granita'],['Cappuccino','Latte macchiato'],
    ['Hamburger','Hot dog'],['Tiramisù','Panna cotta'],['Risotto','Paella'],['Croissant','Bombolone'],
    ['Nutella','Marmellata'],['Popcorn','Patatine'],['Ramen','Udon'],['Kebab','Burrito'],
    ['Pancake','Waffle'],['Sushi','Poke'],['Carbonara','Amatriciana'],['Mozzarella','Burrata'],
    ['Arancino','Supplì'],['Bruschetta','Crostino'],['Panettone','Colomba'],['Cioccolata calda','Caffè']]},
  { id: 'luoghi', name: 'Luoghi', color: '#3B82F6', items: [
    ['Spiaggia','Piscina'],['Ospedale','Farmacia'],['Aeroporto','Stazione'],['Cinema','Teatro'],
    ['Biblioteca','Libreria'],['Supermercato','Mercato'],['Discoteca','Pub'],['Museo','Galleria d’arte'],
    ['Palestra','Campo da calcio'],['Zoo','Acquario'],['Chiesa','Monastero'],['Scuola','Università'],
    ['Montagna','Collina'],['Deserto','Canyon'],['Luna park','Circo'],['Ristorante','Pizzeria'],
    ['Ufficio','Coworking'],['Prigione','Tribunale'],['Hotel','Ostello'],['Metropolitana','Autobus']]},
  { id: 'animali', name: 'Animali', color: '#22C08A', items: [
    ['Leone','Tigre'],['Delfino','Squalo'],['Gatto','Volpe'],['Cane','Lupo'],['Pinguino','Foca'],
    ['Aquila','Falco'],['Cavallo','Zebra'],['Elefante','Rinoceronte'],['Ape','Vespa'],['Coccodrillo','Lucertola'],
    ['Rana','Salamandra'],['Gufo','Pipistrello'],['Polpo','Medusa'],['Koala','Panda'],['Giraffa','Cammello'],
    ['Pappagallo','Tucano'],['Formica','Scarafaggio'],['Farfalla','Libellula'],['Orso','Gorilla'],['Criceto','Coniglio']]},
  { id: 'oggetti', name: 'Oggetti', color: '#FFB800', items: [
    ['Ombrello','Impermeabile'],['Chiave','Lucchetto'],['Forbici','Coltello'],['Specchio','Finestra'],
    ['Cuscino','Coperta'],['Candela','Lampada'],['Orologio','Sveglia'],['Zaino','Valigia'],
    ['Occhiali','Lenti a contatto'],['Spazzolino','Pettine'],['Bicicletta','Monopattino'],['Telecomando','Joystick'],
    ['Penna','Matita'],['Sedia','Divano'],['Frigorifero','Forno'],['Tazza','Bicchiere'],
    ['Asciugamano','Accappatoio'],['Scopa','Aspirapolvere']]},
  { id: 'colori', name: 'Colori', color: '#8B5CF6', colors: true, items: [
    ['Turchese','#30C9C0','Acquamarina','#7FE0C8'],['Bordeaux','#7A1730','Vinaccia','#5E2142'],
    ['Ocra','#CC8E2C','Senape','#D9B32C'],['Lavanda','#B19CD9','Lilla','#C8A2C8'],
    ['Corallo','#FF6F61','Salmone','#FA8072'],['Verde bosco','#228B4E','Verde oliva','#7A7F2A'],
    ['Blu notte','#14214D','Blu cobalto','#0047AB'],['Magenta','#E0218A','Fucsia','#FF4FB8'],
    ['Ciano','#00B7EB','Celeste','#87CEEB'],['Cremisi','#C2142B','Scarlatto','#FF2400'],
    ['Avorio','#FFF8E1','Panna','#FFF2C7'],['Antracite','#2E3236','Grafite','#4A4F55'],
    ['Terracotta','#C8603E','Ruggine','#A2461C'],['Smeraldo','#14A06B','Giada','#3FA77C'],
    ['Indaco','#3F2A8C','Viola','#7B3FBF'],['Pesca','#FFB38A','Albicocca','#FBA65E'],
    ['Ambra','#FFB000','Oro','#D4AF37'],['Menta','#98E2C6','Pistacchio','#B7D46A'],
    ['Rosa cipria','#E8B4B8','Rosa antico','#C08081'],['Sabbia','#D8C39A','Beige','#E2D3B5'],
    ['Petrolio','#0E5E6F','Ottanio','#1D6F6A'],['Arancione','#FF8A1F','Mandarino','#FF9F45']]},
  { id: 'film', name: 'Film e serie', color: '#FF6FB1', items: [
    ['Harry Potter','Il Signore degli Anelli'],['Star Wars','Star Trek'],['Titanic','Pirati dei Caraibi'],
    ['Frozen','Rapunzel'],['Il Re Leone','Il libro della giungla'],['Shrek','Il gatto con gli stivali'],
    ['Stranger Things','Dark'],['La casa di carta','Ocean’s Eleven'],['Squid Game','Hunger Games'],
    ['Avengers','Justice League'],['Toy Story','Cars'],['Jurassic Park','King Kong'],['The Office','Friends'],
    ['Il padrino','Scarface'],['Matrix','Inception'],['Gomorra','Romanzo criminale'],['Up','Coco'],
    ['Barbie','Oppenheimer'],['Breaking Bad','Narcos'],['Mare fuori','Skam Italia']]},
  { id: 'sport', name: 'Sport', color: '#14B8C4', items: [
    ['Calcio','Calcetto'],['Tennis','Padel'],['Basket','Pallavolo'],['Nuoto','Pallanuoto'],['Sci','Snowboard'],
    ['Boxe','Kickboxing'],['Formula 1','MotoGP'],['Ciclismo','Triathlon'],['Golf','Biliardo'],
    ['Rugby','Football americano'],['Surf','Skateboard'],['Scherma','Tiro con l’arco'],['Yoga','Pilates'],
    ['Arrampicata','Parkour'],['Ping pong','Badminton'],['Pattinaggio','Hockey su ghiaccio'],['Bowling','Bocce']]},
  { id: 'mestieri', name: 'Mestieri', color: '#FF8A1F', items: [
    ['Medico','Infermiere'],['Cuoco','Pasticcere'],['Pompiere','Poliziotto'],['Insegnante','Bibliotecario'],
    ['Pilota','Astronauta'],['Avvocato','Giudice'],['Fotografo','Videomaker'],['Graphic designer','Illustratore'],
    ['Barista','Cameriere'],['Muratore','Idraulico'],['Veterinario','Dentista'],['Attore','Cantante'],
    ['Giornalista','Influencer'],['Architetto','Ingegnere'],['Parrucchiere','Truccatore'],['Contadino','Giardiniere'],
    ['Programmatore','Hacker'],['Detective','Spia']]},
  { id: 'arte', name: 'Arte', color: '#E0218A', items: [
    ['Van Gogh','Gauguin'],['Picasso','Dalí'],['Monet','Renoir'],['Leonardo','Michelangelo'],
    ['Frida Kahlo','Diego Rivera'],['Banksy','Keith Haring'],['Warhol','Lichtenstein'],['Kandinsky','Mondrian'],
    ['Caravaggio','Rembrandt'],['Gioconda','Ragazza con l’orecchino di perla'],['Notte stellata','I girasoli'],
    ['L’urlo','Guernica'],['Scultura','Installazione'],['Acquerello','Tempera'],['Pennello','Spatola'],
    ['Tela','Cavalletto'],['Murale','Graffito'],['Bauhaus','Futurismo'],['Prisma','Arcobaleno']]},
  { id: 'musica', name: 'Musica', color: '#9AD62A', items: [
    ['Chitarra','Basso'],['Pianoforte','Organo'],['Batteria','Tamburello'],['Violino','Violoncello'],
    ['Tromba','Sassofono'],['Rap','Trap'],['Rock','Metal'],['Opera','Musical'],['Concerto','Festival'],
    ['Sanremo','Eurovision'],['Karaoke','Talent show'],['DJ','Producer'],['Vinile','Cassetta'],
    ['Cuffie','Casse'],['Microfono','Megafono'],['Flauto','Clarinetto'],['Jazz','Blues'],['Reggaeton','Salsa']]},
  { id: 'citta', name: 'Città e paesi', color: '#2B5BD7', items: [
    ['Parigi','Londra'],['Venezia','Amsterdam'],['Roma','Atene'],['New York','Los Angeles'],['Tokyo','Seul'],
    ['Barcellona','Madrid'],['Napoli','Palermo'],['Milano','Torino'],['Berlino','Vienna'],['Egitto','Marocco'],
    ['Brasile','Argentina'],['Islanda','Norvegia'],['Australia','Nuova Zelanda'],['Dubai','Las Vegas'],
    ['Kyiv','Leopoli'],['Messico','Cuba'],['Svizzera','Austria'],['Grecia','Croazia']]},
  { id: 'tech', name: 'Tech e app', color: '#6366F1', items: [
    ['Instagram','TikTok'],['WhatsApp','Telegram'],['YouTube','Twitch'],['Netflix','Disney+'],
    ['Spotify','Apple Music'],['Google','Wikipedia'],['Smartphone','Tablet'],['PlayStation','Xbox'],
    ['Wi-Fi','Bluetooth'],['Selfie','Foto profilo'],['Emoji','Sticker'],['Password','PIN'],['Drone','Robot'],
    ['Chatbot','Assistente vocale'],['Meme','GIF'],['Podcast','Radio'],['Powerbank','Caricatore'],
    ['Minecraft','Roblox'],['Fortnite','Call of Duty']]},
  { id: 'viaggi', name: 'Viaggi', color: '#0EA5A4', items: [
    ['Passaporto','Carta d’identità'],['Crociera','Traghetto'],['Tenda','Camper'],['Aereo','Elicottero'],
    ['Treno','Tram'],['Ombrellone','Sdraio'],['Crema solare','Doposole'],['Cartolina','Souvenir'],
    ['Mappa','GPS'],['Interrail','Road trip'],['Hotel','Airbnb'],['Spa','Sauna'],['Safari','Zoo'],
    ['Jet lag','Mal d’auto'],['Bagaglio a mano','Valigia in stiva']]},
  { id: 'scuola', name: 'Scuola e uni', color: '#F59E0B', items: [
    ['Esame','Interrogazione'],['Tesi','Tesina'],['Lavagna','Proiettore'],['Zaino','Astuccio'],
    ['Gita','Uscita didattica'],['Pagella','Libretto'],['Ricreazione','Pausa pranzo'],['Professore','Relatore'],
    ['Laurea','Diploma'],['Matematica','Fisica'],['Storia','Geografia'],['Erasmus','Scambio culturale'],
    ['Mensa','Bar dell’università'],['Appunti','Riassunto'],['Copiare','Suggerire'],['Corso','Laboratorio']]},
  { id: 'fantasy', name: 'Fantasy ed eroi', color: '#7C3AED', items: [
    ['Drago','Dinosauro'],['Vampiro','Licantropo'],['Strega','Mago'],['Fata','Elfo'],['Unicorno','Pegaso'],
    ['Sirena','Tritone'],['Zombie','Mummia'],['Fantasma','Poltergeist'],['Superman','Batman'],
    ['Spider-Man','Ant-Man'],['Hulk','Thor'],['Bacchetta magica','Pozione'],['Castello','Torre'],
    ['Gigante','Troll'],['Pirata','Vichingo'],['Robot','Alieno'],['Ninja','Samurai'],['Cavaliere','Principe']]},
  { id: 'feste', name: 'Feste', color: '#EF4444', items: [
    ['Natale','Capodanno'],['Halloween','Carnevale'],['Compleanno','Anniversario'],['Matrimonio','Battesimo'],
    ['Pasqua','Pasquetta'],['Ferragosto','Festa d’estate'],['San Valentino','Festa della donna'],
    ['Festa di laurea','Addio al celibato'],['Fuochi d’artificio','Coriandoli'],['Albero di Natale','Presepe'],
    ['Babbo Natale','Befana'],['Torta','Candeline'],['Spumante','Champagne'],['Regalo','Sorpresa'],['Sagra','Fiera']]},
  { id: 'emozioni', name: 'Emozioni (difficile)', color: '#64748B', items: [
    ['Nostalgia','Malinconia'],['Gelosia','Invidia'],['Rabbia','Frustrazione'],['Gioia','Euforia'],
    ['Paura','Ansia'],['Noia','Pigrizia'],['Vergogna','Imbarazzo'],['Fiducia','Speranza'],['Sorpresa','Stupore'],
    ['Orgoglio','Vanità'],['Calma','Serenità'],['Amore','Amicizia'],['Solitudine','Silenzio'],
    ['Coraggio','Incoscienza'],['Curiosità','Interesse'],['Tensione','Attesa']]},
  { id: 'torino', name: 'Torino', color: '#A16207', items: [
    ['Mole Antonelliana','Superga'],['Bicerin','Gianduiotto'],['Po','Dora'],['Juventus','Torino FC'],
    ['Porta Nuova','Porta Susa'],['Lingotto','Mirafiori'],['Parco del Valentino','Parco Dora'],
    ['Museo Egizio','Museo del Cinema'],['Piazza Castello','Piazza San Carlo'],['Murazzi','San Salvario'],
    ['Accademia Albertina','Politecnico'],['Tram','Metro'],['Portici','Galleria Subalpina'],
    ['Vermouth','Aperitivo'],['Agnolotti','Tajarin'],['Fiat','Lancia'],['Eataly','Porta Palazzo']]}
];
