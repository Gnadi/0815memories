/**
 * What the demo family says, in each language the app speaks.
 *
 * Words, mostly. Dates, pictures and how the pieces fit together are in
 * demoFamily.js, which pairs each entry here with its slot by position — so
 * both languages have to hold the same entries in the same order.
 * demoFamily.test.js checks that they do. A recipe's ingredients and changes
 * are its own business and may differ between the languages; an ingredient
 * is `active` unless it says otherwise.
 *
 * This is sample content, not interface: it lives with the demo, not in
 * src/locales/, so nobody outside a demo tab ever downloads it.
 */

const en = {
  family: { name: 'The Bennett Family', slug: 'the-bennetts' },
  visitor: { name: 'Sarah Bennett', short: 'Sarah', email: 'sarah@example.com' },
  partner: { name: 'David Bennett', short: 'David', email: 'david@example.com' },
  kids: { emma: 'Emma', leo: 'Leo' },
  birthPlace: { name: 'San Francisco', country: 'US', lat: 37.77, lon: -122.42, tz: 'America/Los_Angeles' },

  memories: [
    {
      title: 'Summer at Monterey Bay',
      content: 'Three days of tide pools, sandcastles and the kids refusing to leave the water. Grandpa finally beat everyone at beach volleyball, and nobody is allowed to forget it.',
      quote: 'The best memories are made in flip-flops.',
      location: 'Monterey Bay, CA',
      authorName: 'Sarah',
      category: 'Travel',
    },
    {
      title: 'First snow hike',
      content: 'We bundled up the whole crew and made it to the ridge just as the clouds broke. Leo insisted on carrying the thermos the whole way up. Hot cocoa never tasted so good.',
      quote: 'Cold hands, warm hearts.',
      location: 'Mount Tamalpais',
      authorName: 'David',
      category: 'Adventure',
    },
    {
      title: "Emma's 6th birthday",
      content: 'Unicorn cake, a backyard full of cousins, a piñata that refused to break — and exactly one very over-tired birthday girl by eight o\'clock.',
      quote: '',
      location: 'Home',
      authorName: 'Sarah',
      category: 'Celebration',
    },
    {
      title: 'Sunday in the garden',
      content: 'Leo planted his first tomatoes. He has already named all of them, and checks on Gerald every morning before breakfast.',
      quote: 'Small hands, big dreams.',
      location: 'Backyard',
      authorName: 'Grandma Rose',
      category: 'Everyday',
    },
    {
      title: 'Baking with Grandma',
      content: 'Passing down the apple pie recipe: flour everywhere, laughter even more. Emma now knows the secret, and has promised to tell no one but her diary.',
      quote: '',
      location: "Grandma's kitchen",
      authorName: 'Sarah',
      category: 'Family',
    },
    {
      title: 'Pancake Sunday',
      content: 'Rain against the windows, everyone still in pyjamas, and a stack of pancakes bigger than Leo\'s appetite — not that he would ever admit it.',
      quote: 'Nobody leaves the table until the syrup is gone.',
      location: 'Home',
      authorName: 'David',
      category: 'Everyday',
    },
    {
      title: 'Leo turns six',
      content: 'A dinosaur cake, six candles blown out in one go, and a small speech thanking "everybody, and also the cake".',
      quote: '',
      location: 'Home',
      authorName: 'Sarah',
      category: 'Celebration',
    },
    {
      title: 'What Leo said at dinner',
      content: 'Asked what he wants to be when he grows up, Leo thought about it for a long time and said: "Taller." Then he went back to his peas.',
      quote: '"Taller."',
      location: 'Kitchen table',
      authorName: 'David',
      category: 'Everyday',
    },
    {
      title: 'The treehouse is finished',
      content: 'Three weekends, one bent nail per finger and a rope ladder Emma tested personally. The kids have already put up a sign: no grown-ups, except on Saturdays.',
      quote: '',
      location: 'Backyard',
      authorName: 'David',
      category: 'Family',
    },
  ],

  moments: [
    { caption: 'Morning pancakes 🥞', label: 'Breakfast', category: 'Everyday', location: 'Home' },
    { caption: 'Highest slide in the park, apparently', label: 'Playground', category: 'Kids', location: 'Golden Gate Park' },
    { caption: 'One more chapter. Then another.', label: 'Story time', category: 'Everyday', location: 'Home' },
    { caption: 'Look, no hands! (Please hold on.)', label: 'Bike ride', category: 'Kids', location: 'Our street' },
    { caption: 'The sign on the treehouse is official now', label: 'Treehouse', category: 'Family', location: 'Backyard' },
  ],

  journals: [
    {
      title: 'First day of school',
      volume: 'Volume 1',
      content: 'You picked out your own backpack and insisted on walking in by yourself. We watched from the gate, so proud we could barely speak. You did not look back once — and then, at the door, you did, and waved.',
    },
    {
      title: 'Your first lost tooth',
      volume: 'Volume 1',
      content: 'It wobbled for a week and finally came out at dinner, in a bite of apple. The tooth fairy left a note in tiny handwriting. You still keep it in your treasure box.',
    },
    {
      title: 'To Emma, on your eighth birthday',
      volume: 'Volume 2',
      content: 'Eight years ago you arrived at four in the morning and have been asking questions ever since. Keep asking them. We love who you are becoming — curious, stubborn, and kind to everyone smaller than you.',
    },
    {
      title: 'Learning to ride',
      volume: 'Volume 1',
      content: 'No training wheels! Three scraped knees and one enormous grin later, you rode the whole length of the street, shouting so the neighbours would come out and watch.',
    },
  ],

  recipes: [
    {
      title: "Grandma Rose's Apple Pie",
      author: 'Grandma Rose',
      description: 'The pie that started every Thanksgiving for four decades.',
      instructions: 'Peel and slice the apples. Toss with sugar and cinnamon. Fill the crust, dot with butter, close it with the lid and bake at 190 °C for 50 minutes.',
      chefNote: 'Only Granny Smith apples — never the sweet ones.',
      forkReason: '',
      ingredients: ['6 Granny Smith apples', '1 cup sugar', '2 tsp cinnamon', '2 tbsp butter', 'Double pie crust'],
      changes: [],
    },
    {
      title: "Mom's Apple Pie",
      author: 'Sarah',
      description: 'Grandma\'s pie with a caramel drizzle and a touch of nutmeg.',
      instructions: 'Follow the original, then drizzle warm caramel over the top crust before serving.',
      chefNote: 'A pinch of sea salt on the caramel is the secret.',
      forkReason: 'Added caramel for the holidays.',
      ingredients: ['6 Granny Smith apples', '1 cup sugar', { name: '1 tsp cinnamon', status: 'modified' }, '½ tsp nutmeg', 'Double pie crust', 'Caramel sauce'],
      changes: [
        { type: 'ADDED', ingredient: 'Caramel sauce', description: 'Drizzled over the top.' },
        { type: 'MODIFIED', ingredient: 'Cinnamon', description: 'Halved, and balanced with nutmeg.' },
      ],
    },
    {
      title: "Emma's Mini Pies",
      author: 'Emma & Sarah',
      description: 'Hand-sized pies for little bakers — same filling, tiny crusts.',
      instructions: 'Use a muffin tin. Press in circles of crust, fill, top each with a pastry star and bake for 25 minutes.',
      chefNote: 'The stars burn first. Watch them.',
      forkReason: 'Made them kid-sized for the school bake sale.',
      ingredients: ['6 Granny Smith apples', { name: '¾ cup sugar', status: 'modified' }, '1 tsp cinnamon', 'Muffin-tin crust circles'],
      changes: [
        { type: 'MODIFIED', ingredient: 'Sugar', description: 'A little less — the kids asked.' },
        { type: 'MODIFIED', ingredient: 'Format', description: 'Single-serving mini pies.' },
      ],
    },
    {
      title: "Dad's Sunday Pancakes",
      author: 'David',
      description: 'Fluffy, slightly lopsided, and the reason anyone gets up on Sundays.',
      instructions: 'Whisk the dry ingredients, then the wet ones, and fold them together with a few lumps left. Rest for 10 minutes. Cook on a medium pan until bubbles appear, flip once.',
      chefNote: 'The first pancake is always for the cook.',
      forkReason: '',
      ingredients: ['2 cups flour', '2 tbsp sugar', '2 tsp baking powder', '2 eggs', '1½ cups milk', '3 tbsp melted butter'],
      changes: [],
    },
  ],

  scrapbook: {
    title: 'Our Family Year',
    headline: 'SUMMER {{year}}',
    caption: 'the best days',
    gardenHeadline: 'GARDEN DAYS',
  },

  capsules: [
    {
      title: 'For Leo, on your sixth birthday',
      message: 'Dear Leo, we wrote this the week you learned to say "dinosaur" properly. Six years old today — you are brave, loud and the best hugger in the family. Never stop asking why.',
    },
    {
      title: "For Emma's 18th birthday",
      message: 'Dear Emma, if you are reading this you are all grown up. From your very first breath you filled this house with light.',
    },
    {
      title: 'For Leo, on your wedding day',
      message: 'Leo, whoever you have chosen, we already love them for loving you. Dance with your grandmother for us.',
    },
  ],

  collages: ['Summer at the bay', "Grandma's kitchen", 'Our year in four'],

  highlights: [
    { title: 'Our summers', subtitle: 'The bay, the garden, the long evenings' },
    { title: 'A year of baking', subtitle: 'With Grandma Rose' },
    { title: "Emma's firsts", subtitle: 'Eight years in ninety seconds' },
  ],

  ourYear: {
    chapterTitles: ['The year of the new flat', 'A year of small adventures', 'Our year {{from}}/{{to}}'],
    keepsakes: [
      {
        song: { title: 'This Must Be the Place', artist: 'Talking Heads' },
        quote: 'Nobody warned us about the boxes.',
        moment: 'The first night in the new flat, eating pizza on the floor because the table had not arrived.',
      },
      {
        song: { title: 'Harvest Moon', artist: 'Neil Young' },
        quote: 'We can figure that out tomorrow.',
        moment: 'The evening the power went out and we ate cold pasta by candlelight, and neither of us wanted it to end.',
      },
      {
        song: { title: 'Here Comes the Sun', artist: 'The Beatles' },
        quote: '',
        moment: '',
      },
    ],
    letters: [
      {
        now: 'Tired, in the good way. The flat is finally ours and the boxes are almost gone.',
        wishes: 'One trip with nothing planned. And to keep asking each other the real question instead of the easy one.',
        remember: 'That we got through this year by being on the same side, even on the days we disagreed.',
      },
      {
        now: 'Busy, happy, a little short on sleep. Leo has opinions now. So does Emma.',
        wishes: 'More evenings on the balcony. Fewer evenings answering emails.',
        remember: 'That the small adventures counted. All of them.',
      },
    ],
    // The finished chapter: both handed in, both revealed.
    reflection: {
      visitor: {
        moment: 'The morning we drove out to the coast on a whim and had the whole beach to ourselves.',
        laugh: 'When you tried to assemble the shelf without the instructions and defended it for a full hour.',
        mastered: 'The move. We were exhausted and still kind to each other.',
        more: 'Cooking together on a weeknight, without a plan.',
        grateful: 'That you take the early shift without ever making it a thing.',
      },
      partner: {
        moment: 'The night we stayed up talking on the balcony until it got cold.',
        laugh: 'You, doing the voice you do for the cat. Every single time.',
        mastered: 'Getting through February. That was a hard month and we held it together.',
        more: 'Long walks with no destination.',
        grateful: 'For the way you notice when I am off before I do.',
      },
    },
    quiz: {
      visitor: {
        trip: 'The coast, definitely.',
        phrase: '"Let me just finish this one thing."',
        purchase: 'That absurd pizza oven.',
        pointlessDebate: 'Whether the bathroom light was left on. It was.',
        surprise: 'How quickly the new place started to feel like ours.',
      },
      partner: {
        trip: "The weekend at your sister's, hands down.",
        phrase: '"Have you seen my keys?"',
        purchase: 'The pizza oven. No regrets.',
        pointlessDebate: 'The correct way to load a dishwasher.',
        surprise: 'That we made it through the move without one real argument.',
      },
    },
    // The open chapter: only the partner has handed in so far.
    currentReflection: {
      moment: 'Watching you teach Leo to ride, running behind him long after he no longer needed it.',
      laugh: 'The treehouse sign. "No grown-ups, except on Saturdays."',
      mastered: 'A whole year of school mornings. Mostly on time.',
      more: 'Saturday breakfasts that last until noon.',
      grateful: 'That you still make me laugh when I am too tired to.',
    },
    currentQuiz: {
      trip: 'The snow hike, even with the blisters.',
      phrase: '"Five more minutes."',
      purchase: 'The second-hand bike. Best money we spent.',
      pointlessDebate: 'Whether a treehouse needs a doorbell.',
      surprise: 'How much the kids loved that rainy pancake Sunday.',
    },
  },
}

