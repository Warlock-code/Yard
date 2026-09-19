import json, re, copy

SRC = "gctu-chunk-F.json"

data = json.load(open(SRC, encoding="utf-8"))
orig = copy.deepcopy(data)

# ---------- helpers ----------
IRREG_PAST = {
    "catch": "caught", "eat": "ate", "steal": "stole", "take": "took",
    "buy": "bought", "bring": "brought", "think": "thought", "sleep": "slept",
    "keep": "kept", "leave": "left", "teach": "taught", "write": "wrote",
    "speak": "spoke", "talk": "talked", "tell": "told", "see": "saw",
    "go": "went", "come": "came", "get": "got", "give": "gave",
    "make": "made", "know": "knew", "feel": "felt", "find": "found",
    "hold": "held", "pay": "paid", "say": "said", "do": "did",
    "have": "had", "is": "was", "are": "were", "run": "ran",
    "swim": "swam", "sit": "sat", "win": "won", "begin": "began",
    "drink": "drank", "drive": "drove", "fall": "fell", "fly": "flew",
    "forget": "forgot", "forgive": "forgave", "freeze": "froze",
    "meet": "met", "lose": "lost", "shoot": "shot", "sing": "sang",
    "spend": "spent", "stand": "stood", "swear": "swore", "tear": "tore",
    "wear": "wore", "weep": "wept", "weep": "wept", "chop": "took",
    "waka": "walked",
}

def to_ing(v):
    vl = v.lower()
    if vl in ("die", "lie", "tie"): return v[:-2] + "ying" if v[-2:] in ("ie",) else vl
    if vl.endswith("ie"):
        base = v[:-2]
        return base + "ying"
    if vl.endswith("ee"):
        return v + "ing"
    if vl.endswith("e") and not vl.endswith(("ye", "oe", "ee")):
        return v[:-1] + "ing"
    # CVC doubling for short verbs
    if re.match(r"(?i)^[^aeiou]*[aeiou][bcdfghjklmnpqrstvwxyz]$", vl) and len(vl) <= 5 and vl not in ("cook","look","book","seek","sleep","keep","feel","rain","wait","eat","meet","boot"):
        # avoid doubling for verbs ending w,x,y
        if vl[-1] not in "wxy":
            return v + vl[-1] + "ing"
    if vl.endswith("y"):
        return v + "ing"
    return v + "ing"

def to_past(v):
    vl = v.lower()
    if vl in IRREG_PAST:
        p = IRREG_PAST[vl]
        # preserve capitalization
        if v[:1].isupper():
            p = p.capitalize()
        return p
    if vl.endswith("e"):
        return v + "d"
    if vl.endswith("y") and len(vl) > 1 and vl[-2] not in "aeiou":
        return v[:-1] + "ied"
    if re.match(r"(?i)^[^aeiou]*[aeiou][bcdfghjklmnpqrstvwxyz]$", vl) and len(vl) <= 4 and vl[-1] not in "wxy":
        return v + vl[-1] + "ed"
    return v + "ed"

def to_3sg(v):
    vl = v.lower()
    if vl in ("have",): return "has"
    if vl in ("do",): return "does"
    if vl in ("go",): return "goes"
    if vl.endswith(("s","sh","ch","x","z","o")):
        return v + "es"
    if vl.endswith("y") and vl[-2:-1] not in "aeiou" and len(vl) > 1:
        return v[:-1] + "ies"
    return v + "s"

PLURAL_HINTS = {"we","they","girls","boys","babes","sisters","roommates","friends","landlords","agents","wardens","students","girls,","rules","clothes","plates","alarms","visitors","members","owners","tenants","rooms","meters","phones","kids","children","parents","seniors","mates","seniors,"}

SINGULAR_S_WORDS = {"gas","class","glass","grass","mass","pass","cross","news","bus","plus","this","his","its","has","was","is","jesus","morning","evening"}

def clean_w(w):
    return w.strip("'\"").strip("\u2018\u2019\u201c\u201d").lower()

def preceding_word(text, pos):
    # get word before pos
    m = re.search(r"([A-Za-z']+)\s*$", text[:pos])
    if not m:
        return ""
    return clean_w(m.group(1))

def is_plural_word(w):
    w = clean_w(w)
    if w in ("we","they","you","girls","boys","babes","sisters","roommates","friends","landlords","agents","wardens","students","rules","clothes","tenants","rooms","owners","visitors","members","prices","kids","children","stories","thieves","agents","owners"):
        return True
    if w in SINGULAR_S_WORDS:
        return False
    if len(w) > 3 and w.endswith("s") and not w.endswith(("ss","us","is")):
        # likely plural noun
        return True
    return False

