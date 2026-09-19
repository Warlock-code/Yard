import json, random, datetime

random.seed(20260919)

campuses = ["University of Ghana", "KNUST", "UCC", "UPSA", "UEW", "GCTU", "UDS", "University for Development Studies", "UHAS"]
# normalize: use canonical names matching Prisma campus values in seeds
campus_pool = ["University of Ghana", "KNUST", "UCC", "UPSA", "UEW", "GCTU", "KNUST", "University of Ghana", "UCC", "KNUST", "University of Ghana"]  # weighted to UG/KNUST/UCC

# Ghosts for comments
ghosts = [
    ("MidnightScholar", "👻"),
    ("QuietStorm_22", "🐍"),
    ("CampusWhisperer", "👽"),
    ("HallwayGhost", "👻"),
    ("TheRealTalker", "🧙"),
    ("SilentObserver", "🦇"),
    ("NightOwlNotes", "👻"),
    ("LibraryLurker", "🕷️"),
    ("DailyConfessor", "😂"),
    ("CanteenCritic", "👻"),
    ("DriftStorm_9394", "👻"),
    ("LegonSleeper", "😴"),
]

supportive_comments_pool = [
    "Aww this be the love we dey pray for 🥺❤️ protect her at all cost!",
    "You go make am! This kind love dey sharpen GPA sef 😍",
    "Chale aww 🥰 this be sweet pass shito and jollof",
    "Protect him ooo! Boys wey dey cook be gem 💎",
    "Ei this be beautiful wai! God bless your union 🙏❤️",
    "Herh this dey make me believe for campus love again 😭❤️",
    "Keep am tight! Real love dey help you study sef 📚❤️",
    "Awwwww 🥺 you two dey give us hope for Yard!",
    "This sweet me dieee! More blessings to una 🙌",
    "Love wey dey support hostel + GPA be correct love! Rooting for una 💪",
    "Charley this be pure! No go loose am ooo 🔒❤️",
    "Sweet gist! He cooks for you? Keep am, marriage material be that 😂❤️",
    "You go make am both! GPA and love fit walk together 💯",
    "Aww protect that babe, she deserve heaven 🥺",
    "This how e for be! Supportive love win pass all 😍",
    "Herh my eye don full with tears, sweet love 😭",
    "Couple goals wey dey make sense! Learn dey go, love dey go 😍📚",
    "Chale this be the energy we need for campus! Love-ly 😂❤️",
    "Keep supporting each other, una go graduate together with first class + love ❤️🎓",
    "Aww give am hug for us! This be wholesome paaa 🥰",
    "No toxic, just peace! We love to see am 🙏",
    "This dey give me hope say my own go come 😭❤️",
    "Protect her like your GPA! She be your A+ ❤️",
    "Ei sweet! Hostel love wey dey pay bills together be real one 😍",
]

