import json, random, re, os

random.seed(42)

GHOSTS = [
    {"ghostId": "QuietStorm_22", "avatarEmoji": "🐍"},
    {"ghostId": "CampusWhisperer", "avatarEmoji": "👽"},
    {"ghostId": "MidnightScholar", "avatarEmoji": "👻"},
    {"ghostId": "HallwayGhost", "avatarEmoji": "👻"},
    {"ghostId": "TheRealTalker", "avatarEmoji": "🧙"},
    {"ghostId": "SilentObserver", "avatarEmoji": "🦇"},
    {"ghostId": "NightOwlNotes", "avatarEmoji": "👻"},
    {"ghostId": "LibraryLurker", "avatarEmoji": "🕷️"},
    {"ghostId": "DailyConfessor", "avatarEmoji": "😂"},
    {"ghostId": "CanteenCritic", "avatarEmoji": "👻"},
    {"ghostId": "DriftStorm_9394", "avatarEmoji": "👻"},
    {"ghostId": "LegonSleeper", "avatarEmoji": "😴"},
    {"ghostId": "AyeduaseHustler", "avatarEmoji": "😎"},
    {"ghostId": "KwaprowVibes", "avatarEmoji": "👑"},
    {"ghostId": "TadiBoy", "avatarEmoji": "🤙"},
    {"ghostId": "GCTU_Sniper", "avatarEmoji": "👀"},
]