def find_subject_before(text, pos):
    # look back up to 6 tokens; if that/who/which present, take word before it
    toks = re.findall(r"[A-Za-z']+", text[max(0,pos-80):pos])
    toks = [clean_w(t) for t in toks]
    toks = [t for t in toks if t]
    if not toks:
        return ""
    # relative clause: take antecedent before that/who/which
    for i in range(len(toks)-1, max(-1, len(toks)-6), -1):
        if toks[i] in ("that","who","which") and i > 0:
            return toks[i-1]
    # skip trailing prep phrase: for/in/of/with/at/on + (our/my/the/a/an +)? + noun
    # e.g., stories for Madina -> stories
    j = len(toks) - 1
    # skip place nouns after prep?
    if j >= 2 and toks[j-1] in ("for","in","of","with","at","on") :
        return toks[j-2] if j-2 >= 0 else toks[j]
    if j >= 3 and toks[j-2] in ("for","in","of","with","at","on") and toks[j-1] in ("our","my","the","a","an","madina","tesano","abeka"):
        return toks[j-3]
    return toks[-1]

def is_plural_before(text, pos):
    subj = find_subject_before(text, pos)
    if subj == "i":
        return None
    if subj in ("we","they","you"):
        return True
    if is_plural_word(subj):
        # avoid false positive for 'rooms' when true subject is before relative clause? find_subject already handles that/who
        return True
    # check two words back for numbers
    toks = re.findall(r"[A-Za-z']+", text[max(0,pos-40):pos])
    if len(toks) >= 2:
        w1 = clean_w(toks[-2])
        if w1 in ("two","three","four","five","14","12","10","30","8","4","2","3","5","all"):
            return True
    return False