post_texts = [
    # 1-10 loving confessions
    "Chale I for confess ooo 🥺 My Legon babe dey cook for me every Sunday after church. Light soup, ampesi, plus extra meat sey make I get strength for week lectures. I no dey pay shishi, just love. Who say campus love no dey sweet? 😭❤️ #love #relationships #LegonLove #CampusCouple",
    "Eii KNUST sweet love alert 😍 My guy dey wake 5am go queue for Bush Canteen make e buy waakye + zomi before my 8am class. He no dey complain, he say 'your smile be my breakfast'. Herh boys dey try ooo! #love #relationships #KNUSTLove #CoupleGoals",
    "UCC lovers dey show workings ooo 🥺 My coursemate and ein babe dey study together for Sam Jonah Library 7pm to 11pm everyday. She help am move from GPA 2.1 to 3.4! Love wey dey push GPA be the best love 💪📚 #love #relationships #UCCLove #GPAandLove",
    "Herh UPSA love sweet pass jollof 😭 My roomie ein boyfriend pay ein hostel part payment 1200 cedis say make she no perch. She cry for 10mins. He hug am say 'we go learn together'. Protect him at all cost abeg! #love #relationships #UPSALove #HostelLove",
    "Chale GCTU gist 🥰 That level 300 couple wey dey match white polo for campus everyday? Them dey do past questions together for night class and them both get 3.8 last sem! Couple goals wey dey make sense! #love #relationships #GCTULove #StudyCouple",
    "Aww Legon confession 🥺 I be shy girl, I no dey talk for class. My crush from Political Science just dey help me with presentations, hype me say 'you go make am'. Now I dey get A for presentations! Crush turn support system 😭❤️ #love #relationships #LegonCrush #CampusCrush",
    "Eii KNUST Ayeduase love 😍 My babe carry my dirty clothes go wash for weekend sey make I focus for mid-sem exam. She iron am sef! I cook jollof for am next day as thank you. We dey trade love and chores, no stress ❤️ #love #relationships #KNUSTLife #HeCooksForMe",
    "UCC Kwaprow sweet story 🥺 My guy fail one course last year, ein babe no leave am. She dey wake am 4am for morning revisions, share ein notes, pray for am. This sem he pass with B+! Real love dey stay for low GPA too 😭💪 #love #relationships #UCCLove #SupportiveLove",
    "Chale UEW Winneba love dey bee ooo 😍 Level 100 babe confess sey ein senior wey dey help am for orientation now be ein best friend plus study partner. He no dey pressure am, just dey guide am for campus life. Pure love! #love #relationships #UEWLove #CampusCrush",
    "Herh my Legon TF couple dey mad ❤️ Them dey share one powerbank, one hotplate, one bucket sef for Jean Nelson Hall but them dey laugh everyday. He braid ein hair before exams, she polish ein shoe before presentation. Sweet dieee! #love #relationships #LegonCouple #HostelLove",

    # 11-20 campus crushes / sweet confessions
    "Crush confession from UG 🥺 That fine boy for my ECON 101 wey dey always borrow me pen? Today he buy me sobolo plus meatpie before lecture say 'you look tired'. I no fit sleep for night ooo 😭❤️ #love #relationships #LegonCrush #CampusCrush",
    "KNUST crush gist 😍 I dey crush on that girl for Faculty of Law wey dey lead group discussion. She intelligent plus fine pass! She today help me solve 5 years past questions for free. I for shoot my shot before another guy do am 😭 #love #relationships #KNUSTCrush #CampusLove",
    "UCC Adehye Hall crush 😭 That level 200 guy wey dey play guitar for hall week? He sing for my babe birthday for balcony, whole hall clap! She cry sef. Herh if you no go do like that for your babe, abeg learn! 🥺🎸 #love #relationships #UCCCrush #SweetLove",
    "UPSA confession chale 🥺 I like that guy for accounting class wey dey always explain debit and credit with pidgin make we understand. Today he teach me for 3 hours, no fee. My heart dey beat like exam drum 😂❤️ #love #relationships #UPSACrush #CampusCrush",
    "Eii GCTU crush sweet ooo 😍 That babe for CS department wey dey code plus fine face? She help me debug my project 2am for night, still smile. Who no go fall? Herh I dey catch feelings bad bad 😭 #love #relationships #GCTUCrush #CampusLove",
    "Legon Balme Library crush 🥺 The boy wey dey reserve seat for me everyday without me asking? Today he leave sticky note 'Good luck for your paper, you go make am ❤️'. I melt like ice for sun! #love #relationships #BalmeLove #LegonCrush",
    "KNUST Unity Hall gist 🥰 That fine couple for Conti wey dey jog together 5:30am everyday for Paa Joe stadium? Them dey motivate whole hostel to dey exercise. She say 'we dey keep body and GPA fit together' Love wey dey healthy 😍 #love #relationships #KNUSTCouple #CoupleGoals",
    "UCC Science crush 😭 My lab partner wey dey wash apparatus for me when I dey late? He never complain. Today he buy me FanIce after 4 hours lab stress. I think I don fall chale 😂❤️ #love #relationships #UCCLove #LabLove",
    "UEW confession 🥺 That guy for Education block wey dey help me carry books to hostel every evening after lectures? He say 'make you no stress your pretty head'. Herh I dey blush for lecture hall 😭 #love #relationships #UEWCrush #SweetLove",
    "Herh UG Commonwealth Hall love 😍 Vandal babe dey date Hall babe? Them dey shout 'we are one' for hall week, dance together. Rival halls no matter when love dey inside. Sweet r! #love #relationships #LegonLove #HallLove",

    # 21-30 best couples / hostel love help
    "Best couple for Legon right now? That Sarbah Hall guy and Volta Hall babe wey dey sell thrift together for night market 🌙 Them dey save money for final year project together, no cheating gist, just business + love 💪❤️ #love #relationships #BestCouple #LegonGist",
    "KNUST best couple award go to that Engineering couple for Faculty 😭 Them dey build project together, she dey solder while he dey code. Lecturer call them 'Mr & Mrs Project'. 3.6 GPA both! How for no envy? 🥺 #love #relationships #KNUSTBestCouple #CoupleGoals",
    "UCC Atlantic Hall lovers 😍 That couple wey dey wash together for hostel, fetch water together 5am for Kwaprow when water dey scarce? Them dey sing while dem dey carry bucket. Hostel stress no fit kill their vibe! 💦❤️ #love #relationships #UCCLove #HostelCouple",
    "UPSA hostel love help gist 🥰 My guy ein girlfriend dey braid hair for hostel for 30 cedis make she support ein fees. He dey help am advertise for status. Them dey hustle together, no begging! Real partnership 😭💪 #love #relationships #UPSALove #HustleCouple",
    "GCTU Tesla Hall couple dey inspire 😭 Them dey cook together for hostel kitchen - he dey cut onion, she dey stir stew. Roommates dey jealous but them dey share food give all of us! Love wey dey feed community ❤️🍲 #love #relationships #GCTULove #HeCooksForMe",
    "Chale Legon Evandy hostel sweet gist 🥺 My neighbour ein boyfriend fix ein leaking roof with 200 cedis from ein savings. She no ask am sef! He say 'you for sleep well for exam'. Herh some boys get sense! #love #relationships #LegonLove #SupportiveBoyfriend",
    "KNUST Brunei hostel love 😍 That babe wey dey iron ein boyfriend ein shirt every Monday before presentation? He dey polish ein shoe for am as exchange. Them dey look sharp together for class like CEO couple 😂❤️ #love #relationships #KNUSTLove #CampusCouple",
    "UCC Valco Hall sweet couple 🥺 Them dey pray together every 10pm for room before sleep, read devotion. No noise, just peace. Hostel warden sef commend them. Love + God = solid 😭🙏 #love #relationships #UCCLove #GodlyCouple",
    "Herh Legon pentagon hostel love 😭 My friend babe dey help am pay water bill 50 cedis every month without noise. She dey cook for am when he dey sick. Small small love dey be big love! #love #relationships #PentagonLove #SupportiveLove",
    "KNUST Emena hostel couple goals 😍 Them dey do laundry together Sunday morning for hostel forecourt, dey gist and laugh while scrubbing. People dey watch like movie. Work wey dey sweet when love dey inside ❤️ #love #relationships #KNUSTLife #LaundryLove",

    # 31-40 GPA love trade-offs positive + sweet he cooks
    "Eii GPA love trade-off wey make sense 😍 My babe and I decide say no outing if we no finish 2 past questions. Now we dey get A for stats! Love wey dey discipline GPA be the best trade 😭📚 #love #relationships #GPALove #StudyAndLove",
    "Chale confession 🥺 I bin dey fail French, my Legon boyfriend who be French student teach me 1 hour every evening for Akuafo Hall bench. Last sem I get B! He no collect shishi, just say 'your pass be my joy' ❤️ #love #relationships #LegonLove #GPALove",
    "KNUST love and GPA gists 😭 My girlfriend dey hide my PlayStation pad during exam week say 'go read book'. I vex small but now I get 3.5! She save me from 2.0 life 😂❤️ #love #relationships #KNUSTLove #GPAHelp",
    "UCC GPA sweet gist 🥺 That couple for Education wey dey compete who go get higher GPA every sem? Loser go cook for winner for one week! Both dey get 3.7+ now. Love wey dey push you go first class be correct! 💪 #love #relationships #UCCLove #GPABattle",
    "He cooks for me series 😍 UG edition: My guy cook banku and okro stew for me today after my 3 hour lab stress. He even feed me like baby 😭 I no go leave this one ooo, marriage be that! #love #relationships #HeCooksForMe #LegonLove",
    "She cooks for me too ❤️ KNUST babe dey wake 6am fry plantain and egg for ein boyfriend before he go site for internship. She pack am for flask. He dey brag for site sef! Sweet pass 😍 #love #relationships #SheCooksForMe #KNUSTLove",
    "Herh UCC hostel cooking love 😭 My guy learn how to cook gari foto just because ein babe dey crave am for night. He watch YouTube 1 hour then cook am! She cry sef, hostelmates chop some. Who no go love such guy? 🥺 #love #relationships #HeCooksForMe #UCCLife",
    "Legon love GPA balance 🥰 Me and babe get rule: 6pm-9pm na study time, 9pm-10pm na call time. No calls during lectures! We both improve from 2.9 to 3.3. Structure dey make love sweet! 📚❤️ #love #relationships #LegonCouple #GPALove",
    "UPSA GPA love win 😍 My boyfriend dey do late night accounting revision with me for hostel even though he be marketing student. He dey stay till 1am make I no sleep. I pass BEC 301! That be sacrifice 😭❤️ #love #relationships #UPSALove #SupportiveLove",
    "GCTU sweet trade-off 🥺 We no dey date wacky nightclubs during exam week. Instead we dey visit library link-up dates! Our friends laugh us but we dey get 3.6. Love no mean you for fail 😂📚 #love #relationships #GCTULove #WiseLove",

    # 41-50 more hostel help, sweet "he cooks", supportive
    "Eii hostel love help for UG Legon 🥺 My roommate ein boyfriend bring gas cylinder from home for them because hostel hotplate dey spoil every week. Now them dey cook proper food, save money for indomie. Guy be provider! 😍 #love #relationships #HostelHelp #LegonLove",
    "KNUST Bomso hostel gist 😭 My babe and I contribute 50 cedis each every month for hostel water + light. No argument, just teamwork. We budget like husband and wife already 😂❤️ #love #relationships #KNUSTLove #HostelBudgeting",
    "UCC hostel love sweet 😍 That couple for Oguaa Hall wey dey clean room together every Saturday morning before going for lectures? Room dey shine pass lab! Love wey dey neat be peace ❤️✨ #love #relationships #UCCLove #NeatCouple",
    "Herh Legon sweet gist 🥺 My guy dey fetch water for me 6am before class when Legon water dey go off. He carry two buckets for head like woman 😂 He no shame, love cover shame! #love #relationships #LegonLove #RealLove",
    "KNUST Ayeduase cooking again 😍 She cook indomie with sardine 11pm after both of them close from night class. He wash plates after. Small food but big love for exam stress night 🥺🍜 #love #relationships #HeCooksForMe #KNUSTLife",
    "UCC Windy Bay love story 🌅 That couple wey dey go Windy Bay every Sunday evening just to gist and watch sunset? No money needed, just talk. He dey listen to ein babe problems for 2 hours. Sweet communication 😭❤️ #love #relationships #UCCLove #SunsetLove",
    "Legon Botanical Gardens date 🥰 My boyfriend organize picnic for me with 20 cedis - sobolo, bread, choco and Bluetooth speaker. We study under tree after. Simple but I rank am pass 5 star hotel 😍🌳 #love #relationships #LegonDate #LowBudgetLove",
    "UPSA supportive gist 🥺 My babe get sick for hostel, ein boyfriend miss ein morning class carry am go Legon hospital, stay with am whole day. He record lecture for am. Lecturer sef praise am 😭❤️ #love #relationships #UPSALove #CareLove",
    "GCTU night class love 😍 That couple wey dey sit together for night class dey share earpiece dey listen to lo-fi while solving questions? Them no dey disturb, just dey vibe and learn till 2am. Love wey dey quiet but strong 🥺🎧 #love #relationships #GCTULove #NightClassLove",
    "KNUST love wey dey inspire 🥰 That final year guy wey propose to ein girlfriend after they both defend project same day? He kneel for faculty front with ring! Whole department cry 😭 Them date since level 100! #love #relationships #KNUSTProposal #CampusLove",

    # 51-60 best couples, supportive, loving
    "Best couple for UCC? That level 400 couple wey dey graduate together this Nov 😭 Them dey match gown for photoshoot, GPA 3.6 both, hostel hustle from level 100 to now. 4 years of love no cheat! Iconic 🥺🎓 #love #relationships #UCCBestCouple #GraduationLove",
    "Legon campus couple goals 😍 That footballer guy for Legon and ein babe wey dey attend every match with placard 'My King'? He kiss am after every goal! Whole stadium dey shout aww 😂⚽❤️ #love #relationships #LegonCouple #SupportiveGirlfriend",
    "KNUST Tech Junction love gist 🥰 That babe wey dey sell kelewele for Tech Junction night? Ein boyfriend dey help am pack things after sales 10pm, carry am home. She dey save for fees. Love wey dey hustle together sweet pass 😭 #love #relationships #KNUSTLove #HustleTogether",
    "Herh UCC health gist 🥺 My guy dey remind ein babe to take medicine every morning 6am for ein hostel. She get asthma, he set alarm. She never miss med since them start date. Care wey dey save life 🙏❤️ #love #relationships #UCCLove #CarefulLove",
    "UPSA gym couple 💪😍 Them dey gym together 5am for Okponglo, motivate each other to no skip class. She do 10 squats, he do 10. Body fit, GPA fit, love fit! Why we no be like them? 😂 #love #relationships #UPSACouple #GymCouple",
    "Legon faith couple 🥰 That couple wey dey go Night of Worship together every Friday for Central Cafeteria? Them dey hold hands dey pray for exams. No clubbing, just worship + love. Pure paaa 🙏❤️ #love #relationships #LegonLove #FaithCouple",
    "KNUST supportive love 🥺 My babe get presentation anxiety, ein guy rehearse with am for 3 nights, help am with slides, hype am 'you be boss'. She get A! He clap pass lecturer 😭👏 #love #relationships #KNUSTLove #SupportSystem",
    "UCC lovers wey dey show 🥰 That couple wey dey wear same Ankara for hall dinner? Them sew with 80 cedis material but dem shine pass boutique wear! Love dey make borla material look like Gucci 😂❤️ #love #relationships #UCCLove #AnkaraLove",
    "GCTU hostel sweet help 😍 My friend babe dey help am do assignment proofreading for free, correct ein grammar make e no fail. She be English student, he be engineering. Love wey dey cross department be nice 😭📚 #love #relationships #GCTULove #AssignmentLove",
    "Legon Akuafo Hall sweet gist 🥺 That guy wey dey braid ein babe hair for hostel balcony before 8am lecture? He learn from YouTube! Girls for hostel dey watch dey shout 'husband material' 😂❤️ #love #relationships #HeBraidsHair #LegonLove",

    # 61-70 final batch - loving confessions etc
    "Eii UG distance love still sweet 😭 My babe dey UCC, I dey Legon but we dey video call every night 10pm, share notes on WhatsApp, send momo 20 cedis for data. Distance no kill love when effort dey ❤️📱 #love #relationships #DistanceLove #LegonUCC",
    "KNUST love no be scam 🥺 After all the hostel scam gist, my landlord try scam me but my boyfriend follow me go argue for 1 hour till landlord refund 500 cedis. Love wey dey fight for you be real 😭💪 #love #relationships #KNUSTLove #ProtectiveLove",
    "UCC confession sweet 😍 I love that boy for my group work wey dey always defend me when group members dey bully me. He say 'she dey try her best'. Herh I dey fall everyday, he get heart of gold 🥺 #love #relationships #UCCLove #KindLove",
    "UPSA lowkey couple dey bee 🥰 Them no dey post for status but them dey chop together, study together for canteen every evening. Private love last pass public love! Keep am private but sweet 😍🤫 #love #relationships #UPSALove #PrivateLove",
    "GCTU confession chale 😭 I dey love this girl for 2 semesters but I dey fear to talk. She always smile when she see me for campus. Today I go shoot shot after exam, pray for me Yard! 🥺🙏 #love #relationships #GCTUConfession #CampusCrush",
    "Legon love letter gist 🥺 My guy write me 2 page handwritten letter for exam week say 'my love, you go pass, I dey with you'. No text, letter! I cry for my Sarbah room 😭💌 My mummy sef no write me letter before! #love #relationships #LegonLove #LoveLetter",
    "KNUST Dept love 😍 That Nursing guy wey dey date that lab tech babe? Them dey take care of each other. She check ein BP before exam, he bring ein drugs. Health couple dey represent 😂❤️ #love #relationships #KNUSTLove #HealthCouple",
    "UCC supportive comment wey I love 🥰 My boyfriend fail to get internship, I hype am say 'you go make am next time', cook fried rice for am. He smile again. Small support dey revive spirit 😭🍚 #love #relationships #UCCLove #SupportiveLove",
    "Herh this be my favorite couple for UG 🥺 Level 100 to level 300 still together, no break up, still dey hold hand for night market. Them dey prove say campus love fit last! We dey stan 😍🔒 #love #relationships #LegonForever #CampusLove",
    "Final confession charley 😭 Yard be gossip place but today make we spread love! If you get sweet boy or sweet babe wey dey cook for you, help hostel, push your GPA, hold am tight! Love wey dey sweet pass shito dey exist for Ghana uni! 🥺❤️🇬🇭 #love #relationships #GhanaUniLove #CampusLove",
]

