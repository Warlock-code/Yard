import json, random
random.seed(20260919)
OUT = r"C:\Users\ANIM\yard\gctu-chunk-F.json"

girl_emojis = ["💃🏽","👩🏽‍🦱","💅🏽","👸🏽","💄","🌸","💗","👒","🧕🏽","🤷🏽‍♀️","🙆🏽‍♀️","👱🏽‍♀️","💇🏽‍♀️","🧖🏽‍♀️"]
commenter_names = [
 ("GA_PerchQueenF","💃🏽"),("GA_TesanoBabeF","👩🏽‍🦱"),("GA_AbekaDivaF","💅🏽"),
 ("GA_MadinaGirlF","👸🏽"),("GA_SnoreVictimF","😭"),("GA_StewPoliceF","🍲"),
 ("GA_ShowerQueueF","🚿"),("GA_LightBillF","💡"),("GA_LandlordCryF","🏠"),
 ("GA_AgentScamF","🕵🏽‍♀️"),("GA_RoomieTayaF","🤦🏽‍♀️"),("GA_HostelDiariesF","📓"),
 ("GA_WigBorrowF","💇🏽‍♀️"),("GA_ChopBoxF","🍱"),("GA_KettleThiefF","🫖"),
 ("GA_BucketListF","🪣"),("GA_MidnightGistF","🌙"),("GA_BedspaceF","🛏️"),
 ("GA_BunkmateF","🛌🏽"),("GA_KitchenMessF","🍳"),("GA_BathroomQueenF","🧖🏽‍♀️"),
 ("GA_PrepaidPainF","🔌"),("GA_TapWaterF","🚰"),("GA_Veranda gistF".replace(" ",""),"📢"),
 ("GA_SlippersF","🩴"),("GA_PrayerWarriorF","🙏🏽"),("GA_MusicNoiseF","🔊"),
 ("GA_BoyfriendVisitF","💑"),("GA_CurfewGistF","⏰"),("GA_MummyHostelF","👩🏽‍🦰"),
 ("GA_NightBathF","🌃"),("GA_MopStickF","🧹"),("GA_DustbinF","🗑️"),
 ("GA_FridgeWahalaF","🧊"),("GA_GasBillF","🧯"),("GA_WindowNetF","🪟"),
 ("GA_MosquitoF","🦟"),("GA_FanNoiseF","🌀"),("GA_RoomSprayF","🌸"),
 ("GA_SachetWaterF","💧"),("GA_IronLadyF","👗"),
]

prefixes = ["HostelQueen","RoomieGist","SnoreVictim","StewPolice","ShowerQueen","LandlordPains","PerchBabe","TesanoSlay","AbekaChic","MadinaDiva","LightBillCry","AgentPepper","BunkmateDrama","BucketBrigade","KitchenMess","BathroomDiva","PrepaidPain","VerandaGist","SlippersLost","PrayerNoise","BoyfriendPalava","CurfewCry","MummyHostel","NightBath","FridgeFight","GasWahala","MosquitoBite","FanDrama","WigBorrow","ChopBoxLock"]
# ensure 150 unique authorGhosts
authors = []
for i in range(150):
    pref = prefixes[i % len(prefixes)]
    num = 301 + i  # 301-450 unique range, avoids clash with chunks A-D (01-30)
    authors.append(f"GA_{pref}F{num}")

hashtag_pool = ["#GCTUHostel","#RoommateWahala","#TesanoLife","#GCTUGist","#AbekaHostel","#MadinaGirls","#ShowerQueue","#LightBillWahala","#LandlordPalava","#PerchingLife","#AgentScam","#StewThief","#SnoreSquad","#GCTUBabes","#HostelDiaries","#2YearsAdvance"]