# ---------- main polish ----------
def polish_text(s):
    if not s:
        return s
    # protect hashtags, mentions, ghost IDs
    prot = {}
    def _prot(m):
        k = f"__P{len(prot)}__"
        prot[k] = m.group(0)
        return k
    s = re.sub(r"GA_[A-Za-z0-9]+", _prot, s)
    s = re.sub(r"#\w+", _prot, s)
    s = re.sub(r"@\w+", _prot, s)

    # normalize spaces around punctuation slightly, keep emojis
    # --- specific templates first ---
    # Eii sis this be my story word for word,
    s = re.sub(r"(?i)\bE+i+\s+sis\s*,?\s*this\s+be\s+my\s+story\s+word\s+for\s+word\s*,?", "Sis, this is my story word for word,", s)
    s = re.sub(r"(?i)\bthis\s+be\s+my\s+story\b", "this is my story exactly", s)
    s = re.sub(r"(?i)\byou\s+talk\s+my\s+mind\b", "you spoke my mind", s)
    s = re.sub(r"(?i)\bhostel\s+life\s+go\s+show\s+you\s+pepper\b", "hostel life will humble you", s)
    s = re.sub(r"(?i)\bgo\s+show\s+you\s+pepper\b", "will humble you", s)
    s = re.sub(r"(?i)\bno\s+be\s+beans\b", "is not easy", s)
    s = re.sub(r"(?i)\bAge?n?t\s+scam\s+ pain me pass breakup\b", "Agent scams hurt more than a breakup", s)
    s = re.sub(r"(?i)\bpain\s+me\s+pass\s+breakup\b", "hurts more than a breakup", s)

    # interjections
    s = re.sub(r"(?i)\bHerh\b", "Honestly", s)
    s = re.sub(r"(?i)\bChale\b", "Honestly", s)
    s = re.sub(r"(?i)\bChai\b", "Honestly", s)
    # Eii variants left
    s = re.sub(r"(?i)\bE+i+\b\s*,?", "Honestly,", s)
    # fix double Honestly, Sis,
    s = re.sub(r"(?i)Honestly,\s*Sis,", "Sis,", s)
    s = re.sub(r"(?i)Honestly,\s*Honestly,", "Honestly,", s)
    s = re.sub(r"(?i)\bSis\s+Honestly,", "Sis,", s)

    # abeg -> please ; sef, naa, kraa, wai, sey
    s = re.sub(r"(?i)\babeg\b", "please", s)
    s = re.sub(r"(?i)\bsef\b", "", s)
    s = re.sub(r"(?i)\bnaa\b", "", s)
    s = re.sub(r"(?i)\bkraa\b", "", s)
    s = re.sub(r"(?i)\bwai\b", "", s)
    s = re.sub(r"(?i)\bsey\b", "that", s)

    # ooo / oo / o particles (standalone)
    s = re.sub(r"\s+[oO]{3,}\b", "", s)
    s = re.sub(r"\s+[oO]{2}\b", "", s)
    # single ' o' at end or before punctuation/emoji - careful not to touch 'go','do','so','to'
    s = re.sub(r"\s+o\b(?=\s|$|[,.!?😭😂🙄😩🥲😤💔🤣😬😷🙏🏽👗🚿💧🏠📢🍲💡🔌🪣🧹🌙💗😭])", "", s)
    s = re.sub(r"(?i)\bsorry\s+ooo\b", "sorry so much", s)

    # dem -> they
    s = re.sub(r"(?i)\bdem\b", lambda m: "They" if m.group(0)[:1].isupper() else "they", s)
    # wey -> that
    s = re.sub(r"(?i)\bwey\b", "that", s)
    # anaa -> or what
    s = re.sub(r"(?i)\banaa\b", "or what", s)
    # roomie -> roommate (polished; IDs protected)
    s = re.sub(r"(?i)\broomie\b", lambda m: "Roommate" if m.group(0)[:1].isupper() else "roommate", s)
    # plus as conjunction -> and
    s = re.sub(r"(?i)\s+plus\s+", " and ", s)
    # no fear (pidgin don't worry) -> do not worry
    s = re.sub(r"(?i)\bno\s+fear\b", "do not worry", s)
    # ein handling
    def _ein(m):
        # look back
        pre = s[:m.start()]
        pw = preceding_word(pre, len(pre))
        if pw in ("for","with","to","of","in","on","from","and","plus","mix","my","our","her","his","their"):
            return "their"
        return "'s"
    s = re.sub(r"(?i)\bein\b", _ein, s)
    s = re.sub(r"\s+'s\b", "'s", s)

    # chop box protect
    s = re.sub(r"(?i)\bchop\s+box\b", "__CHOPBOX__", s)
    # specific chop phrases
    s = re.sub(r"(?i)\bgo\s+chop\s+me\b", "will bite me", s)
    s = re.sub(r"(?i)\bchop\s+money\b", "personal cut", s)
    s = re.sub(r"(?i)\bchop\s+finish\b", "finished eating", s)
    s = re.sub(r"(?i)\bstill\s+dem\s+find\s+chop\b", "they still found it to eat", s)
    # generic chop verb -> took/ate : use took for steal contexts, ate for food
    # if object is stew/indomie/bread/cake/milk -> ate
    def _chop(m):
        after = s[m.end():m.end()+30].lower()
        if any(w in after for w in ("stew","indomie","bread","cake","milk","milo","food","pot","meal","snack")):
            return "ate" if m.group(0).islower() else "Ate"
        return "took" if m.group(0).islower() else "Took"
    s = re.sub(r"(?i)\bchop\b", _chop, s)
    s = s.replace("__CHOPBOX__", "chop box")

    # waka -> walk
    s = re.sub(r"(?i)\bwaka\b", lambda m: "walked" if m.group(0).islower() else "Walked", s)

    # vex handling
    s = re.sub(r"(?i)\b(I|she|he|we|they|roomie|roommate|landlady|landlord)\s+vex\b", lambda m: f"{m.group(1)} got upset", s)
    s = re.sub(r"(?i)\bvex\b", "upset", s)
    # shakara -> attitude
    s = re.sub(r"(?i)\bshakara\b", "attitude", s)
    # wahala (non-hashtag, hashtags protected) -> trouble/drama
    s = re.sub(r"(?i)\bwahala\b", "drama", s)
    # by force -> whether you like it or not / forcefully (keep short)
    s = re.sub(r"(?i)\bby\s+force\b", "forcefully", s)
    # mumu -> foolishly (rare)
    s = re.sub(r"(?i)\blike\s+mumu\b", "to myself", s)
    s = re.sub(r"(?i)\bmumu\b", "silly", s)

    # am handling - specific first (with tense fix later, use base then fix?)
    # do specific with past where context past
    s = re.sub(r"(?i)\brecord\s+am\b", lambda m: "recorded it", s)
    s = re.sub(r"(?i)\blabel\s+am\b", lambda m: "labelled it", s)
    s = re.sub(r"(?i)\bopen\s+am\b", lambda m: "opened it", s)
    s = re.sub(r"(?i)\bconfront\s+am\b", lambda m: "confronted her", s)
    s = re.sub(r"(?i)\bcatch\s+am\b", lambda m: "caught her", s)
    s = re.sub(r"(?i)\btap\s+am\b", lambda m: "tapped her", s)
    s = re.sub(r"(?i)\btell\s+am\b", lambda m: "told her", s)
    s = re.sub(r"(?i)\bsee\s+am\b", lambda m: "saw her", s)
    s = re.sub(r"(?i)\bpack\s+am\b", lambda m: "packed it", s)
    s = re.sub(r"(?i)\bthrow\s+am\b", lambda m: "threw it", s)
    s = re.sub(r"(?i)\breturn\s+am\b", lambda m: "returned it", s)
    s = re.sub(r"(?i)\bshift\s+am\b", lambda m: "moved it", s)
    s = re.sub(r"(?i)\bsteal\s+am\b", lambda m: "steal it", s)
    s = re.sub(r"(?i)\btalk\s+am\b", lambda m: "addressed it", s)
    s = re.sub(r"(?i)\bplay\s+am\b", lambda m: "played it", s)
    s = re.sub(r"(?i)\bforget\s+am\b", lambda m: "forget it", s)
    s = re.sub(r"(?i)\breplace\s+am\b", lambda m: "replace it", s)
    s = re.sub(r"(?i)\bpick\s+am\b", lambda m: "picked it", s)
    # general am -> it (covers remaining objects)
    # avoid __P placehders containing am? placeholders are __P0__ no am issue. IDs protected.
    s = re.sub(r"(?i)\bam\b", "it", s)

    # e be / e dey / e ... (it) - specific first, then generic
    # E be like -> It seems like
    s = re.sub(r"(?i)\bE\s+be\s+like\b", lambda m: "It seems like" if m.group(0)[:1].isupper() else "it seems like", s)
    s = re.sub(r"(?i)\be\s+save\b", "it saved", s)
    s = re.sub(r"(?i)\be\s+work\b", "it worked", s)
    s = re.sub(r"(?i)\be\s+help\b", "it helped", s)
    s = re.sub(r"(?i)\be\s+reduce\b", "it reduced", s)
    s = re.sub(r"(?i)\be\s+disappear\b", "it disappeared", s)
    s = re.sub(r"(?i)\be\s+spoil\b", "it is faulty", s)
    s = re.sub(r"(?i)\be\s+too\s+much\b", "it is too much", s)
    s = re.sub(r"(?i)\be\s+be\b", lambda m: "It is" if m.group(0)[:1].isupper() else "it is", s)
    # e dey + verb -> it is + ing
    def _edey(m):
        cap = m.group(1)[:1].isupper()
        verb = m.group(2)
        ing = to_ing(verb)
        # preserve verb case lower
        return ("It is " if cap else "it is ") + ing
    s = re.sub(r"(?i)\b(E|e)\s+dey\s+([A-Za-z]+)", _edey, s)
    # remaining standalone e -> it (only for clear auxiliaries, save/work already handled)
    s = re.sub(r"\b[Ee]\b(?=\s+(is|was|has|too|no|don|go|be))", lambda m: "It" if m.group(0).isupper() else "it", s)
    # leftover single e as pronoun: " , e " -> it ; careful: don't touch a/b/c etc. Only replace ' e ' when surrounded by spaces and next word lower?
    # Use conservative: replace \b e \b before verb-ish? Already handled most. Final sweep: standalone e -> it when not in placeholder
    # placeholders are __P0__ so safe (e inside? no word boundary)
    # avoid replacing 'e' in "e.g." none present. Do it:
    # only if lowercase e surrounded by spaces
    # s = re.sub(r"(?<=\s)e(?=\s)", "it", s)  # risky (could break). Skip unless needed. Check later in validation.

    # make X -> so X can / we should (specific want-us-to first)
    s = re.sub(r"(?i)\bwant\s+make\s+we\s+school\s+again\b", "want us to continue schooling", s)
    s = re.sub(r"(?i)\bno\s+want\s+make\s+we\s+school\b", "do not want us to be in school", s)
    s = re.sub(r"(?i)\bwant\s+make\s+we\b", "want us to", s)
    s = re.sub(r"(?i)\bsay\s+make\s+we\b", "says we should", s)
    s = re.sub(r"(?i)\bsay\s+make\s+I\b", "says I should", s)
    s = re.sub(r"(?i)\bmake\s+I\b", "so I can", s)
    s = re.sub(r"(?i)\bmake\s+she\b", "so she can", s)
    s = re.sub(r"(?i)\bmake\s+he\b", "so he can", s)
    s = re.sub(r"(?i)\bmake\s+we\b", "so we can", s)
    s = re.sub(r"(?i)\bmake\s+you\b", "so you can", s)
    s = re.sub(r"(?i)\bmake\s+am\b", "so it can", s)  # am already -> it, but just in case order
    s = re.sub(r"(?i)\bmake\s+them\b", "so they can", s)
    # fix want + so we can (leftover from want make we) -> want us to
    s = re.sub(r"(?i)\bwant\s+so\s+we\s+can\b", "want us to", s)

    # tire handling
    s = re.sub(r"(?i)\bI\s+tire\b", "I am tired", s)
    s = re.sub(r"(?i)\bbeg\s+tire\b", "begged repeatedly", s)
    s = re.sub(r"(?i)\btalk\s+tire\b", "have talked repeatedly", s)
    s = re.sub(r"(?i)\bcry\s+tire\b", "cried so much", s)
    s = re.sub(r"(?i)\btire\b", "repeatedly", s)

    # dey handling: no dey + verb ; dey + verb
    # no dey + verb -> does/do not + base
    def _nodey(m):
        full_start = m.start()
        verb = m.group(1)
        pl = is_plural_before(s, full_start)
        aux = "do not" if pl else "does not"
        # I/you special: do not
        pre = preceding_word(s[:full_start], len(s[:full_start]))
        if pre in ("i","you","we","they"):
            aux = "do not"
        return f"{aux} {verb.lower()}"
    # apply iteratively (need to handle case where s changes; use loop)
    s = re.sub(r"(?i)\bno\s+dey\s+([A-Za-z]+)", _nodey, s)

    # dey + verb -> am/is/are + ing
    def _dey(m):
        full_start = m.start()
        verb = m.group(1)
        # skip if verb is placeholder start? verb could be __? no, [A-Za-z]+ won't match __
        pre_text = s[:full_start]
        pw = preceding_word(pre_text, len(pre_text))
        if pw == "i":
            aux = "am"
        elif pw in ("we","you","they","girls","boys","babes","sisters","roommates","friends","landlords","agents","students","rules","clothes","tenants","rooms","owners","visitors","members","kids","children") or is_plural_before(s, full_start):
            aux = "are"
        else:
            aux = "is"
        ing = to_ing(verb.lower())
        # preserve aux case? lower
        return f"{aux} {ing}"
    # avoid matching "they dey __P"? verb group [A-Za-z]+ won't match _. Good.
    s = re.sub(r"(?i)\bdey\s+([A-Za-z]+)", _dey, s)
    # leftover standalone dey (no verb after, e.g., "room dey smell" handled? smell is verb, yes. "shower ...?") -> is/are
    def _dey_left(m):
        full_start = m.start()
        pw = preceding_word(s[:full_start], len(s[:full_start]))
        if pw == "i":
            return "am"
        pl = is_plural_before(s, full_start)
        if pl:
            return "are"
        # check if pw plural-ish
        return "is"
    s = re.sub(r"(?i)\bdey\b", _dey_left, s)

    # don + verb -> past / have + past participle (use past simple for neutrality)
    def _don(m):
        verb = m.group(1)
        vl = verb.lower()
        # special: don talk tire already handled? don talk -> have talked
        # use past
        past = to_past(vl)
        return past
    s = re.sub(r"(?i)\bdon\s+([A-Za-z]+)", _don, s)
    # leftover don? e.g., "Boundaries don collapse" handled. Solo don -> have
    s = re.sub(r"(?i)\bdon\b", "have", s)

    # go future: protect movement go first
    # movement patterns: go + place/activity
    MOVES = ["party","school","church","lecture","lectures","class","classes","home","market","tesano","madina","abeka","accra","hostel","hostels","campus","hospital","clinic","kitchen","bathroom","room","work","trip","town","village","shop","shops","makola","junction","station","gate","office"]
    for mv in MOVES:
        s = re.sub(rf"(?i)\bgo\s+{mv}\b", f"__GO_{mv.upper()}__", s)
    s = re.sub(r"(?i)\bgo\s+and\s+come\b", "__GO_AND_COME__", s)
    s = re.sub(r"(?i)\bgo\s+buy\b", "__GO_BUY__", s)  # 'go buy' is movement to buy, keep as go to buy later
    # now remaining go + verb -> will + base
    # only when go is future marker: preceded by pronoun/noun, followed by verb. Simplify: replace " go " with " will " when next word is verb-like and not a movement noun.
    # Use list of common future verbs observed
    FUTURE_VERBS = ["show","learn","kill","humble","pay","get","know","tell","cause","collect","fix","steal","die","bite","prove","teach","help","reduce","work","happen","come","carry","take","make","do","be","have"," humble"," humble",]
    # generic approach: replace \bgo\b with will when previous word is subject pronoun or 'dem/they' etc and next word is not movement.
    # To avoid over-replacing movement 'go party' already protected. Also 'go meet', 'go look' are movement? "come look for her" - look is verb after come, not go. "go meet" is movement to meet. Hmm.
    # Safer: only replace go when pattern is (I|you|we|they|she|he|it|e|life|hostel|landlord|government|roomie|roommate|dem)\s+go\s+(\w+)
    def _go(m):
        subj = m.group(1)
        verb = m.group(2)
        vl = verb.lower()
        # if verb is movement noun, keep go
        if vl in MOVES or vl in ("party","school","church","home","market","hospital","clinic","town","shop","station","campus","hostel","accra","tesano"):
            return f"{subj} go {verb}"
        # if verb is 'go' itself? no
        return f"{subj} will {verb.lower()}"
    s = re.sub(r"(?i)\b(I|you|we|they|she|he|it|life|hostel|landlord|landlady|government|roomie|roommate|dem|student|girl|boy|agent|warden|boys|girls|tenants|owners|light|water|rent)\s+go\s+([A-Za-z]+)", _go, s)
    # restore movement
    for mv in MOVES:
        s = s.replace(f"__GO_{mv.upper()}__", f"go {mv}")
    s = s.replace("__GO_AND_COME__", "go and come")
    s = s.replace("__GO_BUY__", "go to buy")
    # fix "go to buy" double? "I go buy" -> protected -> "I go to buy" good.

    # wan -> want/wants
    def _wan(m):
        full_start = m.start()
        pw = preceding_word(s[:full_start], len(s[:full_start]))
        if pw in ("she","he","it","roomie","roommate","landlord","landlady","agent","warden","girl","boy","somebody","someone","person","caretaker","son","daughter"):
            return "wants to"
        return "want to"
    s = re.sub(r"(?i)\bwan\b", _wan, s)

    # fit -> can ; no fit -> cannot
    s = re.sub(r"(?i)\bno\s+fit\b", "cannot", s)
    s = re.sub(r"(?i)\bfit\b", "can", s)

    # no go -> will not
    s = re.sub(r"(?i)\bno\s+go\b", "will not", s)

    # I no + verb -> I did not / I cannot / I do not
    # specific: I no sleep -> I could not sleep ; I no sign -> I did not sign ; I no get -> I do not have ; I no fit already
    s = re.sub(r"(?i)\bI\s+no\s+sleep\b", "I could not sleep", s)
    s = re.sub(r"(?i)\bI\s+no\s+sign\b", "I did not sign", s)
    s = re.sub(r"(?i)\bI\s+no\s+get\b", "I do not have", s)
    s = re.sub(r"(?i)\bI\s+no\s+trust\b", "I do not trust", s)
    s = re.sub(r"(?i)\bI\s+no\s+hear\b", "I did not hear", s)
    s = re.sub(r"(?i)\bI\s+no\s+know\b", "I do not know", s)
    # general I no + verb -> I did not + verb (past neutralize)
    s = re.sub(r"(?i)\bI\s+no\s+([A-Za-z]+)", lambda m: f"I did not {m.group(1).lower()}", s)

    # she/he/we/they/you + no + verb
    s = re.sub(r"(?i)\b(she|he|we|they|you|it|room|water|trust)\s+no\s+([A-Za-z]+)", lambda m: f"{m.group(1)} does not {m.group(2).lower()}" if m.group(1).lower() in ("she","he","it","room","water","trust") else f"{m.group(1)} do not {m.group(2).lower()}", s)
    # Perching life no easy etc handled via no be? "no easy" -> is not easy
    s = re.sub(r"(?i)\bno\s+easy\b", "is not easy", s)

    # be handling: X be Y -> is/are ; protect modals
    # e be already handled. Now general be.
    # first "no be" -> is not / are not (use subject finder)
    def _nobe(m):
        full_start = m.start()
        subj = find_subject_before(s, full_start)
        if subj in ("we","they","you") or is_plural_word(subj):
            # but avoid rooms-object false positive when relative clause? find_subject handles that/who
            # extra guard: if subj is rooms/opening etc and that/who nearby, find_subject already returned antecedent
            return "are not"
        return "is not"
    s = re.sub(r"(?i)\bno\s+be\b", _nobe, s)
    def _be(m):
        full_start = m.start()
        pre = s[:full_start]
        pw = preceding_word(pre, len(pre))
        if pw in ("will","would","can","could","should","must","to","may","might","shall","cannot",):
            return "be"
        if pw in ("i",):
            return "am"
        subj = find_subject_before(s, full_start)
        if subj in ("we","they","you"):
            return "are"
        if subj and is_plural_word(subj):
            return "are"
        return "is"
    s = re.sub(r"(?i)\bbe\b", _be, s)

    # say -> that / said (pidgin "think say", "talk say", "tell am say")
    s = re.sub(r"(?i)\bthink\s+say\b", "think", s)
    s = re.sub(r"(?i)\btalk\s+say\b", "mention that", s)
    # "she say" present -> says ; "she say e spoil" -> she says it is faulty (e already)
    s = re.sub(r"(?i)\b(she|he|it|roomie|roommate|landlord|landlady|agent|warden|girl|lecturer)\s+say\b", lambda m: f"{m.group(1)} says", s)
    # "I catch am" already past. "say" leftover as conjunction -> that
    # e.g., "say she dey smell" -> "that she smells"? After dey handling, "say she is smelling" -> replace say with that when after politely/adverb?
    # Conservative: replace " say " with " that " when preceded by tell/know/hear/think/say? Already think say handled. Leave others (say as 'said' is okay? "When I confronted her she say" -> should be said. Our rule above converts she say -> she says (present). But past context "When I confronted" should be said (past). Hmm. Use said for past contexts? Simplify: "she say" -> "she said" when sentence has past verbs (confronted, caught)? Hard. Use "said" universally for she say? Present "says" vs past "said" both grammatical, past safer for narratives. Let's change to said.
    # Actually keep says (present) - also grammatical. Either passes. Keep says.

    # How I go tell -> How will I tell / How do I tell
    s = re.sub(r"(?i)\bHow\s+I\s+will\s+tell\b", "How do I tell", s)
    s = re.sub(r"(?i)\bHow\s+I\s+go\s+know\b", "How will I know", s)
    s = re.sub(r"(?i)\bwhere\s+student\s+will\s+get\b", "where will a student get", s)
    s = re.sub(r"(?i)\bwhere\s+student\s+want\s+to\s+get\b", "where will a student get", s)

    # catch -> caught when past narrative: "I catch" -> "I caught"
    s = re.sub(r"(?i)\bI\s+catch\b", "I caught", s)
    s = re.sub(r"(?i)\bI\s+buy\b", "I bought", s)
    # "I record" already recorded via am rule. "I label" -> labelled? "I label am" handled. Solo "I label" -> "I labelled"
    # "Somebody chop" -> Someone took/ate (chop already). "Somebody use" -> Someone used
    s = re.sub(r"(?i)\bSomebody\s+use\b", "Someone used", s)
    s = re.sub(r"(?i)\bSomebody\s+chop\b", "Someone took", s)  # chop already took, but just in case order? chop already converted, so skip. Keep.
    s = re.sub(r"(?i)\bSomebody\s+thief\b", "Someone stole", s)
    s = re.sub(r"(?i)\bSomebody\s+pour\b", "Someone poured", s)
    s = re.sub(r"(?i)\bSomebody\s+steal\b", "Someone stole", s)
    # Somebody generic: Somebody + base -> Someone + past? Hard. Leave.

    # for + place: "for Tesano hostel" -> "in our Tesano hostel" / "at ..."? "for" as location pidgin -> in/at. Replace "for Tesano", "for Abeka", "for Madina", "for room", "for hostel", "for bathroom", "for WhatsApp" etc -> in/at.
    s = re.sub(r"(?i)\bfor\s+(Tesano|Abeka|Madina|Accra|GCTU)\b", lambda m: f"in {m.group(1)}", s)
    s = re.sub(r"(?i)\bfor\s+(our|my|the)\s+(room|hostel|bathroom|kitchen|compound|veranda)\b", lambda m: f"in {m.group(1).lower()} {m.group(2).lower()}", s)
    s = re.sub(r"(?i)\bfor\s+room\s+3\b", "in Room 3", s)
    s = re.sub(r"(?i)\bfor\s+morning\b", "in the morning", s)
    s = re.sub(r"(?i)\bfor\s+night\b", "at night", s)

    # "take bath" -> "to bathe" ; "take top up" -> topped up
    s = re.sub(r"(?i)\btake\s+bath\b", "to bathe", s)
    s = re.sub(r"(?i)\btake\s+top\s+up\b", "topped up", s)

    # "give am" etc already. "throw pillow give am" -> throw pillow at her
    s = re.sub(r"(?i)\bgive\s+am\b", "at her", s)
    s = re.sub(r"(?i)\bgive\s+it\b", "at her", s)  # from throw pillow give it -> at her (context person)
    s = re.sub(r"(?i)\btest\s+it\b", "test her", s)

    # post-grammar fixes (order-independent)
    # caught X is/are using -> caught X using
    s = re.sub(r"(?i)\b(caught)\s+([A-Za-z']+)\s+(is|are|am)\s+([A-Za-z]+ing)\b", lambda m: f"{m.group(1)} {m.group(2)} {m.group(4)}", s)
    # it save/work/help/reduce leftover (from e->it generic) -> past
    s = re.sub(r"(?i)\bit\s+save\b", "it saved", s)
    s = re.sub(r"(?i)\bit\s+work\b", "it worked", s)
    s = re.sub(r"(?i)\bit\s+help\b", "it helped", s)
    s = re.sub(r"(?i)\bit\s+reduce\b", "it reduced", s)
    # almost live -> almost lives ; boyfriend almost live
    s = re.sub(r"(?i)\balmost\s+live\b", "almost lives", s)
    # Sis sorry -> Sis, I am sorry (sympathy opener)
    s = re.sub(r"(?i)^Sis\s+sorry\b", "Sis, I am sorry", s)
    s = re.sub(r"(?i)\bSis\s+sorry\b", "Sis, I am sorry", s)
    # trailing adverbial 'small' (pidgin minimizer) -> drop when before emoji/punct/end
    s = re.sub(r"(?i)\s+small(?=\s*[\U0001F300-\U0001FAFF\u2600-\u27BF\uFE0F]|[\s.,!?\u200d]|$)", "", s)
    # a/an fixes: 'a' before vowel? simple: 'a horror' ok, 'a executive'? -> an executive
    s = re.sub(r"(?i)\ba\s+executive\b", "an executive", s)
    s = re.sub(r"(?i)\ba\s+alarm\b", "an alarm", s)

    # cleanup doubles
    s = re.sub(r"\s{2,}", " ", s)
    s = re.sub(r"\s+([,.!?])", r"\1", s)
    s = re.sub(r"(?i)\bHonestly,\s*Honestly,", "Honestly,", s)
    s = re.sub(r",\s*,", ",", s)
    # fix "it it"? from am double? remove duplicate it
    s = re.sub(r"(?i)\bit\s+it\b", "it", s)
    # fix capitalization after period? ensure first letter capital
    s = s.strip()
    if s:
        s = s[0].upper() + s[1:]

    # restore protected
    for k, v in prot.items():
        s = s.replace(k, v)

    # final spacing
    s = re.sub(r"\s{2,}", " ", s).strip()
    return s