# Supportive comment templates with Ghana pidgin loving tone
# We'll generate comments per post: 2-4 supportive
loving_comment_templates = [
    "Aww this sweet me dieee 🥺❤️ Protect am at all cost!",
    "You go make am! Love wey dey push GPA be the best 😍📚",
    "Aww protect her like your final paper ooo 🥺🔒",
    "This be the love we want for Yard! More blessings 🙏❤️",
    "Herh this dey make me believe say campus love fit work 😭❤️",
    "Chale keep am tight! He dey cook for you? Husband material be that 😂👨‍🍳",
    "Sweet pass jollof! You two go graduate with first class + love 🎓❤️",
    "Aww this be wholesome paaa, my eye don full 😭",
    "Love wey dey share hostel bills be real love! Rooting for una 💪❤️",
    "Ei beautiful wai! God go bless una union 🙏🥰",
    "Keep am! Supportive love be correct love 💯",
    "Awwwww 🥰 give am extra hug for us!",
    "This be pure love, no toxic! We love to see am 😍",
    "Charley marry am already 😂❤️ 4 years no be joke!",
    "Hostel love wey dey cook together dey last! Keep sharing food 🍲❤️",
    "You go make am together! GPA and love fit balance 📚❤️",
    "Aww my ovaries 😭 this sweet pass wine!",
    "Protect that guy, good boys dey scarce for campus 🥺",
    "This dey give me hope for my own crush 😭🙏",
    "Couple goals wey dey make sense! Study + love = win 💪",
    "Herh aww 🥺 this be movie love but for real life",
    "Keep loving, keep learning! Una be inspiration 😍",
    "Small small love dey turn big blessing! Stay together ❤️",
    "Chale this be the energy! Love + books + cooking = complete 😂❤️",
]