# 150 unique post bodies (without hashtags yet) - hand-varied
bodies = [
 "My roomie dey snore like faulty generator for Tesano hostel, I swear I no sleep whole night 😭 I record am sef make she hear herself for morning",
 "Somebody chop my kontomire stew from our mini fridge for Abeka hostel, I label am sef with my name ooo 😤 Girls wey dey steal food, God dey watch",
 "Shower queue for 6am be like Black Friday for our Madina hostel, 14 girls dey line with bucket 🪣 I miss my 7:30 lecture because of bath",
 "Our landlord lock the gate yesterday because one room never pay light bill, we beg tire before he open am 🙄 This Tesano landlord no get mercy",
 "Agent collect 200 cedis viewing fee show me gutter-side room for Abeka, pictures vs reality be scam 😭 I wan cry give my mama",
 "Landlord dey demand 2-years advance for single room for Tesano, where student wan get 18k cedis? 😩 E be like dem no want make we school again",
 "I dey perch with my friend for Madina, her roomie vex say I dey use their gas too much, now tension full room 😬 Perching life no be beans",
 "Light bill come 900 cedis for 4-bedroom hostel, how? We no even get AC ooo 💡 Somebody dey mine bitcoin for room 3 anaa?",
 "My bunkmate dey press phone with full brightness 2am dey laugh alone, I tap am say please, she vex 😤 Roommate wahala go kill me",
 "Roomie borrow my wig without permission go party, return am with smell of smoke and sweat 💇🏽‍♀️ I dey fume right now girls",
 "My roommate ein boyfriend almost live with us for Tesano hostel, he dey bath for our bathroom every morning 🙄 I no sign up for married life",
 "Landlord do surprise inspection carry pastor come pray against immorality for girls hostel 😂 E be like movie, everybody hide their boy pictures",
 "Shower head spoil for 3 weeks, landlord say make we manage, but he quick collect rent oo 🚿 Abeka landlords be something else",
 "My roomie dey cook banku 11pm every night, whole room dey smell, my clothes all dey smell smoke 😷 I love her but e too much",
 "Somebody use my bathing sponge, I know because e dey wet when I never bath 🧽 Girls abeg, private things be private ooo",
 "Tesano hostel tap no dey flow for 5 days, we dey buy sachet water take bath, my skin dey suffer 💧 60 cedis just for water this week",
 "Agent show same room give 5 different girls collect commitment fee from all of us, now we dey fight for WhatsApp group 😡 Scam full Accra",
 "My roommate dey do midnight prayers with tongues by 3am, I respect God but sleep too be blessing 🙏🏽 Hmm hostel life go test your faith",
 "Light off for 3 nights, our frozen fish all spoil, roomie still say make we share loss equally after na she force open freezer everyday 💡",
 "Landlord increase rent from 6k to 9k mid-semester say economy hard, but hostel still get cracked wall and no security 😩 Who go fight for students?",
 "I catch my roomie dey use my Nivea cream, level don reach halfway in 2 weeks 💄 When I confront am she say 'we be sisters naa'",
 "Perching girl for our room dey receive visitors pass tenants, yesterday 3 different boys come look for her 😬 We dey risk eviction ooo",
 "Madina hostel landlady dey seize our gas cylinder because we cook after 10pm, say rule be rule 🧯 We dey eat gari soak for 3 days now",
 "Bathroom queue make me late for quiz, lecturer no gree, carry my 10 marks go 😭 Shower queue fit actually fail person for GCTU",
 "My roommate dey wash only Sundays, room dey smell, I buy air freshener tire 🌸 How I go tell am politely say she dey smell?",
 "Somebody thief my bucket and sponge for Tesano hostel bathroom, who dey steal bucket? 😡 Now I dey carry my things go and come like market woman",
 "Our landlord bring mason without notice say he dey divide one room into two, noise from 6am to 6pm, we dey learn for construction site 🏠",
 "Roomie dey leave dirty panties for bathroom floor, I don talk tire, next time I go pack am throw for her bed 😤 Eww girls be honest",
 "Agent say hostel be 5 mins from GCTU Tesano campus, I dey walk 40 mins everyday, my leg don turn to trotromate 😭 Distance scam be real",
 "Stew wey I cook Sunday finish Tuesday, 4 girls for room, only me dey buy ingredients 🍲 Roommate mathematics no dey balance at all",
 "My bunkmate dey set 5 alarms from 4am snooze till 6am, me I dey wake for every single one ⏰ Sleep be luxury for hostel",
 "Landlord cut light because one girl dey use hot plate, now all 12 rooms dey darkness because of one person 🔌 Collective punishment be wicked",
 "I pay agent 500 cedis agency fee plus 2-years advance, now landlord say he no know that agent 😭 12k gone, police case ongoing",
 "Madina hostel get only 2 bathrooms for 30 girls, morning be war zone, we dey fight with bucket 🚿 I dey bath 4am these days to survive",
 "My roomie dey bring her church members come do fellowship for room every Friday, our small room full, I no get where to sit 🙏🏽",
 "Somebody pour my groundnut oil take top up theirs, the level no lie 😡 Stealing for girls hostel be professional work ooo",
 "Tesano landlady say no cooking with gas, only hot plate, but light bill go kill us, which kind trap be this? 🍳 We dey eat indomie raw sef",
 "My roommate snore plus grind teeth plus talk for sleep, full combo 😭 I dey consider sleeping for veranda, mosquitoes go chop me but peace of mind",
 "Perched for 2 weeks now, I dey sleep on mattress for floor, my back dey pain me, but hostel prices no be here 🛏️ God remember hustling students",
 "Landlord say visitors not allowed after 6pm, but ein own children dey make noise whole night, rules only apply to tenants? 🏠",
 "Our room get bedbugs from secondhand mattress agent give us, whole body don turn to map 🦟 Tesano agents go sell you wahala",
 "Roomie dey use my towel wipe her feet, I see am with my own eyes, I shock 😷 Some girls no get boundaries at all",
 "Light bill sharing be war, room 4 get freezer and AC but wan pay equal with us wey get only fan and bulb 💡 We don hold meeting 3 times",
 "I lock my chop box, roomie vex say I no trust them, but last sem my milk and Milo vanish in one week 🍱 Trust no dey fill belly",
 "Shower drain block, water dey flood bathroom enter our room, landlord say make we contribute fix am though we pay service charge 🚿",
 "Abeka hostel agent post pictures of estate, I go see kiosk with curtain partition, 4500 for year 😭 I laugh so I no go cry",
 "My roommate dey play TikTok loud 1am dey laugh, I beg am wear earpiece she say e spoil 🙄 Sleep is political for hostel",
 "Landlady dey collect 50 cedis per visitor, my sister come visit me 2 hours I pay pass trotro fare 👭 Extortion be this",
 "Somebody dey steal my sachet water from fridge one by one, I mark them with pen, still e disappear 💧 Water thief for girls hostel ei",
 "Our Tesano hostel get one prepaid meter for 8 rooms, the girl with meter dey do shakara, if you cross her she go off your light 🔌",
 "Roomie leave light on whole day dey go lecture, light bill high she say 'e be small', small? 700 cedis? 💡",
 "I dey share bed with my cousin perching, single bed for two adults, I dey fall every night 🛌🏽 But 2-years advance no be joke",
 "Landlord paint only outside for inspection, inside wall dey peel, cockroach full kitchen, but rent be 8k 😩 Packaging scam",
 "My roomie dey iron clothes 5am, the steam plus alarm plus heat wake me always 👗 Ironing by dawn be wickedness",
 "Madina hostel warden dey open rooms with master key when we dey lecture, panties missing, money missing, we dey scared 🕵🏽‍♀️",
 "Agent say no water problem, first rain our compound flood enter room destroy my mattress and books 🌊 Tesano flood dey no joke",
 "My bunkmate dey eat loudly with mouth open plus lick fingers for night, I dey use earpiece pretend I no hear 😬 Table manners wahala",
 "Stew thief confession: I chop small from roomie pot last sem when hunger wire me, I still feel guilty, I go replace am this Friday 🍲 Forgive me girls",
 "Shower queue fight yesterday, one girl pour water on another, warden collect all buckets as punishment 🪣 Now nobody fit fetch water",
 "Tesano landlord build extra wooden structure call am 'executive single', no window, heat dey kill, 5k a year 😡 Fire hazard sef",
 "My roomie dey keep dirty plates 3 days for sink, maggots show, I wash once, she say I dey do shakara 🍳 I tire",
 "Light off assignment due midnight, I type with candle, laptop heat plus darkness, GCTU no dey postpone deadline for dumsor 💡",
 "Perching with 5 girls for one room for Abeka, we dey take turns sleep, timetable for bed 😂 Sardine life but we dey manage",
 "Roommate dey spray strong perfume 6am choke me wake, sneezing plus coughing, I get asthma ooo 🌸 Consideration zero",
 "Landlord son dey collect rent by force with macho men, banging gate 5am, we girls dey fear 🏠 Rent be debt or robbery?",
 "I buy new slippers, e disappear for veranda day 2, hostel thief fast pass pickpocket 🩴 Now I dey carry slippers enter bathroom",
 "My roomie dey gossip our room matters for other rooms, everything we discuss Miss External Affairs dey broadcast 📢 Trust broken",
 "Abeka hostel get CCTV only for landlord office, theft cases everyday but no footage, security be decoration 😒",
 "Somebody use my gas finish cook jollof for party, return empty cylinder, no shishi contribution 🧯 Audacity for girls hostel be high",
 "Night bath after 11pm be risk, bathroom light dead plus boys dey peep from wall, landlord refuse fix fence 🌃 Safety zero",
 "Roomie dey leave hair for bathroom drain after washing, water no dey flow, we dey bath with feet inside dirty water 💇🏽‍♀️ Eww",
 "2-years advance plus 1-year service charge plus agent fee, total 14k to sleep for Tesano, student loan? 😩 How we go survive?",
 "My roommate dey receive parcel everyday COD, delivery men dey knock always, our room turn to post office 📦 Disturbance be much",
 "Landlord say make we no wash outside, but inside no drying line, where we go dry panties? 👗 Rules without solution be wicked",
 "Madina hostel tap water dey brown like tea, we dey buy pure water bath, skin dey itch, landlord say e be 'natural minerals' 💧 Liar",
 "My bunkmate dey chew gum loudly pop pop for night while reading, I wan throw pillow give am 😤 Small sounds dey trigger for hostel",
 "Roomie chop my indomie reserve for emergency, hunger time I open box empty, I vex cry 😭 Indomie thief be lowest level",
 "Tesano agents dey use AI pictures now, room fine for photo, reality be poultry farm 😂 Technology plus scam be dangerous combo",
 "Shower queue make two best friends turn enemies, bucket line cutting cause big fight yesterday, warden settle matter 🪣 Petty but real",
 "Landlord dey increase service charge every semester without improvement, generator never work, security sleep always 🏠 Where our money dey go?",
 "My roomie dey talk for phone with boyfriend till 3am with speaker, 'baby baby' full room, single girls suffering 💑 Secondhand love be pepper",
 "Somebody thief my detergent and sponge, washing things dey vanish for veranda 🧹 Hostel be training ground for forgiveness",
 "Abeka landlord lock kitchen after 9pm, night readers wey wan cook hungry? Rules favour early sleepers only 🍳",
 "I perch free but room owner dey treat me like maid, wash plates, sweep, fetch water everyday 🧹 Perching price be servitude",
 "Fan for room dey make tractor noise, complain 2 months landlord no fix, sleep with noise plus heat 🌀 Double suffering",
 "Roomie dey borrow my dress return with stain and tear, no sorry, still ask for shoes next weekend 👗 Borrowers no dey shame",
 "Tesano hostel rats chop my bread and bite my provisions, landlord say make I buy trap myself 🐀 Rent 7k rats inclusive?",
 "Our room get 4 girls 1 wardrobe, clothes dey floor for Ghana-must-go, fashion die for hostel 😭 Slay still, we manage",
 "Madina agent collect inspection fee 100 cedis per person show 20 girls same day, e cash out 2k for one room 😡 Smart scam",
 "My roommate dey do makeup with our room light 4am for 6am class, bright ring light blind me 💄 Beauty sleep interrupter",
 "Light bill fraud: caretaker dey add 200 cedis on top for ein chop money, we calculate from ECG app catch am 💡 Thief in authority",
 "Somebody pour dirty mop water for corridor, smell full hostel, nobody confess, we all suffer 🗑️ Communal living wahala",
 "Roommate dey keep boyfriend toothbrush for our cup rack, e be like family house now 🙄 Boundaries don collapse",
 "Tesano hostel gate close 9pm sharp, I come 9:05 from night class, watchman demand 20 cedis before open ⏰ Night class vs curfew be war",
 "My roomie snore so loud veranda girls complain, she deny say she no dey snore, evidence dey for voice note 😂 Denial be river",
 "Stew pot wey I hide under bed still dem find chop, thieves get sniffer dog nose? 🍲 Next time I go lock for padlock inside pot",
 "Shower water dey shock small current, we report landlord say e be normal, somebody go die before dem fix? 🚿 Electrical hazard be joke to them",
 "Landlord say no males beyond gate, but ein daughters dey bring boyfriends sleep over, rules be selective? 💑 Double standard pain me",
 "Abeka room wey agent call 'self-contain' be single room with curtain bathroom, toilet flush with bucket 🚰 Self-contained scam be common",
 "Roomie dey fast and pray loudly disturb, plus she cook pork after fasting smell full room, mixed signals 🙏🏽 Holiness plus confusion",
 "I mop floor roomie waka with dirty slippers immediately, zero respect for cleaning roster 🧹 Roster be decoration for our room",
 "Prepaid meter finish Sunday night vendor closed, room dark till Monday, food spoil, assignment pending 🔌 Cashless wahala plus dumsor",
 "My roommate ein alarm be church bell tone full volume 4:30am, heart attack wake up everyday ⏰ PTSD from alarm",
 "Landlady dey enter room unannounced check boyfriends under bed, privacy zero, we be adults ooo 🛏️ Infantilizing be too much",
 "Somebody dey use my padlock key? My locked box open though key dey with me, hostel magic? 🍱 Or duplicate key wahala",
 "Madina hostel landlord share one dustbin for 20 rooms, rubbish mountain, flies full, cholera loading 🗑️ Sanitation zero but rent high",
 "Roomie dey dry her undies for my bedside rope without asking, I shift am she vex 👗 Sharing without permission be theft of space",
 "Tesano hostel price: 2022 be 3k, 2024 be 6k, 2026 be 9k for same kiosk room, salary no increase but rent dey fly 😩 Ghana housing be hell",
 "My bunkmate dey toss and turn shake whole bunk till I fall, plus she dey sleepwalk talk, I dey fear plus pain 🛌🏽 Bunk bed trauma",
 "Roommate borrowed 300 cedis since March 'next week' reach November, money still dey skies 💸 Lending for hostel be donation",
 "Shower queue numbering system we create cause fight, paper list tear by jealous girl, back to jungle rule 🪣 Democracy fail for bathroom",
 "Agent say room be 'girls only executive', I move in meet 2 boys dey stay, agent block me after payment 😡 Gender scam sef?",
 "Light bill: we contribute 100 each monthly, caretaker chop 300 disappear, ECG come disconnect, darkness 1 week 💡 Leadership scam",
 "My roomie dey video call family show our messy room without warning, I dey background with towel 😭 Privacy invasion be real",
 "Perching girl snore pass original tenant, veranda people hear am, now original tenant wan sack both of us 😂 Double wahala",
 "Landlord paint room pink without asking say girls like pink, my depression worsen, colour be prison 🌸 Gender stereotype plus ugly paint",
 "Somebody thief my drying bra from line, who dey steal bra? Madina hostel thief get fetish? 👗 Now I dey dry undies inside room",
 "Roomie dey cook with plenty pepper, smoke chase me from room coughing, my ulcer dey trigger 🌶️ Pepper assassin roommate",
 "Tesano hostel warden seize my kettle say high voltage, but shito seller for gate dey use bigger heater, selective seizure? 🫖",
 "My roommate dey sing loudly for bathroom 6am block queue because concert dey go on, voice sef no sweet 🚿 Bathroom artist delay us",
 "Abeka hostel get new rule: pay 20 cedis for washing machine per use, plus light bill separate, washing cost pass new cloth 🧹 Extortion",
 "I share gas with roomie, she dey cook beans 3 hours every 2 days, my gas finish fast, sharing no fair 🧯 Beans vs rice cooker war",
 "Landlord promise wardrobe, bed, fan before payment, after payment story change to 'manage', 8k for empty room? 🛏️ Promise and fail be their motto",
 "My roomie dey keep leftover banku 5 days for room, smell kill us, she say e still good, food poisoning loading 🍳 Hygiene talk fail",
 "Madina hostel boys from next compound dey peep when we dey bath, landlord refuse raise wall, safety fee we pay for what? 🌃 Girls unsafe",
 "Roommate dey use my photos post 'hostel life' TikTok without consent, 20k views of me sleeping 😭 Content creation without permission",
 "Somebody replace my Milo with brown powder, taste be strange, adulteration thief be wicked 🍱 Trust issues deep for hostel",
 "Tesano agent demand fresh viewing fee for room I already pay for, 're-inspection fee' 150 cedis, innovation in scamming 😡",
 "Shower slippers exchange wahala: I wear 45 cedis bathroom slippers go bath return barefoot, swap be tradition? 🩴",
 "Our room get lizard family, wall gecko plus cockroach, landlord say na 'natural security' 🦎 Natural my foot, fix net",
 "Roomie dey charge her 3 phones plus powerbank plus lamp for our single socket, bill high she say equal share 💡 Mathematics of cheating",
 "Light off during online quiz, hotspot die, I fail quiz, lecturer say no excuse, dumsor plus wickedness fail me 😭 GCTU online wahala",
 "Perching life teach me humility: floor mattress, bucket bath outside timetable, borrow everything, but sisterhood sweet too 💗 Mixed feelings",
 "Landlady dey gossip tenants business with other tenants, my boyfriend visit become estate news 📢 Privacy for gutter",
 "My roommate dey leave tap running flood bathroom enter room soak my books, carelessness cost me 200 cedis books 📚 Tears full eyes",
 "Abeka hostel toilet only 1 for 25 girls, queue long pass ECG office, morning stomach upset be death sentence 🚰 Toilet queue be worse than shower",
 "Roomie dey eat my birthday cake keep for night without telling, left empty box with 'sorry' note 🎂 Sorry for what? Chop finish?",
 "Agent scam my friend: fake landlord, fake receipt, fake key, real tears, 7k loss for Madina 😭 Police say track number off",
 "Madina hostel get water flowing only Tuesdays, other days fetch from distance polytank, bathing be project 💧 Water rationing be punishment",
 "My bunkmate dey spray insecticide 12am choke room close windows, coughing war, mosquitoes vs humans both dying 🦟 Chemical warfare",
 "Roomie dey use room as boutique, customers knock 7am to 10pm try clothes for our bed, I no get rest 👗 Business vs residence conflict",
 "Tesano landlord lock storeroom with our stored chop boxes during vacation demand 100 cedis each before release 🍱 Storage ransom be new scam",
 "Somebody dey steal gas by swapping our full cylinder with empty at dawn, professional gas thief for girls hostel 🧯 Innovation in stealing",
 "Shower queue gist be sweet ooo, best gist dey for bathroom line 5:30am, friendship form for queue 🚿 Queue turn to social club",
 "Landlord children dey steal our drying clothes wear, catch small boy with my Lacoste, mama defend am 👗 Family thief cover-up",
 "My roomie dey sleep with mouth open drool for pillow we share? I buy demarcation pillow still e cross border 😷 Sleep boundary collapse",
 "2-years advance kill my NSS savings, now I dey broke plus hungry but with roof, poverty with shelter 😩 Trade-off be painful",
 "Abeka hostel caretaker dey demand 'weekend fee' for visitors 30 cedis, receipt none, pocket money scheme ⏰ Corruption small small",
 "Madina room spray wars: 3 different perfumes clash choke asthma, windows shut rain dey, suffocation gist 🌸 Scent battle wahala full",
 "Roomie dey hide boyfriend for wardrobe when warden knock, sneeze expose am, eviction letter next day 💑 Wardrobe boyfriend chronicles",
 "Tesano harmattan dust plus broken louvre enter room free, sweeping 3 times daily, cleaning be full-time job 🧹 Dust invasion tire me",
]

