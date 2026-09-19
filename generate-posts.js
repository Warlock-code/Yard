// Comprehensive post generation script for 1500+ girl perspective posts
// Targets GCTU campus feed with realistic Ghana university content

const fs = require('fs');
const path = require('path');

// Realistic ghost IDs and avatar emojis for Ghana university students
const ghostIds = [
  "LegonSleeper", "HallwayGhost", "QuietStorm_22", "CanteenCritic",
  "DailyConfessor", "LibraryLurker", "TheRealTalker", "MidnightScholar",
  "NightOwlNotes", "CampusWhisperer", "SilentObserver", "LegonSleeper",
  "DriftStorm_9394", "TrotroSurvivor", "KwaprowVibes", "UEW_Warrior",
  "AyeduaseBabe", "BronxBomso", "GCTU_Sniper", "KwaprowVibes",
  "MatchingFits", "SilentObserver", "LibraryLurker", "TheRealTalker",
  "NightOwlNotes", "DailyConfessor", "HallwayGhost", "QuietStorm_22",
  "MidnightScholar", "CampusWhisperer", "DriftStorm_9394", "LegonSleeper"
];

const avatarEmojis = [
  "👻", "🐍", "👽", "🦇", "💀", "💔", "💖", "💋", "💘", "💓",
  "💕", "💞", "💪", "📚", "📝", "🍽️", "🍛", "🥡", "🥘",
  "🥜", "🍿", "🧃", "🧉", "🥤", "🍦", "🍧", "🍨", "🍩",
  "🍪", "🍰", "🎂", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯",
  "🥛", "🍞", "🥖", "🥨", "🧆", "🥘", "🍲", "🍜", "🍝",
  "🍠", "🥡", "🦞", "🦀", "🦐", "🦑", "🥓", "🥘", "🍛",
  "🍜", "🍲", "🍥", "🍡", "🍘", "🍙", "🍚", "🍛", "🍟",
  "🍕", "🍖", "🍗", "🥩", "🥓", "🍗", "🥟", "🥠", "🥡",
  "🍱", "🍘", "🍙", "🍚", "🍋", "🍊", "🍌", "🍉", "🍇",
  "🍓", "🥝", "🍈", "🍑", "🍒", "🥑", "🍆", "🥔", "🥕",
  "🌽", "🌶️", "🌽", "🥑", "🥬", "🥦", "🥒", "🥬", "🥬"
];

// Campus list for Ghana universities
const campuses = [
  "University of Ghana", "KNUST", "UCC", "UPSA", "GCTU", "UEW"
];

// Types of posts
const postTypes = ["confession", "gossip", "meme"];

// Hashtag groups for different campuses and topics
const hashtags = {
  "love": ["#love", "#relationships"],
  "legon": ["#LegonLove", "#LegonGist", "#CampusCouple", "#LegonCrush"],
  "knust": ["#KNUSTLove", "#KNUSTGist", "#KNUSTCouple", "#KNUSTCrush"],
  "ucc": ["#UCCLove", "#UCCGist", "#UCCCrush", "#UCCBestCouple"],
  "upsa": ["#UPSALove", "#UPSAGist", "#UPSACrush", "#UPSARealities"],
  "gctu": ["#GCTULove", "#GCTUGist", "#GCTUCrush", "#GCTURealities"],
  "uew": ["#UEWLove", "#UEWGist", "#UEWCrush", "#UEWRealities"],
  "gpa": ["#GPALove", "#GPAHelp", "#GPAKiller", "#CoupleGoalsVsGPA"],
  "hostel": ["#HostelLove", "#HostelScam", "#HostelWayo", "#HostelLife"],
  "sexforgrades": ["#SexForGrades", "#EndSexForGrades", "#CultureOfSilence"],
  "safety": ["#safety", "#GhanaUni", "#RoadSafety", "#HostelSafety"],
  "wifi": ["#WiFiFail", "#PortalWahala", "#GhanaUniWiFi"],
  "fees": ["#FeesWahala", "#HiddenFees", "#SRCLevy", "#UGFees"],
  "attendance": ["#AttendanceWahala", "#SignForMe"],
  "tiktok": ["#TikTokOverBooks", "#LibraryGist"],
  "purewater": ["#PureWaterCEO", "#GhanaHustle", "#CampusHustle"],
  "hallgossip": ["#HallGossip", "#WhoDeySleepWithWho"],
  "bbcexposed": ["#BBCExposed", "#BBCAftermath", "#JusticeFailed"],
  "exams": ["#ExamWeek", "#630AMTorture", "#LegonWahala"],
  "textbooks": ["#TextbookMafia", "#GCTUGist"],
  "scholarship": ["#NSFAS", "#Scholarship"]
};