# 80 posts defined with theme, campus, type, text
posts_raw = [
    # 1-7 Relationships
    {"theme": "relationships", "campus": "University of Ghana", "type": "gossip", "text": "Chale UG Legon gist mad ooo 😭 Level 300 babe catch ein boyfriend plus ein roommate for Commonwealth Hall balcony 2am, she dey livestream dey cry 'I pay your fees you dey chop my friend??' Herh boys no dey loyal again 💔 #UG #LegonGist #RelationshipWahala #Commonwealth"},
    {"theme": "relationships", "campus": "KNUST", "type": "confession", "text": "Herh Kwaprow cohabitation go kill me 😭 Move to Ayeduase go cohabit with babe, now I dey cook, wash, clean plus carry 1.9 GPA. She say 'we be couple' but my result dey cry. Chale how for do? #KNUST #Cohabitation #Ayeduase #GPAKiller"},
    {"theme": "relationships", "campus": "UCC", "type": "gossip", "text": "Ei UCC Kwaprow babe get Odogwu plus 2 Zaddies dey pay fees, hostel, hair 😭 She say 'sugar no be hookup, na networking' Herh degree no be the only hustle for Cape Coast. Chale networking or net-worthing? #UCC #Kwaprow #Networking #GhanaGist"},
    {"theme": "relationships", "campus": "UEW", "type": "gossip", "text": "Ei UEW relationship pressure mad ooo 😭 Guy threaten he go drink sniper sake babe block am, whole Winneba hostel no sleep 3am dey beg am. Chale love no be death sentence, if e no work waka! We need counseling #UEW #RelationshipPressure #Winneba"},
    {"theme": "relationships", "campus": "UPSA", "type": "confession", "text": "Chale UPSA girls get business mind pass MBA 😂 Level 100 babe get Odogwu dey pay Madina hostel GH¢6500, another Zaddy dey pay fees. She dey call am 'sponsorship package'. Herh we dey suffer for love #UPSA #MadinaHostels #Sponsorship #Level100"},
    {"theme": "relationships", "campus": "GCTU", "type": "gossip", "text": "My guy move from GCTU Tesano go cohabit Ayeduase-Kotei side, now he be houseboy 😂 Dey cook jollof 6am before class, babe still dey cheat for Galloway. Herh men dey suffer for love ooo #GCTU #Ayeduase #Kotei #CohabitationGist"},
    {"theme": "relationships", "campus": "UMaT", "type": "meme", "text": "Ei UMaT campus small like SHS 😭 If you date one person, you date whole Tarkwa. My ex dey see my new babe for same bench outside UMAT auditorium everyday, awkward pass exam. Chale UMaT love be circle #UMaT #Tarkwa #SmallCampus #RelationshipCircle"},
    # 8-14 Hostel scams
    {"theme": "hostel", "campus": "University of Ghana", "type": "gossip", "text": "Herh Legon freshers make una open eye ooo 😭 Telegram group dey sell Hilla Limann bed GH¢2500, single room GH¢4000. Official be 1300 but boys dey do 'protocol + emergency allocation' 😂 Dem say 'pay now or you go perch common room'. Wayo too much #UGHostelScam #HillaLimann #LegonGist #Wayo"},
    {"theme": "hostel", "campus": "KNUST", "type": "gossip", "text": "Private hostel price wars for Bomso-Ayeduase e be wildin 😭 Last sem GH¢3500, this sem same 4x4 cubicle GH¢6200 + GH¢500 protocol + GH¢300 viewing fee ??? Mom and dad dey cry. Leaking roof still dey. How student go survive? #KNUST #Bomso #HostelPrices #ProtocolFee"},
    {"theme": "hostel", "campus": "UCC", "type": "gossip", "text": "Eii UCC portal don mad 😭 How you go allocate level 100 boys go Adehye Hall girls block then post girls go Atlantic Hall boys wing as roommates?? Guy reach room see 3 girls dey unpack 😭 Management say 'system glitch be patient' but glitch fit cause wahala #UCCGist #PortalGlitch #Adehye #AtlanticHall"},
    {"theme": "hostel", "campus": "UPSA", "type": "gossip", "text": "Yooo UPSA freshers hear gist 😭 Madina/Okponglo agent dey charge GH¢200 just to SHOW room, then after viewing e say 'pay GH¢450 protocol to secure am' then vanish! Roomie send momo GH¢650 total, number off. No receipt no pay! #UPSA #MadinaHostels #HostelScamAlert #FreshersGuide"},
    {"theme": "hostel", "campus": "KNUST", "type": "gossip", "text": "KNUST SRC don drop warning ooo!! Freshers Sept 2026 beware 😭 WhatsApp groups 'Admission assistance + guaranteed hostel GH¢500' na scam 💀 One guy collect GH¢800 from 12 SHS people then comot. KNUST no dey do admission for WhatsApp, portal only! #KNUST #AdmissionScam #KNUSTFreshers #WayoAlert"},
    {"theme": "hostel", "campus": "UCC", "type": "confession", "text": "Hall gist wey dey pain me pass 😤 UCC hall tutors dey sell beds GH¢3k-5k but if you be fine girl dem go whisper 'come see me privately we can arrange' 😒 Bed for favours... My friend sleep floor 3 weeks cos she no gree. #UCC #HallGist #HostelWayo #CapeCoast"},
    {"theme": "hostel", "campus": "UEW", "type": "gossip", "text": "UEW Winneba landlords no dey fear God 😭 2 years advance + GH¢600 light bill + GH¢400 'dustbin fee' for single room wey water no dey flow. If you talk dem say go find elsewhere. Freshers dey perch church. Wayo! #UEW #Winneba #HostelScam #LandlordWahala"},
    # 15-21 Lecturer
    {"theme": "lecturer", "campus": "University of Ghana", "type": "confession", "text": "Legon babe here make I vent 😭💔 That married lecturer for our dept way everybody know but nobody dey talk... every small thing 'come to my office after 5pm ALONE'. My paddie refused, he vex tell am 'if you want pass my course you know what to do' threaten fail am. HOD say 'don't spoil his family' Herh we dey fear #SexForGrades #Legon #BBCExposed"},
    {"theme": "lecturer", "campus": "KNUST", "type": "gossip", "text": "KNUST freshers open eyes!! One TA for Engineering dey target Level 100 girls like hobby 😒 He go mark you low for practicals then DM WhatsApp 'I can help you, come to my place at night let me teach you privately' If you gree he sort marks, if you bounce am he fail you wicked. Roomie fall victim last sem #KNUST #TAFromHell #Level100"},
    {"theme": "lecturer", "campus": "UCC", "type": "gossip", "text": "UCC lecturer turn attendance to weapon 😭 7:59 he dey mark, 8:00 he lock door plus sign. Late 1 min e go mark you absent for whole sem. Class be 7am sef. He say 'African time no dey my class' Herh wicked #UCC #AttendanceTerror #LecturerWahala"},
    {"theme": "lecturer", "campus": "UPSA", "type": "gossip", "text": "UPSA lecturer wayo too much 😂 E dey sell handout GH¢80 compulsory, if you no buy e no go mark your assignment. E say 'my handout be your textbook'. Same handout be 12 pages photocopy blurry. Business man not lecturer #UPSA #HandoutScam #UPSAWayo"},
    {"theme": "lecturer", "campus": "GCTU", "type": "confession", "text": "GCTU lecturer say buy ein textbook GH¢250 or you go fail no matter your answer 😭 Book be ein own publication 2018, library get 2 copies for 300 students. If you borrow he know. We dey contribute buy one then photocopy. Wayo! #GCTU #TextbookMafia #GCTUGist"},
    {"theme": "lecturer", "campus": "UMaT", "type": "gossip", "text": "UMaT lecturer no dey come class whole sem 😭 Then one week to exams e drop 300 slides say 'this be exam scope'. Question come from 1978 past question wey no dey syllabus. 70% fail. Herh mining school stress #UMaT #Tarkwa #LecturerNoShow #ExamScope"},
    {"theme": "lecturer", "campus": "UEW", "type": "confession", "text": "After BBC Africa Eye Sex for Grades 2019 we thought things go change, chale NOTHING change 😔 Same married men still dey demand office visits threaten girls wey refuse. Culture of silence too real - if you talk dem label you 'ashawo'. Girls dey suffer silent #UEW #SexForGrades #BBCExposed #Winneba"},
    # 22-27 Safety
    {"theme": "safety", "campus": "UCC", "type": "gossip", "text": "Herrh this gist dey worry me fr 😔 Someone compile sey about 13 non-natural student deaths across Ghana unis since 2024, mostly road accidents plus few suspected suicide. Not spreading fear but chale we for look out. If you dey feel low abeg talk to someone 🙏 #Safety #UCC #KNUST #MentalHealth"},
    {"theme": "safety", "campus": "UCC", "type": "gossip", "text": "Still thinking about Innocentia Avinu from UCC 🕊️ That beach incident last year pain me. Young bright whole life ahead herrh. Beach be vibe for birthdays but Cape Coast tides no dey joke especially evening/solo waka. Always go with squad abeg #UCC #RIP #BeachSafety #CapeCoast"},
    {"theme": "safety", "campus": "KNUST", "type": "gossip", "text": "KNUST hostel gist got me anxious chale 😓 That fall from hostel story wey circulate plus late night movement warnings for ladies around Ayeduase/Kotei/Tech junction 8pm dark road no light. Chale balcony no be chill spot. Pin location to roomie #Safety #KNUST #Ayeduase #Kotei"},
    {"theme": "safety", "campus": "KNUST", "type": "gossip", "text": "This KNUST relationship + hook-up party gist dey scare me 🥺 Heard relationship wey turn violent plus 'link-up' parties where drinks go bad quick. Chale love no be by force, if e be controlling, threatening abeg speak out. No drink from stranger #Safety #KNUST #Consent #HookupParty"},
    {"theme": "safety", "campus": "University of Ghana", "type": "gossip", "text": "Legon Pentagon to Evandy night robbery mad 😭 After 9pm guys dey snatch phones for Pentagon-Evandy stretch, no street light. My guy lose iPhone 13 plus momo PIN. Security dey but dem dey sleep. Chale no waka alone for night #UG #LegonSafety #Pentagon #Evandy"},
    {"theme": "safety", "campus": "UEW", "type": "gossip", "text": "Winneba highway be death trap 😭 UEW students dey cross Winneba-Cape Coast road no traffic light, trotro dey speed 120. Last month two level 200 knock down. School need footbridge. Chale cross with squad abeg 🙏 #UEW #WinnebaHighway #RoadSafety #StudentSafety"},
    # 28-34 Everyday noise
    {"theme": "everyday", "campus": "University of Ghana", "type": "gossip", "text": "6:30am lecture for Legon?? Herrh lecturer enter like ein wife beat am for dawn 😭 Shout dey give everybody 'WHY YOU LATE' my guy we self we never sleep, we battle trotro since 5am. Abeg abolish 6:30am lectures! #LegonWahala #630AMTorture #UG"},
    {"theme": "everyday", "campus": "UCC", "type": "meme", "text": "UCC library no be library again, na TikTok headquarters 😂 Assignment due midnight but Auntie for aisle 3 dey do 'everybody tap tap' with ring light. Books dey cry for corner, GPA dey sink but views dey rise. #UCCAfterClass #TikTokOverBooks #UCCLibrary"},
    {"theme": "everyday", "campus": "KNUST", "type": "gossip", "text": "Katanga vs Unity hall gist too loud chale 😭 You dey try sleep midnight then next room dey host bedroom conference, morning you hear staircase 'so na you dey date hall sec AND SRC babe?' Eii who dey sleep with who for hall? WiFi no work but gossip stream 5G #KNUSTGist #Katanga #UnityHall #HallGossip"},
    {"theme": "everyday", "campus": "UPSA", "type": "confession", "text": "Eii that UPSA next-best-couple wey dey match outfit everyday for canteen 😍 My GPA dey match like kente design - D for here, F for there, C for corner 😭 Relationship goals plenty but first class no dey. Who we go envy pass? #UPSARealities #CoupleGoalsVsGPA #UPSACanteen"},
    {"theme": "everyday", "campus": "KNUST", "type": "meme", "text": "That KNUST pure water CEO wey dey hawk in full corporate attire with tie and shiny shoe?? 😂 Boss viral for LinkedIn, TikTok and lecturer WhatsApp group same day! Meanwhile we queue 45mins for indomie wey boiler no light. Hustle be real! #KNUSTHustle #PureWaterCEO #CanteenQueue"},
    {"theme": "everyday", "campus": "GCTU", "type": "gossip", "text": "GCTU Tesano light off, generator noise louder than lecturer mic 😭 Class dey shout competition - generator vs lecturer vs students for back dey gist. No light but noise full. How for learn? #GCTU #Tesano #NoLight #GCTUGist"},
    {"theme": "everyday", "campus": "UEW", "type": "meme", "text": "UEW Winneba beach wind be lecturer 😂 Front row notes dey fly go back row during lectures near sea. You dey copy note, wind take am. Lecturer say 'chase am'. Chale we need weight for books #UEW #WinnebaWind #LectureStruggle"},
    # 35-41 Academic stress
    {"theme": "academic", "campus": "KNUST", "type": "confession", "text": "KNUST Engineering go humble you 😭 First sem 3.6 GPA, second sem 1.9. Thermodynamics plus drawing all fail. My mom say 'are you studying or sleeping?' Chale nobody warn me level 200 hit different fr #KNUST #Engineering #GPAKiller #AcademicStress"},
    {"theme": "academic", "campus": "University of Ghana", "type": "gossip", "text": "Why UG WiFi only work when lecturer dey check attendance?? 😭 During lecture WiFi be 5G, after class e die. Assignment due 11:59pm WiFi vanish. IT people dey do juju? #UG #UGWiFi #AttendanceWiFi #GhanaUni"},
    {"theme": "academic", "campus": "UCC", "type": "confession", "text": "The struggle of finding socket in UCC library during exam week be whole sport 😭 You go come 6am go reserve seat with book then go bath come back someone comot book sit. War for socket. Exam stress x100 #UCC #LibraryHustle #ExamWeek #SocketWars"},
    {"theme": "academic", "campus": "GCTU", "type": "gossip", "text": "GCTU registration portal crash deadline day 😭 Queue 3 hours for IT, portal say 'gateway timeout', deadline same day 5pm. Students dey cry for admin block. Every sem same movie. #GCTU #RegistrationWahala #PortalCrash #GhanaUni"},
    {"theme": "academic", "campus": "UPSA", "type": "confession", "text": "Who dey set UPSA assignment deadlines 11:59pm like we no dey sleep? 😭 Group dey submit 11:58 then Moodle say 'closed'. Lecturer say 'you late by 2 mins, zero'. Chale wicked. #UPSA #DeadlineWahala #MoodleStress"},
    {"theme": "academic", "campus": "UMaT", "type": "confession", "text": "UMaT lab practical be reality show 😂 Equipment broken since 2019, lecturer say 'improvise'. We dey titrate with water bottle. How we go get accurate result? Tarkwa mining stress #UMaT #LabStress #Tarkwa #PracticalWahala"},
    {"theme": "academic", "campus": "UEW", "type": "gossip", "text": "UEW teaching practice posting be punishment 😭 Dem post you go village near Winneba no light, no network, but attendance compulsory everyday 7am. You for waka 5km go teach then waka come. Allowance never come. Chale #UEW #TeachingPractice #Winneba #GhanaEdu"},
    # 42-48 Fees
    {"theme": "fees", "campus": "University of Ghana", "type": "gossip", "text": "UG fees increment mad 😭 30% up plus residential GH¢4000 for traditional hall. Parents dey call dey cry 'how we go pay?' SRC say dem dey negotiate but fees still dey rise. Chale education be luxury now #UG #UGFees #LegonFees #FeesIncrement"},
    {"theme": "fees", "campus": "KNUST", "type": "gossip", "text": "Bomso hostel from 4k to 6.5k in one year, plus they want 2 years advance herrh 😭 Who get that money?? Landlord add 'maintenance fee' GH¢700 but maintenance never do since 2023. Pure wayo #KNUST #Bomso #HostelFees #StudentLifeGH"},
    {"theme": "fees", "campus": "UCC", "type": "confession", "text": "UCC school fees deadline be trap 😭 Portal charge late payment GH¢500 penalty wicked. My fees delay 2 days sake momo network, dem add penalty. Already broke still dey fine. Chale system no dey pity #UCC #FeesDeadline #PenaltyWahala #CapeCoast"},
    {"theme": "fees", "campus": "UPSA", "type": "gossip", "text": "UPSA fees plus SRC dues GH¢350 + dept dues GH¢200 + faculty GH¢150 total dey pass tuition itself 😭 Every level new fee appear 'development levy'. Development wey we no dey see. Cash cow #UPSA #HiddenFees #SRCLevy #GhanaUni"},
    {"theme": "fees", "campus": "GCTU", "type": "confession", "text": "GCTU fees GH¢7000 but WiFi no dey work, lab computers be Windows 7 dey freeze 😭 Ebe like we pay for AirtelTigo hotspot. Where the money dey go? Chale we need audit #GCTU #GCTUFees #WeyMoneyGo"},
    {"theme": "fees", "campus": "UEW", "type": "gossip", "text": "UEW fees increment plus feeding money plus trotro fare double from GH¢4 to GH¢8 Winneba town to campus 😭 Monthly budget finish in 2 weeks. How level 100 go survive? Home food no fit again #UEW #Winneba #TrotroFare #FeesStress"},
    {"theme": "fees", "campus": "UMaT", "type": "gossip", "text": "UMaT fees small but hostel price for Tarkwa dey kill mining students 😭 Single room GH¢5000 plus you for buy water GH¢30 per barrel cos tap no dey flow. Mining town but no water. Irony #UMaT #TarkwaHostel #WaterWahala"},
    # 49-55 SRC
    {"theme": "src", "campus": "KNUST", "type": "gossip", "text": "KNUST SRC elections vote buying mad 😭 GH¢50 + jollof + shito + Malta dey share for polling station. One aspirant park 2 V8 share cash. After win dem go chop 10x. Chale democracy be market #KNUST #SRCElections #VoteBuying #KNUSTPolitics"},
    {"theme": "src", "campus": "University of Ghana", "type": "gossip", "text": "UG SRC week artist no show again 😭 Dem take GH¢200k pay artist, artist no come, SRC say 'unforeseen circumstances'. Same story every year. Meanwhile hall week rotate with same DJ. Chale where money go? #UG #SRCWeek #ArtistNoShow #LegonGist"},
    {"theme": "src", "campus": "UCC", "type": "gossip", "text": "UCC SRC dues GH¢200 we pay every year, accountability zero 😭 No project, no report. SRC car dey move but hostel light off. Wey money go? Audit report no dey. Chale we need probe #UCC #SRCDues #Accountability #UCCSRC"},
    {"theme": "src", "campus": "UPSA", "type": "gossip", "text": "UPSA SRC promise hostel building 3 years ago, still foundation 😭 Every manifesto same 'hostel facility for students'. 3 SRCs don go, blocks still dey ground level. Campaign promises be scam #UPSA #SRCPromises #HostelProject #UPSAGist"},
    {"theme": "src", "campus": "GCTU", "type": "gossip", "text": "GCTU SRC election beef hall vs hall insults for Yard 😂 Tesano vs Ashanti hall dey throw shades 'your hall be village', comments dey turn boxing ring. Moderators dey delete but beef continue for WhatsApp #GCTU #SRCElections #HallBeef #YardGist"},
    {"theme": "src", "campus": "UEW", "type": "meme", "text": "UEW SRC week vs exams clash 😭 Dem fix SRC week same week as mid-sems, nobody go attend. Stage dey empty artists dey perform for chairs. Who plan this timetable?? #UEW #SRCWeek #ExamClash #PlanningFail"},
    {"theme": "src", "campus": "UMaT", "type": "gossip", "text": "UMaT SRC be like ghost 😂 You no dey see them whole sem, only fees time dem appear dey collect dues. Office lock 24/7. Do they exist? Chale we need missing person poster #UMaT #GhostSRC #Tarkwa #StudentPolitics"},
    # 56-62 Exams
    {"theme": "exams", "campus": "UCC", "type": "gossip", "text": "UCC exam timetable be wicked 😭 3 papers in 2 days plus two papers same time clash - DB management vs Software Eng same slot. Department say 'choose one, carry the other'. GPA on the line. How? #UCC #ExamTimetable #TimetableClash #ExamsWahala"},
    {"theme": "exams", "campus": "KNUST", "type": "gossip", "text": "KNUST invigilator wicked pass Satan 😭 Guy just look up small to check time, man seize ein paper 15 mins 'for malpractice'. Whole hall silent. Exam anxiety x100. Chale invigilators need training #KNUST #InvigilatorWahala #ExamStress #KNUSTExams"},
    {"theme": "exams", "campus": "University of Ghana", "type": "gossip", "text": "UG exam leak WhatsApp group admin collect GH¢20 from 200 students then send fake questions 😂 After exam students realize na 2019 questions. Admin left group. Wayo 101. Chale who leak again? #UG #ExamLeak #WayoAlert #LegonExams"},
    {"theme": "exams", "campus": "UPSA", "type": "confession", "text": "UPSA exams no spacing 😭 Business students 300 for hall, shoulder to shoulder, you dey copy your own sweat. No cheating even if you want. Air no dey. After exam shirt wet like we bath. #UPSA #ExamHall #NoSpacing #UPSAExams"},
    {"theme": "exams", "campus": "GCTU", "type": "confession", "text": "GCTU online quiz power off during submission auto submit blank 😭 My quiz 70% complete, ECG take light 11:58pm, auto submit empty. Lecturer say 'no retake, you should use charged device'. Chale wicked #GCTU #OnlineQuiz #ECGWahala #GCTUExams"},
    {"theme": "exams", "campus": "UEW", "type": "gossip", "text": "UEW exam hall no fans, 200 students dey sweat dey drip for answer sheet 😭 Paper wet, ink dey smear. Invigilator say 'no handkerchief'. How we go write? Winneba heat no be joke #UEW #ExamHall #NoFans #WinnebaHeat"},
    {"theme": "exams", "campus": "UMaT", "type": "meme", "text": "UMaT exam question photocopy blurry like CCTV 😂 1978 past question copy of copy, you for guess whether na '0' or '6'. Lecturer say 'manage'. How we go pass? #UMaT #BlurryQuestions #Tarkwa #ExamWahala"},
    # 63-68 Attendance
    {"theme": "attendance", "campus": "University of Ghana", "type": "gossip", "text": "UG QR attendance wayo too much 😭 One phone dey scan for 10 friends. Guy dey hostel dey chop indomie but QR mark am present for Legon. Lecturer think attendance 100%. System be scam #UG #QRAttendance #WayoAlert #AttendanceWayo"},
    {"theme": "attendance", "campus": "KNUST", "type": "gossip", "text": "KNUST lecturer lock door 8:01 sharp 😭 Latecomers dey peep window dey beg 'sir please'. He say 'my class be flight, you miss am you miss am'. Trotro traffic be your problem not his. Chale heartless #KNUST #AttendanceTerror #8AMLecture"},
    {"theme": "attendance", "campus": "UCC", "type": "meme", "text": "UCC attendance sheet disappear right when you need sign late 😂 Front row sign then sheet vanish before e reach back row. Course rep say 'sheet don fill'. Wayo. Back row always absent #UCC #AttendanceSheet #CourseRepWayo"},
    {"theme": "attendance", "campus": "GCTU", "type": "confession", "text": "GCTU attendance 80% else no exam even if you sick with proof 😭 Doctor note self dem say 'not excuse'. Fever 39 degrees still for come. We dey hallucinate for class. Chale policy wicked #GCTU #AttendancePolicy #80Percent #GCTUGist"},
    {"theme": "attendance", "campus": "UEW", "type": "gossip", "text": "UEW attendance manual but course rep dey tick friends wey absent 😂 If you be paddie you dey present even for home. Others wey come early no tick. Favoritism 101. Chale course rep power pass lecturer #UEW #CourseRepWayo #AttendanceScam"},
    {"theme": "attendance", "campus": "UPSA", "type": "gossip", "text": "UPSA biometric attendance fail 😭 Fingerprint no dey recognize after washing plates for canteen. You press 10 times e say 'not recognized'. Meanwhile you present. Now you absent for system. #UPSA #BiometricFail #AttendanceWahala"},
    # 69-74 Group projects
    {"theme": "group", "campus": "University of Ghana", "type": "confession", "text": "UG group projects be scam 😭 One person do everything, 4 names on cover page. Defense day free riders dey answer 'I did the conclusion'. Group chat dead until night before. Chale I tire #UG #GroupProject #FreeRider #LegonGist"},
    {"theme": "group", "campus": "KNUST", "type": "gossip", "text": "KNUST group chat silent till night before deadline then chaos 😂 11pm 'guys we for submit tomorrow 8am, who get part?' Then 30 messages one minute. Midnight someone send PDF upside down. Wahala #KNUST #GroupProject #LastMinute #KNUSTGist"},
    {"theme": "group", "campus": "UCC", "type": "confession", "text": "UCC group member send docx last minute with Comic Sans yellow highlight 😭 Slide get 15 fonts, 10 clip art. Presentation be funeral. Lecturer vex dash us C. Chale who add am to group? #UCC #GroupWahala #ComicSansKiller #GroupProject"},
    {"theme": "group", "campus": "GCTU", "type": "gossip", "text": "GCTU group presentation free rider no show still get same mark 😭 He dey hostel dey sleep, we dey sweat present, lecturer give all group B+. He thank us for WhatsApp 'thanks guys'. Chale unfair #GCTU #FreeRider #GroupProject # unfairMark"},
    {"theme": "group", "campus": "UEW", "type": "confession", "text": "UEW teaching practice group project one person plan lesson note others copy 😭 One babe do all scheme of learning 20 pages, 3 guys just write name. Supervisor praise group. She tire. #UEW #GroupProject #TeachingPractice #FreeRider"},
    {"theme": "group", "campus": "UMaT", "type": "meme", "text": "UMaT lab group 5 people 1 dey do titration 4 dey video for TikTok 😂 After lab dem say 'we all contributed equally'. Lecturer clap. Lab report na one person sweat. #UMaT #LabGroup #TikTokLab #GroupWayo"},
    # 75-80 Campus crushes
    {"theme": "crush", "campus": "KNUST", "type": "confession", "text": "KNUST Bush Canteen crush dey kill me 😍 Eye contact every lunch 12:30, she dey smile small then look away. 3 semesters no talk. My guy say go talk, fear dey catch me. Chale Crush szn #KNUST #BushCanteen #CampusCrush #Confession"},
    {"theme": "crush", "campus": "University of Ghana", "type": "meme", "text": "That awkward moment you wave at someone for UG commonwealth hall who wasn't waving at you 😭 Hand hang for air 5 secs, you fake fix hair. Crush see am sef. Embarrassment 101. #UG #AwkwardWave #CrushFail #LegonGist"},
    {"theme": "crush", "campus": "UCC", "type": "confession", "text": "UCC library crush aisle 3 she always dey wear same perfume vanilla 😍 I dey fail to approach 2 months. I sit opposite just dey sniff. Today she smile say 'you always here?' Chale I freeze. Next move? #UCC #LibraryCrush #Aisle3 #UCCLibrary"},
    {"theme": "crush", "campus": "UPSA", "type": "meme", "text": "UPSA crush from Accounting class ask for calculator one time, now we married for my head 😂 I don name our kids. She still no know my name. How for shoot shot? #UPSA #CalculatorLove #UPSACrush #OneSided"},
    {"theme": "crush", "campus": "GCTU", "type": "confession", "text": "GCTU shuttle bus crush every 7am we sit opposite never talk 😭 Eye contact via mirror. Driver know we be crush but we dey form. Today she no come, my day spoil. Chale who go help toast? #GCTU #ShuttleCrush #Tesano #Confession"},
    {"theme": "crush", "campus": "UEW", "type": "gossip", "text": "UEW crush confessed for Yard anonymous now whole Winneba campus dey search who be am 😂 Post say 'Winneba girl with braids level 200, I like you since orientation' comments 80 people dey tag. Anonymity don spoil #UEW #YardConfession #CampusCrush #WinnebaGist"},
]