# Generate boosted flags 30%
num_posts = 70
boosted_indices = set(random.sample(range(num_posts), int(num_posts * 0.30)))  # 21

output = []
# Use fixed boostedUntil like hostel scam seed for consistency
boosted_until = "2026-09-26T23:59:59.000Z"

# For guaranteeing supportive keyword coverage per spec: "aww", "protect her", "you go make am"
aww_templates = [t for t in supportive_comments_pool if "aww" in t.lower()]
protect_templates = [t for t in supportive_comments_pool if "protect" in t.lower()]
ygma_templates = [t for t in supportive_comments_pool if "you go make am" in t.lower()]

for i, text in enumerate(post_texts):
    # Determine campus weighted but also try to match text mention, else random
    # Simple heuristic: if text contains "Legon" or "UG" -> UG, KNUST -> KNUST, UCC -> UCC etc
    lower = text.lower()
    if "legon" in lower or "sarbah" in lower or "volta" in lower or "akuafo" in lower or "commonwealth" in lower or "pentagon" in lower or "balme" in lower or "ug" == lower.split()[0]:
        campus = "University of Ghana"
    elif "knust" in lower:
        campus = "KNUST"
    elif "ucc" in lower or "kwaprow" in lower or "atlantic" in lower or "adehye" in lower or "oguaa" in lower or "valco" in lower or "sam jonah" in lower:
        campus = "UCC"
    elif "upsa" in lower:
        campus = "UPSA"
    elif "uew" in lower:
        campus = "UEW"
    elif "gctu" in lower or "tesla" in lower:
        campus = "GCTU"
    elif "uds" in lower:
        campus = "UDS"
    else:
        campus = random.choice(campus_pool)

    # type distribution: confession 50%, gossip 30%, meme 20%
    r = random.random()
    if r < 0.5:
        ptype = "confession"
    elif r < 0.8:
        ptype = "gossip"
    else:
        ptype = "meme"

    yeahs = random.randint(40, 280)
    boosted = i in boosted_indices

    # hashtags extraction
    import re
    hashtags = re.findall(r"#\w+", text)
    # ensure at least #love or #relationships present (they already are)
    # comments - 2-4 loving/supportive guaranteed to include "aww", "protect", "you go make am" coverage
    num_comments = random.randint(2, 4)
    # Build guaranteed supportive set: ensure each post has at least one aww AND one protect/you go make am
    guaranteed = []
    # always include one aww
    guaranteed.append(random.choice(aww_templates))
    # second slot: protect or you go make am
    if num_comments >= 3:
        guaranteed.append(random.choice(protect_templates))
        guaranteed.append(random.choice(ygma_templates))
    elif num_comments == 2:
        guaranteed.append(random.choice(protect_templates + ygma_templates))
    # fill remaining slots randomly
    remaining_needed = num_comments - len(guaranteed)
    if remaining_needed > 0:
        pool_remaining = [t for t in supportive_comments_pool if t not in guaranteed]
        guaranteed.extend(random.sample(pool_remaining, remaining_needed))
    # shuffle templates for natural order
    random.shuffle(guaranteed)
    used_ghosts = random.sample(ghosts, num_comments)
    comments = []
    for (gId, emoji), template in zip(used_ghosts, guaranteed):
        comments.append({
            "ghostId": gId,
            "avatarEmoji": emoji,
            "text": template
        })

    entry = {
        "text": text,
        "campus": campus,
        "type": ptype,
        "yeahs": yeahs,
        "boosted": boosted,
        "hashtags": hashtags,
        "comments": comments
    }
    if boosted:
        entry["boostedUntil"] = boosted_until
    output.append(entry)

# Validate boosted 30%
print(f"Generated {len(output)} posts, boosted {sum(1 for p in output if p['boosted'])}")
# Check yeahs range
print(f"yeahs min {min(p['yeahs'] for p in output)} max {max(p['yeahs'] for p in output)}")
print(f"comments per post min {min(len(p['comments']) for p in output)} max {max(len(p['comments']) for p in output)}")

with open("ghana-love-gist-seed.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print("Written ghana-love-gist-seed.json")

# Also verify hashtags contain love/relationships
love_count = sum(1 for p in output if any(h.lower() in ["#love", "#relationships"] for h in p["hashtags"]))
print(f"posts with #love or #relationships: {love_count}/70")