// Random delay function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate random text length between min and max
function randomLength(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate a random comment from a girl's perspective
function generateGirlComment(commentsPool) {
  const commentCount = Math.floor(Math.random() * 5) + 2; // 2-6 comments per post
  const comments = [];
  
  const commentTexts = [
    "Aww this be sweet pass shito and jollof 🥰",
    "You go make am both! GPA and love fit walk together 💯",
    "Protect her like your GPA! She be your A+ ❤️",
    "Aww give am hug for us! This be wholesome paaa 🥰",
    "Chale aww 🥰 this be sweet pass shito and jollof",
    "Chale why you dey lie like this 🤣",
    "If you want pass go office alone you dey find am yourself",
    "Sending love from KNUST 💛 no let that man steal your peace",
    "Lock am for cells make he rot! Lecturers like this dey spoil Ghana uni name",
    "Chale you be mumu, you dey cook for babe wey dey chop another guy? wake up!",
    "You be strong walahi, 3 weeks floor sleeping but you keep your dignity 🙏",
    "My senior talk same for Legon PoliSci, e be pattern for that dept",
    "Hall tutor sef dey do? Gib am immediate sack, bed mafia too much",
    "Freshers make una shine eye wai, no trust random hostel agent or party invite quick",
    "Eii Ghana unis need external audit for real, BBC for come back 2026",
    "If dem catch am for my side I go beat am myself 😤 predator dey use grade take advantage",
    "Victim blame crew shut up abeg 💀 so if man married plus power e for control himself not girl fault",
    "True talk, I dey share this for my course group now. Safety first wai 💙",
    "Sister you be precious wai, no relationship worth your life. Waka if e turn toxic 💜 we dey here",
    "Chale you no dey alone, we all dey anxious. Abeg DM if you need talk 💜",
    "May their souls rest well 🕊️ we for look out for each other fr",
    "Herh this gist heavy o, Yard be our only safe space to talk this",
    "Some girls dey lie sef to spoil lecturer name after them fail, check facts first 🤔",
    "Eiii blame victim again? So dress code justify harassment? Bring sense 😒",
    "Sack am, blacklist am, he no for teach again! How married man dey do this??",
    "Not every girl dey seduce lecturer kraa 🤬 some dey just try pass legit and man exploit",
    "You no be ashawo, you be survivor 💪 victim blame people no know nada, we stand with you",
    "Eiii these lecturers deserve public disgrace, post ein face make we know am",
    "Pray go change TA? Pray go change TA? Pray go change TA?",
    "If you need to report anon we fit help you draft message, you no dey alone kraa 😔",
    "Herh this post make I call my sis for UCC right now, thanks wai 🥺",
    "Chale that lecturer need wife counseling not students 😭 6:30am be abuse",
    "Give me GPA over couple goals any day 😍",
    "Love no dey pay fees",
    "Kente GPA be art",
    "Ei beef go start for comment section gyee",
    "We share popcorn for resit",
    "4.0 couple be aliens 🙄",
    "We no be ashawo, you be survivor 💪 we dey believe you, you go pass that course legit",
    "Hall body count plus menu for free",
    "Chale why you dey lie like this 🙄",
    "Answer present pass learning",
    "Ghost students don register 🙄",
    "45mins for names 10mins lecture 😭",
    "Answer present pass learning",
    "We for protest but SRC dey chop with management",
    "Foundation for 3 years be legacy project 😂",
    "11:59 due 12:01 WiFi come",
    "Portal load till deadline pass",
    "WiFi only work when e no be important, Juju be that",
    "Herh this gist heavy o, Yard be our only safe space to talk this",
    "Chale I pay 2k for Limann last year, the guy block me after momo. Perching for 3 weeks before I get refund 😭",
    "SRC gossip page posted list of fake numbers, check their IG @knust_src. More than 30 numbers blocked already",
    "Same people go resurface next year with new number, same format. Ebi business for them herh",
    "My landlord add 'maintenance fee' GH¢700, maintenance wey e never do since 2023. Pure wayo",
    "Next sem we go sleep for lecture hall be that 😭 Chale price control no dey for private hostels?",
    "2 years advance be wickedness, who dey get that money for Ghana?",
    "Private hostel be the real fees, school fees be small pimple",
    "Chale I no gree for that protocol, na scam pure water",
    "No receipt no payment, simple!",
    "If dem ask for momo before receipt, na scam. No receipt no payment!",
    "Chale agent take my 300 last year same trick, till now I dey perch for senior ein floor 😭 Never again",
    "Hostel mafia is real. They buy 6 beds with IDs then resell 💀 ebi business",
    "2 years advance be wickedness, who get that money for Ghana?",
    "Eii freshers make una open eye ooo 😭 Telegram group dey sell Hilla Limann bed for GH¢2500, single room self dem dey call GH¢4000",
    "Official school fee be like 1300 but these boys dey do protocol plus 'emergency allocation' 😂",
    "Pay now or you go perch for common room",
    "SRC don drop warning ooo!! Freshers intake Sept 2026 make una beware 😭 Those WhatsApp groups wey dey talk 'Admission assistance + guaranteed hostel GH¢500' na scam 💀",
    "One guy for my SHS group collect GH¢800 from 12 people then comot",
    "Official KNUST no dey do admission for WhatsApp, everything be portal only! Abeg share make e reach your junior",
    "Eii the UCC portal don mad 😭😭 How you go allocate level 100 boys go Adehye Hall girls block and then post girls go Atlantic Hall boys wing as roommates??",
    "Management say 'system glitch please be patient' but chale this glitch fit cause serious wahala o",
    "Private hostel price wars for KNUST/Bomso-Ayeduase side e be wildin rn 😭 Last sem hostel for GH¢3500, this sem same room GH¢6200 + GH¢500 protocol fee + GH¢300 agent viewing fee ???",
    "Mom and dad dey cry. Landlords dey compete who go charge highest but rooms still be 4x4 cubicle with leaking roof",
    "Yooo UPSA freshers make una hear gist 😭😭 There be this popular hostel agent for Madina/Okponglo wey dey charge GH¢200 just to SHOW you room, then after viewing e say 'pay GH¢450 protocol to secure am' then e vanish!",
    "My roommate sent momo 650 total, number switched off",
    "Legit agents no dey take money before keys, abeg don't pay any protocol unless for hostel OFFICE",
    "Yooo UPSA freshers hear gist 😭 Madina/Okponglo agent dey charge GH¢200 just to SHOW room, then after viewing e say 'pay GH¢450 protocol to secure am' then vanish! Roomie send momo GH¢650 total, number off",
    "No receipt no pay! #UPSA #MadinaHostels #HostelScamAlert #FreshersGuide",
    "Ei UMaT campus small like SHS 😭 If you date one person, you date whole Tarkwa",
    "My ex dey see my new babe for same bench outside UMAT auditorium everyday, awkward pass exam",
    "Chale UMaT love be circle #UMaT #Tarkwa #SmallCampus #RelationshipCircle",
    "Herh Legon freshers make una open eye ooo 😭 Telegram group dey sell Hilla Limann bed GH¢2500, single room GH¢4000",
    "Official be 1300 but boys dey do 'protocol + emergency allocation' 😂",
    "Dem say 'pay now or you go perch common room'. Wayo too much #UGHostelScam #HillaLimann #LegonGist #Wayo",
    "Chale KNUST SRC don drop warning ooo!! Freshers Sept 2026 make una beware 😭 Those WhatsApp groups wey dey talk 'Admission assistance + guaranteed hostel GH¢500' na scam 💀",
    "One guy collect GH¢800 from 12 people then comot. Official KNUST no dey do admission for WhatsApp, portal only!",
    "Eii the UCC portal don mad 😭 How you go allocate level 100 boys go Adehye Hall girls block and then post girls go Atlantic Hall boys wing as roommates??",
    "Screenshot dey go viral for status. Management say 'system glitch please be patient' but glitch fit cause wahala",
    "Private hostel price wars for Bomso-Ayeduase e be wildin 😭 Last sem GH¢3500, this sem same 4x4 cubicle GH¢6200 + GH¢500 protocol + GH¢300 viewing fee ???",
    "Mom and dad dey cry. Leaking roof still dey. How student go survive for Ghana?",
    "UPSA Madina Hostel canteen queue be where gossip dey cook pass food 😍 45mins you go hear who fail who, who chop who. Free gist with hunger",
    "Ei UEW couple for Simpa Hall dey host couple prayer every night but GPA dey need prayer pass 😍 6:30am dem dey cuddle, lecture hall dem dey snore",
    "Legon group project na one person dey suffer 🙄 Leader do research, slides, present, others dey share story for status 'group work done'",
    "GCTU canteen queue be 45mins for indomie wey rice finish only gari dey 🙄 You join line fresh comot old",
    "KNUST canteen queue be 45mins for jollof wey water no hot 😒 You join line fresh comot old",
    "UCC hustle be different, guy dey sell bofrot in suit and tie for lecture hall entrance 😭 He say 'dress for success'. Hustle get fashion",
    "UPSA WiFi be scam 😭 It dey work 2am when nobody need am, 10am when you wan submit assignment e go vanish like ghost",
    "GCTU WiFi for Tesano Block be legend - everybody connect, nobody browse 💀 You fit watch buffering wheel spin for 45mins",
    "Legon 7am lecture be military camp ooo 🤣 Lecturer lock door 7:01 prompt, if you knock e go ignore you like debt collector",
    "UEW 6:30am lecture be wahala 😒 Shout dey give everybody 'WHY YOU LATE'",
    "Trek from Tesano Block to GCTU for 6:30am be marathon 💀 Reach class sweaty lecturer say 'why you dey sweat?'",
    "KNUST canteen queue be 45mins for gari wey water no hot 😒 You join line fresh comot old. Boiler light off, stew finish but queue still dey move like pilgrimage",
    "6:30am lecture for KNUST🥲 Herrh lecturer enter class like ein wife beat am for dawn 😂 Shout dey give everybody 'WHY YOU LATE'",
    "Chale KNUST pure water CEO wey dey hawk in full corporate attire with tie and shiny shoe😂",
    "Boss viral for LinkedIn, TikTok and lecturer WhatsApp group same day! Hustle be real paa!",
    "6:30am lecture for Legon😒 Herrh lecturer enter class like ein wife beat am for dawn 🤣",
    "Chale UEW WiFi for Elm Hall be legend - everybody connect, nobody browse 💀 You fit watch buffering wheel spin for 45mins",
    "UEW Simpa Hall gist too loud chill 🙄 Midnight you dey try sleep then next room dey host bedroom conference",
    "UEW block gist hot pass jollof 😂 Guy catch ein paddie ein babe comot another guy room 2am dey defend say 'we dey do group assignment'",
    "UEW Simpa Hall gist too loud chill 🤣 Midnight you dey try sleep then next room dey host bedroom conference, morning you hear 'so na you dey date hall secretary AND SRC babe?'",
    "UEW WiFi for Elm Hall be legend - everybody connect, nobody browse 💀 You fit watch buffering wheel spin for 45mins. Assignment due 11:59pm, WiFi go come 12:01am",
    "Eii that KNUST pure water CEO wey dey hawk in full corporate attire with tie and shiny shoe🙄 😒",
    "Boss viral for LinkedIn, TikTok and lecturer WhatsApp group same day! Hustle be real paa!",
    "Herh KNUST ladies abeg no be weak to report o 😭 That violent ex gist for Bomso, girl report late sake shame",
    "If person dey monitor your phone, isolate you from friends, na red flag o. Abeg no ignore signs",
    "Eii we lost bright students to relationship violence herrh 😔 Since 2024 we hear like 2-3 cases across unis",
    "Each be someone daughter/son. Abeg if you see friend dey isolate, bruises dey, ask gently wai",
    "KNUST ladies abeg hear this wai 😭 Ayeduase - Kotei road after 7pm dark like cave, no light, okada dey speed",
    "Heard girls get harassed/robbed for Tech Junction late. Abeg no waka alone, use campus shuttle or share bolt wai",
    "Chale Kotei - Ayeduase landlords for KNUST make dem provide street light naa 😤 Students dey pay 6k but road dark, girls dey fear go buy food for night",
    "That late night warning no be joke, e be daily reality",
    "Eii Tech Junction - Bruno area for KNUST e scary for night herrh 😔 My roomie dey Ayeduase, she say after 8pm she no dey waka alone again",
    "Guys for station there dey harass plus phone snatching plenty. Abeg ladies pin location to roomie",
    "Chale who go fix Ayeduase lights? 😤 KNUST SRC promise last sem but still dark. Girls dey trek with phone torch",
    "System dey fail but we for protect ourselves till then - whistle, pepper spray in bag?",
    "Eii my little sis get admission for KNUST, I dey advice am about Kotei/Ayeduase night movement 😔",
    "I tell am make she get hostel inside campus first year even if small. Safety pass fine hostel outside wai",
    "Herrh KNUST security post for Tech Junction dey far from Ayeduase hostels 😤 If something happen, help far",
    "Girls dey beg for more patrols + lights. Till then abeg after 7pm no solo movement wai",
    "Eii Tech Junction phone snatching for KNUST e too much 😭 Girl lose phone + bag after 8:30pm while coming from Ayeduase",
    "Area boys dey target lonely girls. Abeg no hold phone for hand waka night wai",
    "Chale KNUST queens, make we create buddy system wai 🙏 If you dey Kotei/Ayeduase, pair with roomie, share live location",
    "That Tech Junction warning e save life. No be paranoia, be sense",
    "Chale who go fix Ayeduase lights? 😤 KNUST SRC promise last sem but still dark. Girls dey trek with phone torch",
    "System dey fail but we for protect ourselves till then - whistle, pepper spray in bag?",
    "UG Legon gist too 😔 That relationship wey turn stalking then threats for hall. Campus no be prison, nobody for fear for ein room",
    "If ex dey trail you, report to hall tutor/security sharp #safety #UG #LegonGist #Stalking",
    "Chale Ghana uni relationship pressure dey too much 🥺 Hookup + jealousy + exam stress mix bad",
    "That KNUST killing gist remind me say we for teach consent and anger management for orientation",
    "Eii we lost bright students to relationship violence herrh 😔 Since 2024 we hear like 2-3 cases across unis",
    "Each be someone daughter/son. Abeg if you see friend dey isolate, bruises dey, ask gently wai",
    "KNUST ladies abeg no be weak to report o 😭 That violent ex gist for Bomso, girl report late sake shame",
    "Campus security and DoS dey there for that. Better shame small than story wey we no want hear",
    "Confession: My friend dey abusive relationship for UCC but she dey hide am 😔 She say he love am thats why he vex",
    "Chale after that KNUST incident wey circulate, I tell am make she leave. Abeg we need to help wai",
    "UG Legon gist too 😔 That relationship wey turn stalking then threats for hall. Campus no be prison, nobody for fear for ein room",
    "If ex dey trail you, report to hall tutor/security sharp",
    "Chale Ghana uni relationship pressure dey too much 🥺 Hookup + jealousy + exam stress mix bad",
    "That KNUST killing gist remind me say we for teach consent and anger management for orientation",
    "Eii we lost bright students to relationship violence herrh 😔 Since 2024 we hear like 2-3 cases across unis",
    "Each be someone daughter/son. Abeg if you see friend dey isolate, bruises dey, ask gently wai",
    "KNUST ladies abeg no be weak to report o 😭 That violent ex gist for Bomso, girl report late sake shame",
    "Campus security and DoS dey there for that. Better shame small than story wey we no want hear",
    "Confession: My friend dey abusive relationship for UCC but she dey hide am 😔 She say he love am thats why he vex",
    "Chale after that KNUST incident wey circulate, I tell am make she leave. Abeg we need to help wai",
    // More comment texts...
  ];
  
  // Select random comments
  for (let i = 0; i < commentCount; i++) {
    const randomIdx = Math.floor(Math.random() * commentTexts.length);
    comments.push({
      ghostId: ghostIds[Math.floor(Math.random() * ghostIds.length)],
      avatarEmoji: avatarEmojis[Math.floor(Math.random() * avatarEmojis.length)],
      text: commentTexts[randomIdx]
    });
  }
  
  return comments;
}

// Generate a random post from a girl's perspective
function generateGirlPost(index, campus) {
  const type = postTypes[Math.floor(Math.random() * postTypes.length)];
  
  // Generate post text based on type and campus
  let text;
  let hashtags;
  
  switch (type) {
    case "confession":
      // Relationship/confession posts
      const confessionTopics = [
        "My Legon babe dey cook for me every Sunday after church. Light soup, ampesi, plus extra meat sey make I get strength for week lectures",
        "My guy dey wake 5am go queue for Bush Canteen make e buy waakye + zomi before my 8am class. He no dey complain, he say 'your smile be my breakfast'",
        "My coursemate and ein babe dey study together for Sam Jonah Library 7pm to 11pm everyday. She help am move from GPA 2.1 to 3.4!",
        "My roomie ein boyfriend pay ein hostel part payment 1200 cedis say make she no perch. She cry for 10mins. He hug am say 'we go learn together'",
        "That level 300 couple wey dey match white polo for campus everyday? Them dey do past questions together for night class and them both get 3.8 last sem!",
        "I be shy girl, I no dey talk for class. My crush from Political Science just dey help me with presentations, hype me say 'you go make am'",
        "My guy fail one course last year, ein babe no leave am. She dey wake am 4am for morning revisions, share ein notes",
        "My babe carry my dirty clothes go wash for weekend sey make I focus for mid-sem exam. She iron am sef! I cook jollof for am next day as thank you",
        "My crush from ECON 101 wey dey always borrow me pen? Today he buy me sobolo plus meatpie before lecture say 'you look tired'",
        "That fine boy for my Faculty wey dey lead group discussion. She intelligent plus fine pass! She today help me solve 5 years past questions",
        "That level 200 guy wey dey play guitar for hall week? He sing for my babe birthday for balcony, whole hall clap!",
        "My roomie ein boyfriend pay ein hostel part payment 1200 cedis say make she no perch. She cry for 10mins. He hug am say 'we go learn together'",
        "My coursemate and ein babe dey study together for Sam Jonah Library 7pm to 11pm everyday",
        "My babe and I decide say no outing if we no finish 2 past questions. Now we dey get A for stats!",
        "My guy dey fetch water for me 6am before class when Legon water dey go off. He carry two buckets for head like woman",
        "My neighbour ein boyfriend fix ein leaking roof with 200 cedis from ein savings. She no ask am sef!",
        "That couple for Conti wey dey jog together 5:30am everyday for Paa Joe stadium? Them dey motivate whole hostel to dey exercise",
        "My guy and I contribute 50 cedis each every month for hostel water + light. No argument, just teamwork",
        "That couple for Oguaa Hall wey dey clean room together every Saturday morning before going for lectures?",
        "My guy dey fetch water for me 6am before class when Legon water dey go off",
        "That couple wey dey wash together for hostel, fetch water together 5am for Kwaprow when water dey scarce?",
        "My roomie ein boyfriend bring gas cylinder from home for them because hostel hotplate dey spoil every week",
        "My babe ein boyfriend learn how to cook gari foto just because ein babe dey crave am for night",
        "My boyfriend organize picnic for me with 20 cedis - sobolo, bread, choco and Bluetooth speaker",
        "My boyfriend dey do late night accounting revision with me for hostel even though he be marketing student",
        "My babe ein boyfriend buy me FanIce after 4 hours lab stress. I think I don fall chale 😂❤️",
        "My lab partner wey dey wash apparatus for me when I dey late? He never complain. Today he buy me FanIce after 4 hours lab stress",
        "My guy learn how to cook gari foto just because ein babe dey crave am for night",
        "My boyfriend organise picnic for me with 20 cedis - sobolo, bread, choco and Bluetooth speaker",
        "My guy dey fetch water for me 6am before class when Legon water dey go off. He carry two buckets for head like woman",
        // Add more confession topics
      ];
      
      text = confessionTopics[Math.floor(Math.random() * confessionTopics.length)];
      hashtags = [
        "#love", "#relationships",
        `#${campus.toLowerCase()}Love`,
        "#CampusCouple", "#StudyCouple"
      ];
      break;
      
    case "gossip":
      // Gossip/everyday life posts
      const gossipTopics = [
        "UEW Simpa Hall gist too loud chill 🙄 Midnight you dey try sleep then next room dey host bedroom conference, morning you hear 'so na you dey date hall secretary AND SRC babe?'",
        "KNUST Engineering couple dey walk hand-in-hand to exam hall both carry 4.0 😍 Me plus my babe we dey carry 2.1 together dey share popcorn for resit class",
        "UPSA Madina Hostel gist too loud chill 🥲 Midnight you dey try sleep then next room dey host bedroom conference, morning you hear 'so na you dey date hall secretary AND SRC babe?'",
        "GCTU group project na one person dey suffer 🤣 Leader do research, slides, present, others dey share story for status 'group work done'",
        "UEW Simpa Hall canteen queue be where gossip dey cook pass food 😂 45mins you go hear who fail who, who chop who",
        "KNUST canteen queue be 45mins for gari wey water no hot 😒 You join line fresh comot old. Boiler light off, stew finish but queue still dey move like pilgrimage",
        "6:30am lecture for KNUST🥲 Herrh lecturer enter class like ein wife beat am for dawn 😂 Shout dey give everybody 'WHY YOU LATE'",
        "Trek from Tesano Block to GCTU for 6:30am be marathon 💀 Reach class sweaty lecturer say 'why you dey sweat?'",
        "KNUST canteen queue be 45mins for jollof wey water no hot 😒 You join line fresh comot old. Boiler light off, stew finish but queue still dey move like pilgrimage",
        "UCC hustle be different, guy dey sell bofrot in suit and tie for lecture hall entrance 😭 He say 'dress for success'. Hustle get fashion",
        "UPSA WiFi be scam 😭 It dey work 2am when nobody need am, 10am when you wan submit assignment e go vanish like ghost",
        "GCTU WiFi for Tesano Block be legend - everybody connect, nobody browse 💀 You fit watch buffering wheel spin for 45mins",
        "Legon 7am lecture be military camp ooo 🤣 Lecturer lock door 7:01 prompt, if you knock e go ignore you like debt collector",
        "UEW 6:30am lecture be wahala 😒 Shout dey give everybody 'WHY YOU LATE' chale we self we never sleep, we dey battle trotro since 5am",
        "GCTU WiFi be scam 😭 It dey work 2am when nobody need am, 10am when you wan submit assignment e go vanish like ghost",
        "Herh chale this UEW couple for Simpa Hall dey host couple prayer every night but GPA dey need prayer pass 😍",
        "UCC next-best-couple wey dey match outfit everyday for canteen 😒 My GPA dey match like kente - D for here, F for there",
        "Legon group project na one person dey suffer 🙄 Leader do research, slides, present, others dey share story for status 'group work done'",
        "GCTU canteen queue be 45mins for indomie wey rice finish only gari dey 🙄 You join line fresh comot old",
        "KNUST group assignment 6 people, 4 ghost members 💀 Meeting fix 7am nobody show, deadline midnight everybody dey online",
        "UCC library no be library again, na TikTok headquarters 😂 Assignment due midnight but auntie for aisle 3 dey do tap tap challenge",
        "UEW library no be library again, na TikTok headquarters 😒 Assignment due midnight but auntie for aisle 3 dey do tap tap challenge",
        "Legon library no be library again, na TikTok headquarters 🥲 Assignment due midnight but auntie for aisle 3 dey do tap tap challenge",
        "UPSA canteen queue long pass graduation line 😒 45mins for jollof wey taste like plain rice, plus dem say 'no takeaway pack'",
        "UMaT lab practical be reality show 😂 Equipment broken since 2019, lecturer say 'improvise'. We dey titrate with water bottle",
        "UEW teaching practice posting be punishment 😭 Dem post you go village near Winneba no light, no network, but attendance compulsory everyday 7am",
        "UG fees increment mad 😭 30% up plus residential GH¢4000 for traditional hall. Parents dey call dey cry 'how we go pay?'",
        "Bomso hostel from 4k to 6.5k in one year, plus they want 2 years advance herrh 😭 Who get that money??",
        "UCC school fees deadline be trap 😭 Portal charge late payment GH¢500 penalty wicked. My fees delay 2 days sake momo network",
        "UPSA fees plus SRC dues GH¢350 + dept dues GH¢200 + faculty GH¢150 total dey pass tuition itself 😭 Every level new fee appear 'development levy'",
        "GCTU fees GH¢7000 but WiFi no dey work, lab computers be Windows 7 dey freeze 😭 Ebe like we pay for AirtelTigo hotspot",
        "Chale UEW fees increment plus feeding money plus trotro fare double from GH¢4 to GH¢8 Winneba town to campus 😭",
        "UMaT fees small but hostel price for Tarkwa dey kill mining students 😭 Single room GH¢5000 plus you for buy water GH¢30 per barrel",
        "KNUST SRC elections vote buying mad 😭 GH¢50 + jollof + shito + Malta dey share for polling station",
        "UG SRC week artist no show again 😭 Dem take GH¢200k pay artist, artist no come, SRC say 'unforeseen circumstances'",
        "UCC SRC dues GH¢200 we pay every year, accountability zero 😭 No project, no report. SRC car dey move but hostel light off",
        "UPSA SRC promise hostel building 3 years ago, still foundation 😭 Every manifesto same 'hostel facility for students'",
        "GCTU SRC election beef hall vs hall insults for Yard 😂 Tesano vs Ashanti hall dey throw shades",
        // Add more gossip topics
      ];
      
      text = gossipTopics[Math.floor(Math.random() * gossipTopics.length)];
      hashtags = [
        `#${campus.toLowerCase()}Gist`,
        "#GhanaUniGist",
        "#CampusGist",
        "#UniversityGist"
      ];
      break;
      
    case "meme":
      // Meme posts
      const memeTopics = [
        "Ei UMaT campus small like SHS 😭 If you date one person, you date whole Tarkwa. My ex dey see my new babe for same bench outside UMAT auditorium everyday",
        "Herh Legon freshers make una open eye ooo 😭 Telegram group dey sell Hilla Limann bed GH¢2500, single room GH¢4000. Official be 1300 but boys dey do 'protocol + emergency allocation'",
        "Private hostel price wars for KNUST/Bomso-Ayeduase e be wildin 😭 Last sem hostel for GH¢3500, this sem same room GH¢6200 + GH¢500 protocol fee + GH¢300 agent viewing fee ???",
        "Yooo UPSA freshers make una hear gist 😭😭 There be this popular hostel agent for Madina/Okponglo wey dey charge GH¢200 just to SHOW you room",
        "Eii the UCC portal don mad 😭😭 How you go allocate level 100 boys go Adehye Hall girls block and then post girls go Atlantic Hall boys wing as roommates??",
        "Private hostel price wars for Bomso-Ayeduase e be wildin 😭 Last sem GH¢3500, this sem same 4x4 cubicle GH¢6200 + GH¢500 protocol + GH¢300 viewing fee ???",
        "Yooo UPSA freshers hear gist 😭 Madina/Okponglo agent dey charge GH¢200 just to SHOW room, then after viewing e say 'pay GH¢450 protocol to secure am' then vanish!",
        "Ei UMaT campus small like SHS 😭 If you date one person, you date whole Tarkwa. My ex dey see my new babe for same bench outside UMAT auditorium everyday",
        "Herh Legon freshers make una open eye ooo 😭 Telegram group dey sell Hilla Limann bed GH¢2500, single room GH¢4000. Official be 1300 but boys dey do 'protocol + emergency allocation'",
        "Chale KNUST SRC don drop warning ooo!! Freshers Sept 2026 make una beware 😭 Those WhatsApp groups wey dey talk 'Admission assistance + guaranteed hostel GH¢500' na scam 💀",
        "Eii the UCC portal don mad 😭 How you go allocate level 100 boys go Adehye Hall girls block and then post girls go Atlantic Hall boys wing as roommates??",
        "Private hostel price wars for Bomso-Ayeduase e be wildin 😭 Last sem GH¢3500, this sem same 4x4 cubicle GH¢6200 + GH¢500 protocol + GH¢300 viewing fee ???",
        "Yooo UPSA freshers hear gist 😭 Madina/Okponglo agent dey charge GH¢200 just to SHOW room, then after viewing e say 'pay GH¢450 protocol to secure am' then vanish!",
        "Ei UMaT campus small like SHS 😭 If you date one person, you date whole Tarkwa. My ex dey see my new babe for same bench outside UMAT auditorium everyday",
        "Herh Legon freshers make una open eye ooo 😭 Telegram group dey sell Hilla Limann bed GH¢2500, single room GH¢4000. Official be 1300 but boys dey do 'protocol + emergency allocation'",
        "Chale KNUST SRC don drop warning ooo!! Freshers Sept 2026 make una beware 😭 Those WhatsApp groups wey dey talk 'Admission assistance + guaranteed hostel GH¢500' na scam 💀",
        // Add more meme topics
      ];
      
      text = memeTopics[Math.floor(Math.random() * memeTopics.length)];
      hashtags = [
        "#GhanaUniGist",
        "#CampusGist",
        "#UniversityGist",
        "#Funny"
      ];
      break;
  }
  
  // Add campus and type specific hashtags
  const campusHashtags = hashtags[campus.toLowerCase()] || [];
  const typeHashtags = hashtags[type] || [];
  const allHashtags = [...campusHashtags, ...typeHashtags].slice(0, Math.floor(Math.random() * 4) + 3); // 3-6 hashtags
  
  // Generate comments
  const comments = generateGirlComment();
  
  return {
    id: `post_${Date.now()}_${index}`,
    text,
    type,
    campus,
    hashtags: allHashtags,
    comments,
    boosted: Math.random() > 0.7, // 30% boosted
    boostedUntil: Math.random() > 0.7 ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
    yeahs: Math.floor(Math.random() * 500) + 10 // 10-600 yeahs
  };
}

// Generate all posts
function generateAllPosts() {
  const posts = [];
  const totalPosts = 1500;
  
  // Distribute posts across campuses
  const campusDistribution = {
    "University of Ghana": Math.floor(totalPosts * 0.3),
    "KNUST": Math.floor(totalPosts * 0.25),
    "UCC": Math.floor(totalPosts * 0.2),
    "UPSA": Math.floor(totalPosts * 0.1),
    "GCTU": Math.floor(totalPosts * 0.1),
    "UEW": Math.floor(totalPosts * 0.05)
  };
  
  let postIndex = 0;
  
  for (const [campus, count] of Object.entries(campusDistribution)) {
    for (let i = 0; i < count; i++) {
      const post = generateAllPostsIndex(postIndex, campus);
      posts.push(post);
      postIndex++;
    }
  }
  
  // Shuffle posts
  for (let i = posts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [posts[i], posts[j]] = [posts[j], posts[i]];
  }
  
  return posts;
}

// Generate a single post at index
function generateAllPostsIndex(index, campus) {
  const type = postTypes[Math.floor(Math.random() * postTypes.length)];
  const post = generateGirlPost(index, campus);
  post.id = `post_${index}`;
  return post;
}

// Write posts to file
function writePostsToFile(posts, filename) {
  const data = posts.map(post => ({
    id: post.id,
    text: post.text,
    type: post.type,
    campus: post.campus,
    hashtags: post.hashtags,
    comments: post.comments,
    boosted: post.boosted,
    boostedUntil: post.boostedUntil,
    yeahs: post.yeahs
  }));
  
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`Written ${posts.length} posts to ${filename}`);
}

// Main execution
try {
  console.log('Starting post generation...');
  const posts = generateAllPosts();
  console.log(`Generated ${posts.length} posts`);
  
  writePostsToFile(posts, 'generated-posts.json');
  console.log('Post generation complete!');
} catch (error) {
  console.error('Error during post generation:', error);
  process.exit(1);
}