hashtag_sets = [
 ["#GCTUHostel","#RoommateWahala"],["#StewThief","#GCTUGist"],["#ShowerQueue","#TesanoLife"],
 ["#LandlordPalava","#GCTUHostel"],["#AgentScam","#TesanoLife"],["#2YearsAdvance","#GCTUBabes"],
 ["#PerchingLife","#RoommateWahala"],["#LightBillWahala","#GCTUHostel"],["#SnoreSquad","#HostelDiaries"],
 ["#GCTUGist","#AbekaHostel"],["#MadinaGirls","#GCTUHostel"],["#HostelDiaries","#ShowerQueue"],
 ["#TesanoLife","#GCTUGist","#GCTUHostel"],["#RoommateWahala","#GCTUBabes","#StewThief"],
 ["#LandlordPalava","#2YearsAdvance","#GCTUHostel"],["#PerchingLife","#TesanoLife","#HostelDiaries"],
 ["#LightBillWahala","#RoommateWahala"],["#SnoreSquad","#TesanoLife"],["#AbekaHostel","#AgentScam"],
 ["#MadinaGirls","#ShowerQueue","#GCTUGist"],["#GCTUHostel","#HostelDiaries","#GCTUBabes"],
 ["#RoommateWahala","#LandlordPalava","#TesanoLife"],["#StewThief","#ShowerQueue"],
 ["#2YearsAdvance","#AgentScam","#GCTUHostel"],["#PerchingLife","#GCTUGist"],
]

