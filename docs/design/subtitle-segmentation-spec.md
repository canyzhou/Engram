# Subtitle Segmentation Specification

## 1. Goal

Engram must turn YouTube caption timelines into stable learning units without
making the on-screen subtitle too long. Display readability and semantic
context are separate requirements and must not share a single cue model.

This specification applies to captured YouTube captions. Other providers keep
their existing cue boundaries unless a provider-specific segmenter is added.

## 2. Data model

The capture pipeline exposes two synchronized timelines:

- `displayCues`: short, time-accurate units used by the video overlay.
- `cues`: semantic sentence or speaker-turn units used by the transcript,
  previous/next sentence navigation, translation context, and lesson analysis.

Both timelines are derived from immutable timed atoms:

```js
{
  start: 92.4,
  end: 94.1,
  text: "how do you like flying the katana",
  speakerBreak: false,
}
```

Repeated `>>` markers are removed from visible text only after their boundary
meaning has been preserved as `speakerBreak`.

YouTube word offsets are preserved when the JSON3 track provides them. When one
long automatic-caption event has no word offsets, Engram expands it into word
atoms and estimates their timing proportionally.
The global segmenter therefore chooses among every word boundary instead of
committing to an earlier character-count split.

A YouTube timed-text response is treated as a complete track snapshot. A newer
snapshot atomically replaces the older snapshot for the same video; it is never
appended to a differently segmented copy. Authored captions cannot be replaced
by a later automatic-caption response.

## 3. Source policy

1. Authored captions are preferred over automatic captions.
2. Authored cue boundaries remain the display timeline; semantic sentences may
   span adjacent authored cues.
3. Automatic captions are deduplicated, then resegmented using timing, speaker,
   punctuation, and lexical boundary evidence.
4. If segmentation fails, Engram falls back to the normalized source cues.
5. Segmentation never invents, deletes, or rewrites spoken words.

## 4. Automatic-caption display rules

The complete timeline is segmented globally instead of making a final decision
as each word arrives. Candidate boundaries receive higher preference for:

1. A speaker change.
2. Terminal punctuation.
3. A real pause between the end of one atom and the start of the next.
4. A pause followed by a common question, answer, or discourse starter.
5. Clause punctuation such as a comma, semicolon, colon, or dash.

Boundaries are penalized when they create a one- or two-word fragment or end
after an incomplete function word such as `the`, `to`, `of`, or `can`.
They are also penalized before tightly bound continuation words (`of Texas`),
after modifiers (`modern civilization`), quantities (`three years`), and verbs
that still require a complement (`explore Alaska`).

Display targets:

- preferred duration: 2–7 seconds;
- hard duration ceiling: 10 seconds, except for one indivisible source atom;
- preferred text length: at most 84 characters;
- hard text ceiling: 120 characters, except for one indivisible source atom;
- preferred minimum: 3 words, unless a speaker turn is naturally shorter.

Capitalization alone is not boundary evidence because automatic captions are
commonly lowercase.

## 5. Semantic sentence rules

Adjacent display cues remain in the same semantic sentence until one of these
boundaries occurs:

- speaker change;
- terminal punctuation;
- meaningful pause;
- semantic safety ceiling of 22 seconds or 180 characters;
- end of timeline.

Each semantic cue retains the texts of its member display cues so existing
per-display-cue translations can be combined in the transcript without changing
the captured source text.

## 6. Consumers

- The on-video subtitle uses `displayCues`.
- The transcript, lesson analysis, discussion grounding, and previous/next
  sentence controls use `cues`.
- Word lookup uses the active semantic sentence while highlighting only words
  visible in the current display cue.
- Existing callers that do not provide `displayCues` fall back to `cues`.

## 7. AI enhancement

AI segmentation is not part of the initial implementation. A future enhancer
may return boundary atom IDs only. It must not return replacement transcript
text or timestamps. The local result remains immediately available and is the
fallback for timeout, validation failure, or offline use.

Audio retranscription is reserved for missing or materially inaccurate source
captions, not ordinary sentence-boundary repair.

## 8. Acceptance criteria

- A lowercase, unpunctuated 121-character automatic caption is split into
  readable cues instead of falling through the 120–170 character gap.
- Pauses and speaker markers split lowercase dialogue without requiring an
  uppercase next word.
- A long grammatical sentence may use multiple display cues while remaining
  one semantic sentence.
- Authored captions keep their source display timing.
- All output text, in order, equals the normalized captured text.
- Display and semantic timelines remain sorted, bounded, and seekable.
- The learning UI falls back to `cues` when `displayCues` is absent.
