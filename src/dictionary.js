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

  const DIFFICULT_ENDING = /(?:ability|ation|ential|ically|ibility|ication|ology|phobia|tious|acious|escence|ical|atic|sion|tion|ment|ness|ship|ism|ist|ity|ive|ous|ary|ory)$/;
  const LEARNING_WORD = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

  const normalizeLearningWord = (word) => String(word || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/^[^a-z]+|[^a-z]+$/g, "");

  const selectDifficultWords = (text, limit = 3) => {
    const source = String(text || "");
    const candidates = [];
    const seen = new Set();
    const safeLimit = Math.max(0, Math.min(5, Number(limit) || 0));

    for (const match of source.matchAll(LEARNING_WORD)) {
      const original = match[0];
      const normalized = normalizeLearningWord(original);
      if (
        !normalized
        || normalized.length < 5
        || normalized.includes("'")
        || BASIC_WORDS.has(normalized)
        || seen.has(normalized)
      ) continue;

      // Title-cased words away from the beginning of a cue are usually character or place names.
      if (match.index > 0 && /^[A-Z][a-z]+$/.test(original)) continue;

      seen.add(normalized);
      let score = 1;
      if (normalized.length >= 7) score += 1;
      if (normalized.length >= 10) score += 1;
      if (DIFFICULT_ENDING.test(normalized)) score += 2;
      candidates.push({ original, normalized, score, index: match.index });
    }

    return candidates
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, safeLimit)
      .sort((left, right) => left.index - right.index)
      .map((candidate) => candidate.original);
  };

  const lemmaCandidates = (word) => {
    const value = String(word || "").toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
    const candidates = [value];
    if (IRREGULAR[value]) candidates.push(IRREGULAR[value]);
    if (value.endsWith("ies") && value.length > 4) candidates.push(`${value.slice(0, -3)}y`);
    if (value.endsWith("ves") && value.length > 4) candidates.push(`${value.slice(0, -3)}f`);
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
    if (value.endsWith("s") && value.length > 3) candidates.push(value.slice(0, -1));
    return [...new Set(candidates.filter(Boolean))];
  };

  class DictionaryService {
    constructor(translator) {
      this.translator = translator;
      this.cache = new Map();
    }

    async lookup(word, settings) {
      const normalized = String(word || "").toLowerCase().replace(/[^a-z'-]/g, "");
      if (!normalized) return null;
      const key = `${normalized}:${settings.engine}`;
      if (this.cache.has(key)) return this.cache.get(key);

      const response = await PST.safeSendMessage({
        type: "DICTIONARY_LOOKUP",
        candidates: lemmaCandidates(normalized),
      });
      const entry = response?.ok ? response.entry : null;
      const lemma = entry?.word || lemmaCandidates(normalized).at(-1) || normalized;

      let gloss = "";
      try {
        gloss = await this.translator.translate(lemma, settings);
      } catch {
        // Return dictionary details for hover cards, but do not cache a missing
        // translation so a later user activation can retry the local translator.
        gloss = "";
      }

      const definition = entry?.definitions?.[0]?.definition || "";
      const result = {
        original: normalized,
        lemma,
        phonetic: entry?.phonetic || "",
        partOfSpeech: entry?.definitions?.[0]?.partOfSpeech || "word",
        gloss,
        definition,
      };
      if (gloss) this.cache.set(key, result);
      return result;
    }

    async lookupMany(words, settings) {
      const entries = await Promise.all((words || []).map(async (word) => {
        try {
          return await this.lookup(word, settings);
        } catch {
          return null;
        }
      }));
      return entries.filter((entry) => entry?.gloss);
    }
  }

  PST.lemmaCandidates = lemmaCandidates;
  PST.selectDifficultWords = selectDifficultWords;
  PST.DictionaryService = DictionaryService;
})();
