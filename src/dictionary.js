(() => {
  const PST = globalThis.ParamountSubtitles;

  const IRREGULAR = Object.freeze({
    am: "be", are: "be", is: "be", was: "be", were: "be", been: "be",
    went: "go", gone: "go", did: "do", done: "do", had: "have",
    made: "make", took: "take", taken: "take", saw: "see", seen: "see",
    found: "find", thought: "think", told: "tell", knew: "know", known: "know",
    got: "get", gotten: "get", gave: "give", given: "give", came: "come",
    children: "child", people: "person", men: "man", women: "woman",
    feet: "foot", teeth: "tooth", mice: "mouse",
  });

  // A compact dialogue-oriented base vocabulary keeps the learning overlay focused on
  // genuinely useful words instead of annotating every line like a full translation.
  const BASIC_WORDS = new Set(`
    a about after again all almost along already also always am an and another any anybody
    anyone anything are around as ask at away back bad be because been before being best better
    big bit both boy bring brother but by call came can cannot car care come could dad day did
    do does doing done don't down each else enough even ever every everybody everyone everything
    face family far feel few find first for found friend from get getting give go going gone good
    got great guy had has have having he hear hello help her here hey him his home hope how i i'd
    i'll i'm i've if in into is isn't it it's its just keep kind know last later leave left let
    let's life like little live look looking lot love made make man many maybe me mean might mom
    more most much must my myself name need never new next nice night no not nothing now of off oh
    okay old on once one only or other our out over own people place please pretty probably put
    really right run said same saw say see seem she she's should show side since so some somebody
    someone something sorry still stop sure take talk tell than thank that that's the their them
    then there there's these they they're thing think this those though thought three through time
    to today together told too took two up us use very wait want wanted was way we we'll we're
    we've well went were what what's when where which while who why will with without woman won't
    work would yeah year yes yet you you'd you'll you're you've your
  `.trim().split(/\s+/));

  const CEFR_LEVELS = Object.freeze(["b1", "b2", "c1", "c2"]);
  const DEFAULT_LEARNING_LEVELS = Object.freeze(["c1", "c2"]);
  const LEVEL_RANK = Object.freeze({ b1: 1, b2: 2, c1: 3, c2: 4 });
  const LEVEL_WORDS = Object.freeze({
    b1: `
      accident achieve advantage advice afford ahead alive allow alone although amaze announce
      apologize appear apply argue arrange avoid behave belong borrow brave breathe cancel cause
      celebrate certain chance choice collect common compare complain contact continue control
      decide describe destroy develop discover education embarrass environment event explain fair
      famous imagine improve include invite journey local manage mention message necessary opinion
      ordinary organize patient perhaps prepare prevent promise protect realize receive remind
      repair return save serious share simple strange suggest surprise trouble useful
      activity adventure afternoon airport apartment arrive audience beautiful bicycle birthday
      boring building business college conversation cooking country culture dangerous daughter
      dictionary different difficult doctor early evening example excited exciting exercise
      expensive experience favorite finish forget future garden happen holiday hospital husband
      idol admire artifact mysterious explanation important information interesting interview
      language magazine medicine meeting museum newspaper parent photograph picture popular
      possible problem restaurant school science shopping situation station student subject
      teacher television theater theatre tomorrow traffic travel understand university vacation
      vegetable village weather weekend yesterday
    `,
    b2: `
      absolutely academic accurate acknowledge adapt adequate alternative apparent appropriate
      assume atmosphere attitude aware benefit circumstance commitment complex concentrate concern
      confident consequence considerable constant contribute convince criticism demonstrate deny
      determine effective emotional encourage establish estimate evidence exceptional expectation
      familiar feature financial frequently fundamental generate identify ignore immediate impact
      indicate influence insist intention interpret involve maintain mental obvious opportunity
      persuade practical principle process recognize recommend recover relevant require response
      reveal significant solution specific struggle sufficient tendency threaten typical willing
      reluctant resilient obstacle inevitable
    `,
    c1: `
      abolish absurd accelerate accomplish accumulate acknowledge advocate allocate ambiguous
      anticipate arbitrary articulate assess attain authentic bias coherent compelling conceal
      contradict controversial convey credible crucial deteriorate diminish elaborate encounter
      enhance ethical exceed explicit exploit facilitate feasible fluctuate formulate foster
      furthermore hypothesis imply incentive inevitable inhibit integral interpret justify
      manipulate meticulous notion obscure perceive persist plausible profound reinforce reluctant
      resolve restrict retain scrutiny sophisticated spontaneous substantial undergo undermine
      institution bureaucratic justification convoluted
    `,
    c2: `
      aberration acquiesce ameliorate anachronism assiduous circumspect conundrum deleterious
      dichotomy disingenuous eclectic equivocation esoteric fastidious iconoclast idiosyncratic
      intransigence magnanimous mendacious obfuscate ostensible paradigm perspicacious pernicious
      quintessential recalcitrant sagacious sycophant ubiquitous vacillate extraordinarily
    `,
  });
  const WORD_LEVEL = new Map();
  for (const [level, words] of Object.entries(LEVEL_WORDS)) {
    for (const word of words.trim().split(/\s+/)) WORD_LEVEL.set(word, level);
  }
  const C2_ENDING = /(?:escence|escent|ification|istically|istically|ological|iously)$/;
  const C1_ENDING = /(?:ability|ibility|ential|ically|ication|ology|tious|acious|ality|arian|esque)$/;
  const B2_ENDING = /(?:ation|ical|atic|sion|tion|ment|ness|ship|ism|ist|ity|ive|ous|ary|ory)$/;
  const LEARNING_WORD = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

  const normalizeLearningWord = (word) => String(word || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/^[^a-z]+|[^a-z]+$/g, "");

  const learningLemmaCandidates = (word) => {
    const value = normalizeLearningWord(word);
    const candidates = [];
    if (IRREGULAR[value]) candidates.push(IRREGULAR[value]);
    if (value.endsWith("ies") && value.length > 4) candidates.push(`${value.slice(0, -3)}y`);
    if (value.endsWith("ves") && value.length > 4) {
      candidates.push(`${value.slice(0, -3)}f`, `${value.slice(0, -3)}fe`);
    }
    if (value.endsWith("ing") && value.length > 5) {
      const base = value.slice(0, -3);
      candidates.push(base, `${base}e`);
      if (/([a-z])\1$/.test(base)) candidates.push(base.slice(0, -1));
    }
    if (value.endsWith("ed") && value.length > 4) {
      const base = value.slice(0, -2);
      candidates.push(base, `${base}e`);
      if (/([a-z])\1$/.test(base)) candidates.push(base.slice(0, -1));
    }
    if (value.endsWith("es") && value.length > 4) candidates.push(value.slice(0, -2));
    if (value.endsWith("s") && value.length > 3 && !/(?:ss|us|is|ous)$/.test(value)) {
      candidates.push(value.slice(0, -1));
    }
    candidates.push(value);
    return [...new Set(candidates.filter(Boolean))];
  };

  const classifyLearningWord = (word) => {
    const normalized = normalizeLearningWord(word);
    if (!normalized || normalized.length < 5 || normalized.includes("'") || BASIC_WORDS.has(normalized)) {
      return null;
    }

    const candidates = learningLemmaCandidates(normalized);
    for (const candidate of candidates) {
      if (BASIC_WORDS.has(candidate)) return null;
      if (WORD_LEVEL.has(candidate)) return WORD_LEVEL.get(candidate);
    }

    const basis = candidates.reduce((shortest, candidate) => (
      candidate.length < shortest.length ? candidate : shortest
    ), normalized);
    let rank = basis.length >= 13 ? 4 : basis.length >= 10 ? 3 : basis.length >= 8 ? 2 : 1;
    if (C2_ENDING.test(basis)) rank = Math.max(rank, 4);
    else if (C1_ENDING.test(basis)) rank = Math.max(rank, 3);
    else if (B2_ENDING.test(basis)) rank = Math.max(rank, 2);
    return CEFR_LEVELS[rank - 1];
  };

  const normalizeSelectionOptions = (options) => {
    if (typeof options === "number") {
      return { limit: options, levels: CEFR_LEVELS };
    }
    const requested = Array.isArray(options?.levels) ? options.levels : DEFAULT_LEARNING_LEVELS;
    return {
      limit: options?.limit ?? 3,
      levels: requested.filter((level) => LEVEL_RANK[level]),
    };
  };

  const selectDifficultWords = (text, options = {}) => {
    const source = String(text || "");
    const candidates = [];
    const seen = new Set();
    const { limit, levels } = normalizeSelectionOptions(options);
    const selectedLevels = new Set(levels);
    const safeLimit = Math.max(0, Math.min(5, Number(limit) || 0));

    for (const match of source.matchAll(LEARNING_WORD)) {
      const original = match[0];
      const normalized = normalizeLearningWord(original);
      if (
        !normalized
        || seen.has(normalized)
      ) continue;

      // Title-cased words away from the beginning of a cue are usually character or place names.
      if (match.index > 0 && /^[A-Z][a-z]+$/.test(original)) continue;

      const level = classifyLearningWord(normalized);
      if (!level || !selectedLevels.has(level)) continue;

      seen.add(normalized);
      candidates.push({ original, normalized, level, rank: LEVEL_RANK[level], index: match.index });
    }

    return candidates
      .sort((left, right) => right.rank - left.rank || left.index - right.index)
      .slice(0, safeLimit)
      .sort((left, right) => left.index - right.index)
      .map((candidate) => candidate.original);
  };

  const lemmaCandidates = learningLemmaCandidates;

  const normalizeLookupContext = (options = {}) => ({
    sentence: PST.normalizeSubtitle(options.sentence),
    context: (Array.isArray(options.context) ? options.context : [])
      .map((line) => PST.normalizeSubtitle(line))
      .filter(Boolean)
      .slice(-4),
  });

  class DictionaryService {
    constructor(translator) {
      this.translator = translator;
      this.cache = new Map();
      this.inFlight = new Map();
    }

    async lookup(word, settings, options = {}) {
      const normalized = String(word || "").toLowerCase().replace(/[^a-z'-]/g, "");
      if (!normalized) return null;
      const lookupContext = normalizeLookupContext(options);
      const key = [
        normalized,
        settings.engine,
        lookupContext.sentence,
        lookupContext.context.join("\n"),
      ].join("\u0000");
      if (this.cache.has(key)) return this.cache.get(key);
      if (this.inFlight.has(key)) return this.inFlight.get(key);

      const request = this.lookupUncached(normalized, settings, lookupContext, key);
      this.inFlight.set(key, request);
      try {
        return await request;
      } finally {
        if (this.inFlight.get(key) === request) this.inFlight.delete(key);
      }
    }

    async lookupUncached(normalized, settings, lookupContext, key) {
      const candidates = lemmaCandidates(normalized);
      let dictionaryResponse = null;
      let dictionarySettled = false;
      const dictionaryPromise = PST.safeSendMessage({
        type: "DICTIONARY_LOOKUP",
        candidates,
      }).then((response) => {
        dictionaryResponse = response;
        dictionarySettled = true;
        return response;
      }, () => {
        dictionarySettled = true;
        return null;
      });
      const contextualResponse = lookupContext.sentence
        ? await PST.safeSendMessage({
          type: "CONTEXTUAL_WORD_LOOKUP",
          word: normalized,
          sentence: lookupContext.sentence,
          context: lookupContext.context,
        })
        : null;
      // A contextual result already contains the selected meaning and definition.
      // Do not hold the card open on a slower third-party phonetic lookup.
      if (!contextualResponse?.ok && !dictionarySettled) {
        dictionaryResponse = await dictionaryPromise;
      }
      const entry = dictionaryResponse?.ok ? dictionaryResponse.entry : null;
      const contextual = contextualResponse?.ok ? contextualResponse.entry : null;
      const lemma = String(contextual?.lemma || entry?.word || candidates.at(-1) || normalized)
        .toLowerCase()
        .replace(/[^a-z'-]/g, "") || normalized;

      let gloss = String(contextual?.meaningZh || "").trim();
      if (!gloss) {
        try {
          gloss = await this.translator.translate(lemma, settings);
        } catch {
          // Return dictionary details for hover cards, but do not cache a missing
          // translation so a later user activation can retry the local translator.
          gloss = "";
        }
      }

      const contextualDefinition = String(contextual?.definitionEn || "").trim();
      const definition = contextualDefinition || entry?.definitions?.[0]?.definition || "";
      const result = {
        original: normalized,
        lemma,
        phrase: String(contextual?.phrase || "").trim(),
        phonetic: entry?.phonetic || "",
        partOfSpeech: String(contextual?.partOfSpeech || entry?.definitions?.[0]?.partOfSpeech || "word"),
        gloss,
        definition,
        contextual: Boolean(contextual && gloss),
      };
      // Contextual results are stable for this exact subtitle. A fallback gloss
      // is deliberately not cached so a temporarily unavailable backend can be
      // retried on the next hover.
      if (contextual && gloss) {
        this.cache.set(key, result);
        if (!dictionarySettled) {
          dictionaryPromise.then((response) => {
            const dictionaryEntry = response?.ok ? response.entry : null;
            if (!dictionaryEntry || this.cache.get(key) !== result) return;
            this.cache.set(key, {
              ...result,
              phonetic: dictionaryEntry.phonetic || result.phonetic,
              definition: result.definition || dictionaryEntry.definitions?.[0]?.definition || "",
            });
          });
        }
      }
      return result;
    }

    async lookupMany(words, settings, options = {}) {
      const entries = await Promise.all((words || []).map(async (word) => {
        try {
          return await this.lookup(word, settings, options);
        } catch {
          return null;
        }
      }));
      return entries.filter((entry) => entry?.gloss);
    }
  }

  PST.lemmaCandidates = lemmaCandidates;
  PST.classifyLearningWord = classifyLearningWord;
  PST.selectDifficultWords = selectDifficultWords;
  PST.DictionaryService = DictionaryService;
})();