comment_pools = {
    "relationships": [
        "Herh this be real movie wai 😂 Bush Canteen again?? Every week new episode",
        "Chale KNUST girls no dey shame again ooo but boys too dey cheat pass",
        "Ei the kneeling video go soon drop for telegram, mark my word 😂",
        "Love for Ghana uni be investment wey dey always fail, run ooo",
        "Chale you be mumu, you dey cook for babe wey dey chop another guy? wake up!",
        "This be why I no dey date campus, outside babe better",
        "Herh 1.9 GPA? Babe chop your brain plus your food 💀",
        "Odogywu package be the new NSFAS 😂 networking indeed",
        "You dey save am as Momo? 😂😂 you too you be wayo",
        "Small campus be like village, you go date your ex ein cousin next sem",
        "Chale cohabitation na scam, better perch alone",
        "Relationship for uni be like group project, e go fail at the end",
    ],
    "hostel": [
        "Chale I pay 2k for bed last year, guy block me after momo 😭 perching 3 weeks",
        "Herrh hall secretary say no bed dey sell for that price, all be scam. Go office direct",
        "Hostel mafia is real. They buy 6 beds with IDs then resell 💀 ebi business",
        "Bomso hostel from 4k to 6.5k in one year, plus 2 years advance herrh",
        "My landlord add 'maintenance fee' GH¢700, maintenance wey e never do since 2023",
        "Next sem we go sleep for lecture hall be that 😭 price control no dey?",
        "If dem ask for momo before receipt, na scam. No receipt no payment!",
        "This be same guy with 3 IG pages hostelhub_gh all be am",
        "System glitch my foot, who code that portal? SHS student?",
        "Freshers dey panic o, dem for reassure but portal still dey mad",
        "2 years advance be wickedness, who dey get that money for Ghana?",
        "Private hostel be the real fees, school fees be small pimple",
    ],
    "lecturer": [
        "Herh which course be this?? DM me initials make we avoid am abeg",
        "Make them leak name, married man mpo dey do this smh 🤬",
        "Chale same thing my cousin face for PoliSci, dem transfer am but he still dey",
        "We know am!! That fair TA wey dey mark Chem practicals?? E be am?",
        "Report anonymously for Yard, make e trend make school act",
        "Culture of silence go kill us, BBC sef expose but nothing change",
        "Handout mafia be real business, lecturers dey cash out on us",
        "This lecturer need sacking not transfer, nonsense",
        "If you no buy textbook you fail? What kind of education be this??",
        "Level 100s be vulnerable pass, dem dey target them purposely 😒",
        "Hard guy e be, but karma dey wait am",
        "HOD dey protect am, system be rotten",
    ],
    "safety": [
        "Fr fr, counselling centre dey free for UCC, go talk to someone wai 🙏",
        "That Cape Coast highway be death trap at night, no light no speed bump",
        "We start daily 'you good?' check for our block now, e help",
        "May she rest well 🙏 my cousin be lifeguard for beach, e say tides mad",
        "True talk, we cancel our evening beach shoot, daytime + group only now",
        "Facts! That Ayeduase road dark too much after 8pm, ladies pin location",
        "Landlords really need do safety rails, balcony be no joke",
        "If friend invite you to hook-up party check who dey organize, safety first",
        "Relationship red flags no be joke, if he dey control abeg leave 🙏",
        "Pentagon-Evandy robbery be true, my guys 2 phones lost same spot",
        "School need footbridge for Winneba road, petition dey but no action",
        "Chale look out for each other, no waka alone at night",
    ],
    "everyday": [
        "Chale that lecturer need therapy not students 😂 6:30am be abuse",
        "You for see ein face like he no chop morning food 😂",
        "Eii UG lecturers dey vex pass KNUST own?? Competition dey?",
        "Facts 😭 I go library go read, I come back with 3 TikTok drafts",
        "The girl wey dey dance get 4.2 GPA sef, how??",
        "Katanga hall never disappoints 😂 gossip dey move faster than WiFi",
        "Hall gossip dey stream for 5G while school WiFi dey buffer",
        "Give me GPA over couple goals any day, but love sweet sha 😂",
        "45mins?? You lucky, we do 1 hour queue for indomie 😭",
        "Forbes 30 under 30 loading for pure water CEO 😂 hustle real",
        "Generator vs lecturer battle be real, student na casualty",
        "Winneba wind lecturer be extra course on its own 😂",
    ],
    "academic": [
        "Chale 1.9 to 3.6 be real life, engineering no be joke 😭",
        "WiFi only work when e no be important, Juju be that",
        "Socket wars be real, people dey fight for extension 😂",
        "Herh portal dey always crash deadline day, who build am??",
        "11:59pm deadline be wickedness, why not 5pm?",
        "We dey improvise titration with Voltic bottle, science be trial 😂",
        "Teaching practice posting go humble you, village no be easy",
        "Level 200 go show you shege, first class no be beans",
        "Library seat reservation be war, books no dey guarantee seat",
        "Assignment due yesterday but you think sey today, panic 😭",
        "We dey charge power bank like gold during exams",
        "Herh GPA dey drop like crypto, make we study wai",
    ],
    "fees": [
        "Fees increment be heartbreak pass breakup 😭 30%?",
        "Parents dey call dey cry, we dey form 'everything okay' but broke",
        "Penalty GH¢500 for 2 days late?? System be loan shark",
        "SRC levy plus faculty plus dept, we pay 4 schools",
        "GCTU Windows 7 computers be antique, fees be 7k? Wayo",
        "Trotro fare double but allowance same, maths no dey add",
        "Hostel be 5000 plus water barrel GH¢30, Tarkwa town wayo",
        "Education be luxury now, only rich fit graduate?",
        "We pay development levy but development no dey show",
        "Momo delay cause penalty, network be part of fees now",
        "Hostel fee pass tuition, landlord be vice chancellor",
        "We for protest but SRC dey chop with management",
    ],
    "src": [
        "Vote buying be tradition for SRC, GH¢50 and Malta 😂",
        "Artist no show be annual festival, 200k vanish",
        "SRC car dey move but project no dey, wayo",
        "Foundation for 3 years be legacy project 😂",
        "Hall beef be best part of elections, gist dey flow",
        "SRC week clash exams be planning fail 101",
        "Ghost SRC dey only appear for dues collection",
        "After win dem go chop 10x, investment be that",
        "Same promises every year, we dey vote same wayo",
        "UG SRC week be scam, DJ recycle every year",
        "Audit report be mythology for SRC, nobody see am",
        "We need SRC wey work not chop",
    ],
    "exams": [
        "3 papers 2 days be murder, who make timetable??",
        "Invigilator seize paper for looking up, wickedness",
        "Leak group be scam 101, 20 cedis for fake questions 😂",
        "300 students shoulder to shoulder, exam be heat chamber",
        "ECG take light be exam strategy now? Online quiz trap",
        "Paper wet with sweat, ink dey cancel itself 😭",
        "Photocopy blurry be decoding exam, guess work",
        "GPA go sink like Titanic this sem",
        "Clash choose one carry other be gamble",
        "Wayo admin left group after collecting money 😂",
        "No fans hall be sauna, we dey bake",
        "Timetable be first exam on its own",
    ],
    "attendance": [
        "QR wayo be real, one phone dey mark 10 😂",
        "Lock door 8:01 be wicked, trotro no be your fault",
        "Sheet vanish before back row pen touch am",
        "80% policy be prison, sick self no excuse",
        "Course rep dey tick friends, power pass lecturer",
        "Biometric fail be daily wahala, fingerprint no match",
        "Attendance 100% but class half empty, wayo stats",
        "Late 1 min absent whole sem, nonsense",
        "Front row dey enjoy sign, back row suffer",
        "We dey scan for hostel while dey sleep, tech wayo",
        "System need reform, attendance no be learning",
        "Chale we dey pay fees to chase attendance not knowledge",
    ],
    "group": [
        "Group project be scam, one person do all 4 names",
        "Silent till night before then chaos 30 messages one minute 😂",
        "Comic Sans yellow highlight be crime against education",
        "Free rider still get same mark unfair pass",
        "We dey do presentation for free rider wey dey sleep 😭",
        "One does titration 4 dey TikTok, contribution equal my foot",
        "Cover page get 4 names but content na one sweat",
        "I tire for group work, better solo",
        "Night before submission na group project independence day 😂",
        "Lecturer give B+ to sleeping member, motivation kill",
        "Lesson note 20 pages one babe, guys just add name",
        "Group chat be ghost town till deadline eve",
    ],
    "crush": [
        "Chale go shoot your shot before someone else do 😂",
        "Eye contact 3 semesters? You be CCTV not crush 😂",
        "Crush wave fail be classic embarrassment 😭",
        "She smile say you always here? That be green light ooo!",
        "Calculator request be marriage proposal for your head 😂",
        "Shuttle crush be daily soap opera, driver ship una sef",
        "Anonymous confession make whole campus FBI, tag tag 😂",
        "Vanilla perfume be trap, you don fall 😍",
        "If you no talk you go graduate plus regret",
        "Crush dey look away na shyness, go meet am wai",
        "Love for campus sweet pass shito when e work",
        "Chale fear dey catch me too, but we move!",
    ],
}