const de = {
  family: { name: 'Familie Berger', slug: 'familie-berger' },
  visitor: { name: 'Lena Berger', short: 'Lena', email: 'lena@example.com' },
  partner: { name: 'Jonas Berger', short: 'Jonas', email: 'jonas@example.com' },
  kids: { emma: 'Emma', leo: 'Leo' },
  birthPlace: { name: 'Wien', country: 'AT', lat: 48.21, lon: 16.37, tz: 'Europe/Vienna' },

  memories: [
    {
      title: 'Sommer am Gardasee',
      content: 'Drei Tage Steine sammeln, Sandburgen bauen und Kinder, die nicht aus dem Wasser wollten. Opa hat endlich alle im Beachvolleyball geschlagen – und niemand darf es je vergessen.',
      quote: 'Die schönsten Erinnerungen entstehen in Flip-Flops.',
      location: 'Gardasee',
      authorName: 'Lena',
      category: 'Reise',
    },
    {
      title: 'Erste Schneewanderung',
      content: 'Alle dick eingepackt, und genau als wir oben ankamen, ist die Wolkendecke aufgerissen. Leo hat darauf bestanden, die Thermoskanne den ganzen Weg selbst zu tragen. Kakao hat noch nie so gut geschmeckt.',
      quote: 'Kalte Hände, warme Herzen.',
      location: 'Rax',
      authorName: 'Jonas',
      category: 'Abenteuer',
    },
    {
      title: 'Emmas 6. Geburtstag',
      content: 'Einhorntorte, ein Garten voller Cousins und Cousinen, eine Piñata, die einfach nicht kaputtgehen wollte – und um acht Uhr ein sehr müdes Geburtstagskind.',
      quote: '',
      location: 'Zuhause',
      authorName: 'Lena',
      category: 'Feier',
    },
    {
      title: 'Sonntag im Garten',
      content: 'Leo hat seine ersten Tomaten gepflanzt. Er hat jeder einzelnen schon einen Namen gegeben und schaut jeden Morgen vor dem Frühstück nach Gerhard.',
      quote: 'Kleine Hände, große Träume.',
      location: 'Garten',
      authorName: 'Oma Rosi',
      category: 'Alltag',
    },
    {
      title: 'Backen mit Oma',
      content: 'Das Strudelrezept wird weitergegeben: Mehl überall, noch mehr Gelächter. Emma kennt jetzt das Geheimnis und hat versprochen, es nur ihrem Tagebuch zu verraten.',
      quote: '',
      location: 'Omas Küche',
      authorName: 'Lena',
      category: 'Familie',
    },
    {
      title: 'Palatschinken-Sonntag',
      content: 'Regen an den Fenstern, alle noch im Pyjama und ein Palatschinken-Turm, größer als Leos Hunger – auch wenn er das nie zugeben würde.',
      quote: 'Niemand steht auf, bevor die Marmelade leer ist.',
      location: 'Zuhause',
      authorName: 'Jonas',
      category: 'Alltag',
    },
    {
      title: 'Leo wird sechs',
      content: 'Eine Dinosaurier-Torte, sechs Kerzen auf einmal ausgeblasen und eine kleine Rede: Danke an „alle, und auch an die Torte“.',
      quote: '',
      location: 'Zuhause',
      authorName: 'Lena',
      category: 'Feier',
    },
    {
      title: 'Was Leo beim Abendessen gesagt hat',
      content: 'Auf die Frage, was er werden will, wenn er groß ist, hat Leo lange nachgedacht und gesagt: „Größer.“ Dann hat er weiter seine Erbsen gegessen.',
      quote: '„Größer.“',
      location: 'Küchentisch',
      authorName: 'Jonas',
      category: 'Alltag',
    },
    {
      title: 'Das Baumhaus ist fertig',
      content: 'Drei Wochenenden, ein krummer Nagel pro Finger und eine Strickleiter, die Emma persönlich getestet hat. Die Kinder haben schon ein Schild aufgehängt: Keine Erwachsenen, außer samstags.',
      quote: '',
      location: 'Garten',
      authorName: 'Jonas',
      category: 'Familie',
    },
  ],

  moments: [
    { caption: 'Palatschinken zum Frühstück 🥞', label: 'Frühstück', category: 'Alltag', location: 'Zuhause' },
    { caption: 'Angeblich die höchste Rutsche im ganzen Park', label: 'Spielplatz', category: 'Kinder', location: 'Augarten' },
    { caption: 'Noch ein Kapitel. Und noch eins.', label: 'Vorlesen', category: 'Alltag', location: 'Zuhause' },
    { caption: 'Schau, freihändig! (Bitte festhalten.)', label: 'Radtour', category: 'Kinder', location: 'Unsere Straße' },
    { caption: 'Das Schild am Baumhaus ist jetzt offiziell', label: 'Baumhaus', category: 'Familie', location: 'Garten' },
  ],

  journals: [
    {
      title: 'Erster Schultag',
      volume: 'Band 1',
      content: 'Du hast deine Schultasche selbst ausgesucht und wolltest unbedingt allein hineingehen. Wir haben am Tor gestanden und waren so stolz, dass wir kaum reden konnten. Du hast dich kein einziges Mal umgedreht – und dann, an der Tür, doch, und gewinkt.',
    },
    {
      title: 'Dein erster Wackelzahn',
      volume: 'Band 1',
      content: 'Eine Woche lang hat er gewackelt, beim Abendessen ist er dann in einem Apfelstück stecken geblieben. Die Zahnfee hat einen Brief in winziger Schrift dagelassen. Du hebst ihn bis heute in deiner Schatzkiste auf.',
    },
    {
      title: 'An Emma, zu deinem achten Geburtstag',
      volume: 'Band 2',
      content: 'Vor acht Jahren bist du um vier Uhr früh angekommen und stellst seitdem Fragen. Hör nie damit auf. Wir lieben, wer du gerade wirst – neugierig, dickköpfig und lieb zu allen, die kleiner sind als du.',
    },
    {
      title: 'Radfahren lernen',
      volume: 'Band 1',
      content: 'Ohne Stützräder! Drei aufgeschürfte Knie und ein riesiges Grinsen später bist du die ganze Straße entlanggefahren und hast so laut gerufen, dass alle Nachbarn herausgekommen sind.',
    },
  ],

  recipes: [
    {
      title: 'Oma Rosis Apfelstrudel',
      author: 'Oma Rosi',
      description: 'Der Strudel, mit dem seit vierzig Jahren jedes Familienfest anfängt.',
      instructions: 'Äpfel schälen und blättrig schneiden, mit Zucker, Zimt und Rosinen mischen. Den Teig hauchdünn ausziehen, mit Butterbröseln bestreuen, Füllung darauf, einrollen und bei 190 °C 45 Minuten backen.',
      chefNote: 'Der Teig muss so dünn sein, dass man die Zeitung darunter lesen kann.',
      forkReason: '',
      ingredients: ['1 kg säuerliche Äpfel', '100 g Zucker', '2 TL Zimt', '50 g Rosinen', '80 g Butterbrösel', 'Strudelteig'],
      changes: [],
    },
    {
      title: 'Mamas Apfelstrudel mit Vanillesauce',
      author: 'Lena',
      description: 'Omas Strudel, dazu warme Vanillesauce und eine Prise Muskat.',
      instructions: 'Wie das Original backen und warm mit Vanillesauce servieren.',
      chefNote: 'Die Vanillesauce nie kochen lassen, nur ziehen.',
      forkReason: 'Für die Feiertage etwas festlicher gemacht.',
      ingredients: ['1 kg säuerliche Äpfel', '100 g Zucker', { name: '1 TL Zimt', status: 'modified' }, '½ TL Muskat', '80 g Butterbrösel', 'Strudelteig', 'Vanillesauce'],
      changes: [
        { type: 'ADDED', ingredient: 'Vanillesauce', description: 'Warm dazu serviert.' },
        { type: 'MODIFIED', ingredient: 'Zimt', description: 'Halbiert und mit Muskat ausgeglichen.' },
      ],
    },
    {
      title: 'Emmas Mini-Strudel',
      author: 'Emma & Lena',
      description: 'Strudel im Kleinformat für kleine Bäckerinnen – gleiche Füllung, winzige Rollen.',
      instructions: 'Den Teig in Rechtecke schneiden, je einen Löffel Füllung darauf, einrollen und 20 Minuten backen.',
      chefNote: 'Die Enden werden zuerst braun. Gut aufpassen.',
      forkReason: 'Für den Kuchenbasar in der Schule handlich gemacht.',
      ingredients: ['1 kg säuerliche Äpfel', { name: '75 g Zucker', status: 'modified' }, '1 TL Zimt', 'Strudelteig in Rechtecken'],
      changes: [
        { type: 'MODIFIED', ingredient: 'Zucker', description: 'Etwas weniger – auf Wunsch der Kinder.' },
        { type: 'MODIFIED', ingredient: 'Form', description: 'Kleine Einzelportionen.' },
      ],
    },
    {
      title: 'Papas Sonntags-Kaiserschmarrn',
      author: 'Jonas',
      description: 'Flaumig, leicht zerrupft und der Grund, warum am Sonntag überhaupt jemand aufsteht.',
      instructions: 'Eigelb mit Milch, Mehl und Zucker verrühren, Eischnee unterheben. In Butter anbacken, wenden, mit zwei Gabeln zerreißen und mit Staubzucker bestreuen.',
      chefNote: 'Der erste Schmarrn gehört immer dem Koch.',
      forkReason: '',
      ingredients: ['4 Eier', '250 ml Milch', '150 g Mehl', '2 EL Zucker', '2 EL Butter', 'Staubzucker'],
      changes: [],
    },
  ],

  scrapbook: {
    title: 'Unser Familienjahr',
    headline: 'SOMMER {{year}}',
    caption: 'die schönsten Tage',
    gardenHeadline: 'GARTENTAGE',
  },

  capsules: [
    {
      title: 'Für Leo, zu deinem sechsten Geburtstag',
      message: 'Lieber Leo, wir haben das in der Woche geschrieben, in der du zum ersten Mal „Dinosaurier“ richtig sagen konntest. Heute wirst du sechs – du bist mutig, laut und der beste Kuschler der Familie. Hör nie auf, „warum“ zu fragen.',
    },
    {
      title: 'Für Emma, zum 18. Geburtstag',
      message: 'Liebe Emma, wenn du das liest, bist du erwachsen. Vom ersten Atemzug an hast du dieses Haus mit Licht gefüllt.',
    },
    {
      title: 'Für Leo, zu deiner Hochzeit',
      message: 'Leo, wen auch immer du gewählt hast – wir haben diesen Menschen schon jetzt lieb, weil er dich liebt. Tanz für uns mit deiner Oma.',
    },
  ],

  collages: ['Sommer am See', 'Omas Küche', 'Unser Jahr in vier Bildern'],

  highlights: [
    { title: 'Unsere Sommer', subtitle: 'Der See, der Garten, die langen Abende' },
    { title: 'Ein Jahr voller Backen', subtitle: 'Mit Oma Rosi' },
    { title: 'Emmas erste Male', subtitle: 'Acht Jahre in neunzig Sekunden' },
  ],

  ourYear: {
    chapterTitles: ['Das Jahr der neuen Wohnung', 'Ein Jahr der kleinen Abenteuer', 'Unser Jahr {{from}}/{{to}}'],
    keepsakes: [
      {
        song: { title: 'This Must Be the Place', artist: 'Talking Heads' },
        quote: 'Vor den Umzugskartons hat uns niemand gewarnt.',
        moment: 'Die erste Nacht in der neuen Wohnung, Pizza auf dem Boden, weil der Tisch noch nicht da war.',
      },
      {
        song: { title: 'Harvest Moon', artist: 'Neil Young' },
        quote: 'Das klären wir morgen.',
        moment: 'Der Abend, an dem der Strom ausgefallen ist und wir kalte Nudeln bei Kerzenlicht gegessen haben – und keiner wollte, dass er aufhört.',
      },
      {
        song: { title: 'Here Comes the Sun', artist: 'The Beatles' },
        quote: '',
        moment: '',
      },
    ],
    letters: [
      {
        now: 'Müde, aber auf die gute Art. Die Wohnung ist endlich unsere, und die Kartons sind fast weg.',
        wishes: 'Eine Reise ohne Plan. Und dass wir uns weiter die echte Frage stellen statt der einfachen.',
        remember: 'Dass wir dieses Jahr geschafft haben, weil wir auf derselben Seite standen – auch an den Tagen, an denen wir uns nicht einig waren.',
      },
      {
        now: 'Viel los, glücklich, ein bisschen zu wenig Schlaf. Leo hat jetzt Meinungen. Emma auch.',
        wishes: 'Mehr Abende auf dem Balkon. Weniger Abende mit E-Mails.',
        remember: 'Dass die kleinen Abenteuer gezählt haben. Alle.',
      },
    ],
    reflection: {
      visitor: {
        moment: 'Der Morgen, an dem wir spontan an den See gefahren sind und den ganzen Strand für uns hatten.',
        laugh: 'Als du das Regal ohne Anleitung aufgebaut und eine Stunde lang verteidigt hast.',
        mastered: 'Den Umzug. Wir waren völlig erledigt und trotzdem lieb zueinander.',
        more: 'Unter der Woche zusammen kochen, ohne Plan.',
        grateful: 'Dass du die Frühschicht übernimmst, ohne je ein Thema daraus zu machen.',
      },
      partner: {
        moment: 'Die Nacht, in der wir auf dem Balkon geredet haben, bis es kalt wurde.',
        laugh: 'Du, mit der Stimme, die du für die Katze machst. Jedes Mal.',
        mastered: 'Den Februar. Das war ein schwerer Monat, und wir haben ihn gemeinsam getragen.',
        more: 'Lange Spaziergänge ohne Ziel.',
        grateful: 'Dass du merkst, wenn es mir nicht gut geht, bevor ich es selbst merke.',
      },
    },
    quiz: {
      visitor: {
        trip: 'Der See, ganz klar.',
        phrase: '„Ich mach nur noch schnell das hier fertig.“',
        purchase: 'Dieser absurde Pizzaofen.',
        pointlessDebate: 'Ob das Licht im Bad angeblieben ist. Es war an.',
        surprise: 'Wie schnell sich die neue Wohnung nach uns angefühlt hat.',
      },
      partner: {
        trip: 'Das Wochenende bei deiner Schwester, ohne Frage.',
        phrase: '„Hast du meine Schlüssel gesehen?“',
        purchase: 'Der Pizzaofen. Keine Reue.',
        pointlessDebate: 'Wie man einen Geschirrspüler richtig einräumt.',
        surprise: 'Dass wir den Umzug ohne einen einzigen echten Streit geschafft haben.',
      },
    },
    currentReflection: {
      moment: 'Dir zuzusehen, wie du Leo das Radfahren beibringst – und noch hinterherläufst, als er es längst nicht mehr braucht.',
      laugh: 'Das Baumhaus-Schild. „Keine Erwachsenen, außer samstags.“',
      mastered: 'Ein ganzes Jahr Schulmorgen. Meistens pünktlich.',
      more: 'Samstagsfrühstücke, die bis Mittag dauern.',
      grateful: 'Dass du mich zum Lachen bringst, auch wenn ich zu müde dafür bin.',
    },
    currentQuiz: {
      trip: 'Die Schneewanderung, trotz der Blasen.',
      phrase: '„Noch fünf Minuten.“',
      purchase: 'Das gebrauchte Fahrrad. Bestes Geld, das wir ausgegeben haben.',
      pointlessDebate: 'Ob ein Baumhaus eine Klingel braucht.',
      surprise: 'Wie sehr die Kinder diesen verregneten Palatschinken-Sonntag geliebt haben.',
    },
  },
}

export const DEMO_CONTENT = { en, de }