# comment templates - long girl convo style
comment_pool = [
 "Aww sis I feel you waaa, my roomie for Tesano dey do same thing, I don taya to complain 😭",
 "Herh this be so true! Abeka hostel life go humble you, you go learn patience by force 😤",
 "Eii girls, solution be lock your food inside box with padlock, trust nobody for kitchen 🍲",
 "My roomie dey snore like this too, I buy earplugs 15 cedis for Makola, e save my life small 😭",
 "Landlord stories for Madina be horror film, our own chase us with cutlass for light bill top-up 🏠",
 "Sis advice: hold room meeting write rules paste for wall, e work for our room small 📓",
 "I swear shower queue be the reason I fail 8am class twice, lecturer think say I be lazy student 🚿",
 "Perching life no easy ooo, I perch 1 sem, the girl treat me like visitor everyday, I cry tire 🛏️",
 "Agent scam pain me pass breakup, 450 viewing fee plus fake pictures, God punish them 😡",
 "2-years advance be wickedness, where student go get 15k? Government must intervene abeg 😩",
 "My roomie dey steal stew too, I catch am by marking pot level with marker, evidence catch am 🍲",
 "Light bill sharing go cause third world war for our hostel, freezer owners wan pay equal 💡",
 "Sis I dey tell you, buy your own bucket write name with permanent marker, still dem go steal am 🪣",
 "Hahaha my roomie dey do midnight prayers too, I join am one day my problems reduce small 🙏🏽",
 "Tesano landlords be something else, dem go collect rent quick but fix nothing for 2 years 🏠",
 "Girl advice: record the snoring play am for her, shame go make she go clinic, e work for us 😂",
 "Madina hostel bathroom be war zone 5am, I dey bath 9pm night to dodge queue, try am 🌙",
 "Boyfriend wey dey live for girls hostel be red flag, tell your roomie plain, set boundaries 💑",
 "We contribute fix shower head ourselves 120 cedis, landlord refund? story, forget am 🚿",
 "Abeka agents be thieves, always go inspect with someone, video everything before you pay 🕵🏽‍♀️",
 "My roomie borrow my cream finish, I do invoice give am, she pay small small, do same 😂",
 "Sis perching with rules be okay, do cleaning roster, buy gas together, communicate early 🧹",
 "ECG prepaid be scam for hostels, one meter 10 rooms, confusion everyday, separate meter better 🔌",
 "Eii wig borrowing without permission be disrespect, hide am for locked box, girls no dey fear 💇🏽‍♀️",
 "Roomie wey dey cook 11pm? Buy nose mask plus talk am, hunger at night be real but consideration too 😷",
 "Our landlady seize gas too, we protest together threaten report, she return am, unity works 🧯",
 "Shower queue gist be the best gist, I meet my bestie for queue 2024, now we be sisters 🚿💗",
 "Light off during assignment be trauma, invest in powerbank 30k mAh, e save GPA oo 💡📚",
 "Stew thief must refund! Call room meeting taste and see, shame them small, hunger no be excuse 🍲",
 "Tesano to campus walk be marathon, get bicycle if you fit, leg go thank you 🚶🏽‍♀️",
 "Hahaha snore victim association meeting, we plenty ooo, membership card be earplugs 😭😂",
 "Landlord advance be killer, try group 4 girls split 2-bedroom, e reduce small, I fit link you 🏠",
 "Sis I sleep floor 3 months perching, back pain be real, stretch every morning, e go pass 🛏️",
 "Dirty roommate? Buy two baskets label names, photo evidence for group chat, e dey shame them 🧹",
 "My hostel get bedbugs too, hot water plus DDT plus sun mattress 3 days, e go die 🦟",
 "Girl code: never use someone sponge ooo, infection full, buy your own 10 cedis, health first 🧽",
 "Prepaid contribution must be transparent, create WhatsApp group drop receipt every time 💡",
 "Abeka hostel rats? Cover food with tight lids, trap 25 cedis, landlord no go help 🐀",
 "Warden wey dey open rooms be thief, change padlock plus report to student affairs, no fear 🕵🏽‍♀️",
 "Sis I relate, my bunkmate alarm be 5 different times, I dash am earpiece free, peace return ⏰",
 "Toilet queue for girls hostel fit make you mess, wake 4:30am sharp, strategy be key 🚰",
 "Roomie gossip? Confront am calm with evidence, if e continue, request room change 📢",
 "Gas sharing wahala? Buy electric coil for your rice separate, calculate cost clear 🧯",
 "Tesano flood be real ooo, raise bed with blocks rainy season, keep books for top shelf 🌊",
 "Boyfriend visit money? Tell landlady rule apply all, record selective enforcement, report 📢",
 "My roomie dey play music loud too, we agree quiet hours 10pm-5am, signed paper, e work small 🔊",
 "Slippers thief be tradition for hostel, write name plus carry inside polybag go bath 🩴",
 "Sis stew lock with small chain padlock for pot cover, extreme but e work, try am 😂🍲",
 "Madina water brown? Boil plus filter, complain to assembly, landlord fear officials small 💧",
 "Perch queen duties? Set boundaries early, no be maid ooo, split chores equal, talk am 🧹",
 "Fan noise? Contribute 150 buy new one split, old age fan be torture, peace worth money 🌀",
 "Roomie perfume choke? Gift her mild spray joke, talk about asthma, health talk dey work 🌸",
 "Curfew vs night class wahala, get watchman number, contribute tip monthly, e dey open quick ⏰",
 "Snoring denial be common, play voice note for whole room laugh, she go accept go hospital 😂",
 "Pot hiding under bed no work, thieves get radar, better cook small quantity finish at once 🍲",
 "Electric shock for bathroom? Report ECG plus police, no joke with life, threaten landlord court 🚿⚡",
 "Pink room? Buy removable wallpaper 80 cedis cover am, sanity first, landlord no go vex 🌸",
 "Bra thief? Dry inside with fan, outside line be boutique for thieves, safety first 👗",
 "Kettle seizure be selective, use low voltage coil hide well, survival mode 🫖",
 "Bathroom singer dey delay queue, knock code 5 mins each, paste timetable, e help 🚿",
 "Washing machine fee be scam, hand wash in groups turn by turn gist dey sweet sef 🧹",
 "Beans gas hog? Time cooking share cost by hours, maths no lie, present table 🧯",
 "Empty room promise? Never pay full before key plus inspection, video proof, receipt with ID 🏠",
 "Leftover banku smell? Buy air freshener plus dash dustbin, hygiene meeting urgent 🍳",
 "Peeping boys? Gather girls video evidence report police, landlord go act fast when police call 🌃",
 "TikTok without consent be crime, report account, demand delete, privacy be right 📱",
 "Milo thief? Pour for sealed container hide for bag, kitchen shelf be public buffet 🍱",
 "Fake agent plus fake key be jail matter, always verify landlord ID plus LC letter before cash 😡",
 "Slippers swap? Buy unique colour plus mark am, still carry go bathroom door inside bag 🩴",
 "Lizard family? Seal cracks plus net windows 60 cedis, e reduce, Accra lizards stubborn 🦎",
 "Socket overload dey cause fire ooo, buy extension with fuse, bill share by gadgets count 💡",
 "Online quiz plus dumsor be failure combo, hotspot two networks MTN plus Telecel backup 📶",
 "Floor mattress back pain? Fold blanket double plus morning stretch YouTube, e help small 🛏️",
 "Landlady gossip? Give her wrong gist test am, catch am red-handed then confront 📢😂",
 "Tap flood books? Claim cost from culprit meeting, carelessness must cost, e go learn 📚",
 "Birthday cake thief? Label plus hide for friend room, hostel hunger no get mercy 🎂",
 "Madina water only Tuesdays? Store gallons Monday, bucket rota, survive strategy 💧",
 "Insecticide choking? Agree spray time 5pm open windows, rules save lungs 🦟",
 "Boutique for room? Complain warden plus set visiting hours, business no fit disturb sleep 👗",
 "Storage ransom? Pack go home with bus, storage for trusted senior, never leave with landlord 🍱",
 "Gas swap thief? Chain cylinder to window plus mark paint, dawn thief go fail 🧯",
 "Queue gist sweet pass lecture sometimes, best connections dey for 5am line, network there 💗",
 "Landlord pikin thief? Photo evidence show mama, demand pay, no shame, your money matter 👗",
 "Drool for shared pillow? Buy divider pillow plus own bedsheet, boundary be health 😷",
 "NSS savings chop by rent? Side hustle hair braiding plus thrift, girls dey survive broke 😩",
 "Caretaker weekend fee be chop money, demand receipt, threaten report owner, e go stop ⏰",
 "Tesano hostel mattress be plywood with foam 1-inch, my waist don shift, landlord say luxury 😭 Where the comfort?",
 "Roomie dey keep okra stew 4 days without fridge in this heat, smell go kill, she still dey eat am 🍲 Food poisoning loading",
 "Abeka shower door no dey lock, I dey bath dey hold door with one hand soap with other 🚿 Privacy be luxury",
 "Landlord disconnect meter remote from abroad, caretaker say 'oga say no pay no light', we dey beg on phone 💡 Remote wickedness",
 "My roomie dey use my toothpaste squeeze from middle, cap no close, paste dry, manners zero 😷 Small things dey vex",
 "Perching for Tesano boys hostel as girl? Warden chase me 11pm, I run with bucket, shame catch me 😬 Desperation gist",
 "Madina room 6 girls 2 sockets, extension wire be spider web, spark dey come, fire risk full ⚡ But light bill still 800?",
 "Agent fee receipt be photocopy with no signature, 600 cedis gone, office locked next day 😡 Paper scam be real",
 "Roomie dey wash panties leave for bathroom 3 days, water drip for my slippers, eww talk tire 👗 Hygiene zero",
 "Tesano landlord bar boys from gate but girls dey sneak through back wall hole, wall don turn to border 😂 Security joke",
 "My bunkmate dey eat gala plus groundnut for top bunk, crumbs dey fall for my mouth downstairs 😤 Upstairs vs downstairs war",
 "Light bill meeting turn fight, one girl pour pure water for another, warden dissolve meeting 💡 Democracy fail",
 "Stew thief installed? I set trap with extra pepper bomb, thief chop cry whole night, confession come morning 🍲 Justice served",
 "Shower queue mama with 4 buckets occupy front every dawn, 'I dey fetch for sisters', monopoly wahala 🪣 Queue queen must fall",
 "Abeka landlord increase rent say he fix gate, gate na rope with padlock, 2k increase for rope? 🏠 Insult",
 "Roomie dey do lashes business for room 6am-11pm, glue smell choke, clients sit for my bed 💅🏽 Business vs roommate peace",
 "Madina agent show me room with someone things inside say 'she dey vacate soon', she never vacate 2 semesters 😡 Occupied scam",
 "My roomie dey pray against marine spirit mention my name coded, fear catch me, hostel spiritual war 🙏🏽 I go fast too",
 "Tesano hostel cockroach fly enter my stew pot cover open small, I pour whole pot cry 😭 Protein extras no be my portion",
 "Perching rent? Room owner charge me 250 monthly for floor plus rules pass landlord, perching landlordism 🛏️ Double rent wahala",
 "Bathroom light thief remove bulb take go room, we dey bath for darkness with phone torch 🚿 Bulb thief be lowest",
 "Landlord say final year students must vacate 1 month before exams for renovation, where we go sleep? 📚 Renoviction be wicked",
 "Roomie dey borrow my charger spoil pin return bend, now e dey spark, I buy new lock am 🔌 Borrowers be destroyers",
 "Abeka hostel water tanker 300 cedis split 15 girls, landlord refuse contribute though e be ein property 💧 Water capitalism",
 "My roomie dey keep cat for hostel against rules, cat chop my fish, warden catch, drama full compound 🐈 Pet palava",
 "Tesano watchman dey toast all girls demand 'good morning hug' before open gate, harassment be this 😡 We report am soon",
 "Snoring plus fart combo from lower bunk, night be chemical plus sound warfare, I dey sleep veranda mosquitoes prefer 😭 Double attack",
 "Roomie dey use my shea butter mix with ein cream, container half, confession none 💄 Mixture thief",
 "Madina landlord lock polytank Mondays say we waste water, hygiene suffer, smell full room 💧 Punishment without crime",
 "Shower cap thief steal my new bonnet for bathroom hook, who dey steal bonnet? Hair envy? 💇🏽‍♀️ Petty theft chronicles",
 "Agent viewing timetable scam: 10 girls same hour same room, auction to highest bidder, rent go up live 😡 Bidding war",
 "Light bill high because ironing business for room 5, commercial use residential bill, we suffer 💡 Business bill sharing be fraud",
 "My roomie dey cry every night for phone with boyfriend, sleep zero, heartbreak secondhand 💔 Sympathy plus insomnia",
 "Tesano hostel ceiling leak rain pour for my bed, books soak, landlord say 'manage rainy season' 🌊 Roof scam",
 "Roommate dey cook yam with my gas 2 hours without asking, pot black, gas half, apology zero 🧯 Gas vampire",
 "Abeka warden collect 10 cedis per parcel keep for office, delivery extortion, online vendors suffer 📦 Small thievery",
 "Perching sisterhood sweet sometimes: gist till 2am, share food, cover for each other, hostel be family too 💗 Balance gist",
 "Madina shower cold only no hot, harmattan bath be ice baptism, scream wake hostel 🚿 Cold therapy by force",
 "Roomie dey leave wet towel for my bed, bed damp smell mildew, talk am she laugh 🧖🏽‍♀️ Respect zero",
 "Landlord burial levy 100 cedis per tenant for ein father funeral we never meet, emotional blackmail? 🏠 Levy wahala",
 "Tesano agent juju threat after I demand refund, 'you go run mad', fear plus anger mix 😡 Scam plus threats be police case",
 "My bunkmate dey scroll Instagram reels loud no earpiece 1am, algorithm laugh plus light kill sleep 🔊 Digital inconsideration",
 "Stew sharing formula fail: who buy meat vs pepper vs oil contributions unequal, quarrel every cooking 🍲 Cooking economics be hard",
 "Shower queue jump by senior 'I be final year respect me', junior step back fear, hierarchy for bathroom? 🪣 Seniority scam",
 "Abeka landlord dog bark whole night chase sleep, complain say dog be security, sleep vs security tradeoff 🐕 Noise security",
 "Roomie dey air dirty laundry chair mountain 2 weeks, smell plus mosquitoes camp, washing procrastination 👗 Laundry mountain be landmark",
 "Prepaid loan from neighbour room with interest 20 cedis per 50 units, loan shark for hostel? 💡 Dumsor capitalism",
 "Tesano hostel party noise Saturday till 4am, test Monday, neighbours no sleep, enjoyment vs exams clash 🔊 Party wahala",
 "Madina room spray wars: 3 different perfumes clash choke asthma, windows shut rain dey, suffocation gist 🌸 Scent battle",
 "Roomie dey hide boyfriend for wardrobe when warden knock, sneeze expose am, eviction letter next day 💑 Wardrobe boyfriend chronicles",
 "Abeka bucket fetching from well 5am rope cut bucket fall inside, contribution for new rope wahala 🪣 Well of wahala",
 "Landlord CCTV for girls corridor only, privacy complaint ignore, safety or spying? We cover am with cloth 📹 Paranoia",
 "Tesano harmattan dust plus broken louvre enter room free, sweeping 3 times daily, cleaning be full-time job 🧹 Dust invasion",
]