# ---------- apply ----------
errors = []
for idx, p in enumerate(data):
    try:
        p["text"] = polish_text(p["text"])
        for c in p.get("comments", []):
            c["text"] = polish_text(c["text"])
    except Exception as e:
        errors.append((idx, str(e)))

# ---------- validate ----------
import sys
banned = ["dey","wey","sey","eiii","eii","chale","herh","wai","kraa"]
# note: check whole-word case-insensitive, but allow 'wai' inside? whole word only. Also 'eii' catches 'eiii'.
issues = []
for i, p in enumerate(data):
    texts = [p["text"]] + [c["text"] for c in p["comments"]]
    for t in texts:
        # remove protected hashtags/mentions/IDs for banned check? hashtags contain Wahala etc, not banned. But check text without hashtags? banned words shouldn't appear even in hashtags? hashtags like #RoommateWahala no banned. So check full, but exclude hashtag content? Simpler check full but hashtags don't contain banned.
        # Exclude ghost IDs (GA_...) which could contain 'wai'? e.g., GA_RoomieTaya... no. But to be safe, strip GA_ tokens and hashtags for check.
        tc = re.sub(r"GA_[A-Za-z0-9]+", "", t)
        tc = re.sub(r"#\w+", "", tc)
        for b in banned:
            if re.search(r"(?i)\b" + re.escape(b) + r"\b", tc):
                issues.append((i, b, t[:160]))
                break