# boosted selection 25% exactly 20
boosted_indices = set(random.sample(range(80), 20))
boosted_until = "2026-09-26T23:59:59.000Z"

output = []
for i, post in enumerate(posts_raw):
    yeahs = random.randint(15, 300)
    boosted = i in boosted_indices
    text = post["text"]
    # extract hashtags
    hashtags = re.findall(r"#\w+", text)
    # dedup preserve order? We'll extract unique but keep original case
    # Use lower? Keep as is but remove duplicates
    seen = set()
    uniq_tags = []
    for h in hashtags:
        lh = h.lower()
        if lh not in seen:
            seen.add(lh)
            uniq_tags.append(h)
    hashtags = uniq_tags
    campus = post["campus"]
    # normalize campus naming? Keep as is
    # comments
    theme = post["theme"]
    pool = comment_pools.get(theme, comment_pools["everyday"])
    n_comments = random.randint(2, 4)
    # sample without replacement from pool if pool large else with
    chosen_texts = random.sample(pool, n_comments)
    comments = []
    used_ghosts = random.sample(GHOSTS, n_comments)
    # to add mix: ensure at least one joke/love/hate per post? Our pools already mix
    for j in range(n_comments):
        ghost = used_ghosts[j]
        ctext = chosen_texts[j]
        # add slight variation: sometimes prepend emoji or tweak
        comments.append({
            "ghostId": ghost["ghostId"],
            "avatarEmoji": ghost["avatarEmoji"],
            "text": ctext
        })
    entry = {
        "text": text,
        "campus": campus,
        "type": post["type"],
        "yeahs": yeahs,
        "boosted": boosted,
        "hashtags": hashtags,
        "comments": comments
    }
    if boosted:
        entry["boostedUntil"] = boosted_until
    output.append(entry)

# stats
# Use utf-8 safe prints
import sys
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None
print(f"Generated {len(output)} posts")
print(f"Boosted: {sum(1 for p in output if p['boosted'])} should be 20")
print(f"Yeahs range: {min(p['yeahs'] for p in output)} - {max(p['yeahs'] for p in output)}")
# campus distribution
from collections import Counter
print(Counter(p["campus"] for p in output))
print(Counter(p["type"] for p in output))
print(Counter(p["theme"] for p in posts_raw))
# verify hashtags
try:
    print("Sample post:", json.dumps(output[0], indent=2, ensure_ascii=False))
except Exception as e:
    print("Sample post (ascii):", json.dumps(output[0], indent=2, ensure_ascii=True))

# write to file
out_path = r"C:\Users\ANIM\yard\ghana-mixed-80-seed.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
print(f"Wrote to {out_path}")
# also write verification