posts = []
used_texts = set()
for i in range(150):
    body = bodies[i]
    tags = hashtag_sets[i % len(hashtag_sets)]
    # inline hashtags in text - append with varied connector
    connectors = [" ", " ... ", " lol ", " chale ", " hmm "]
    # ensure 2-4 inline: tags already 2-3, good
    tag_str = " ".join(tags)
    # vary placement: mostly end, sometimes mid
    if i % 5 == 4:
        # mid + end split
        text = f"{body} {tags[0]} e be serious matter 😭 {tag_str}"
    else:
        emj_end = ["😭","😂","🙄","😩","💔","🤣","😤","🥲"][i % 8]
        text = f"{body} {emj_end} {tag_str}"
    assert text not in used_texts, f"dup at {i}"
    used_texts.add(text)
    ptype = ["confession","gossip","meme"][i % 3]
    # yeahs: every 4th trending (i%4==0) -> 38 posts trending
    if i % 4 == 0:
        yeahs = random.randint(350,800)
        boosted = True
    else:
        yeahs = random.randint(30,300)
        boosted = False
    author = authors[i]
    avatar = girl_emojis[i % len(girl_emojis)]
    # comments 9-14
    n_c = 9 + (i % 6)  # 9-14 cycle
    comments = []
    # first comment references post directly for realism
    first_texts = [
        f"Eii sis this be my story word for word, {body.split(',')[0][:60]}... I feel you 😭💗",
        f"Hahaha {author} you talk my mind, hostel life go show you pepper 😂",
        f"Sis sorry ooo, this Tesano/Abeka/Madina hostel wahala too much, message me make I link you better place 💗",
    ]
    c0t = first_texts[i % len(first_texts)]
    cn0, ce0 = commenter_names[(i*3) % len(commenter_names)]
    comments.append({"ghostId": f"{cn0}{301+i%97}", "avatarEmoji": ce0, "text": c0t})
    for j in range(1, n_c):
        pool_txt = comment_pool[(i*7 + j*3) % len(comment_pool)]
        cn, ce = commenter_names[(i*5 + j*2) % len(commenter_names)]
        # make ghostId unique-ish per comment
        gid = f"{cn}{302+((i+j*13)%140)}"
        comments.append({"ghostId": gid, "avatarEmoji": ce, "text": pool_txt})
    posts.append({
        "text": text,
        "campus": "GCTU",
        "type": ptype,
        "yeahs": yeahs,
        "boosted": boosted,
        "authorGhost": author,
        "authorAvatar": avatar,
        "hashtags": tags,
        "comments": comments
    })

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(posts, f, ensure_ascii=False, indent=2)

print(f"WROTE {len(posts)} posts")
# verify
import collections
print("types:", collections.Counter(p["type"] for p in posts))
print("boosted:", sum(1 for p in posts if p["boosted"]))
print("campus unique:", set(p["campus"] for p in posts))
print("unique texts:", len(set(p["text"] for p in posts)))
print("unique authors:", len(set(p["authorGhost"] for p in posts)))
print("comments range:", min(len(p["comments"]) for p in posts), max(len(p["comments"]) for p in posts))
# hashtags inline check
bad = [i for i,p in enumerate(posts) if not all(h in p["text"] for h in p["hashtags"])]
print("hashtag mismatch:", bad[:5], "count", len(bad))