print(f"posts: {len(data)}")
print(f"errors: {len(errors)}")
if errors:
    print(str(errors[:3])[:500])
print(f"banned-word issues: {len(issues)}")
with open("polish_issues.txt","w",encoding="utf-8") as _f:
    for i,b,t in issues[:100]:
        _f.write(f"post {i} [{b}] {t[:300]}\n")

# hashtag / meta preservation check
meta_ok = True
for i,(o,n) in enumerate(zip(orig, data)):
    if o["authorGhost"]!=n["authorGhost"] or o["authorAvatar"]!=n["authorAvatar"] or o["yeahs"]!=n["yeahs"] or o["boosted"]!=n["boosted"] or o["type"]!=n["type"] or o["campus"]!=n["campus"] or o["hashtags"]!=n["hashtags"]:
        print(f"meta mismatch post {i}")
        meta_ok=False
    if len(o["comments"])!=len(n["comments"]):
        print(f"comment count mismatch post {i}")
        meta_ok=False
    for co,cn in zip(o["comments"], n["comments"]):
        if co["ghostId"]!=cn["ghostId"] or co["avatarEmoji"]!=cn["avatarEmoji"]:
            print(f"comment meta mismatch post {i}")
            meta_ok=False
    # hashtags inline preserved?
    for h in o["hashtags"]:
        if h not in n["text"] and not any(h in c["text"] for c in o["comments"]):
            pass  # hashtag may only be in array? Actually spec says same hashtags inline in text - check orig text contains h?
        if h in o["text"] and h not in n["text"]:
            print(f"hashtag lost post {i}: {h}")
            meta_ok=False
print("meta_ok:", meta_ok)

# write back
json.dump(data, open(SRC, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"wrote {SRC}")

# samples
with open("polish_samples.txt","w",encoding="utf-8") as f:
    for i in [0,1,5,10,20]:
        f.write(f"--- POST {i} BEFORE:\n{orig[i]['text']}\nAFTER:\n{data[i]['text']}\n")
        for j in range(min(2,len(orig[i]['comments']))):
            f.write(f"  C{j} BEFORE: {orig[i]['comments'][j]['text']}\n  C{j} AFTER : {data[i]['comments'][j]['text']}\n")
        f.write("\n")
print("samples written")
