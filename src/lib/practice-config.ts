// Общий конфиг практики (клиент + сервер, только данные)

export type LevelId = 'gentle' | 'casual' | 'native' | 'hardcore'

export interface LevelMeta {
  id: LevelId
  label: string
  description: string
  ttsSpeed: number
  /** Инструкция для LLM о характере речи (не словарный запас, а манера речи) */
  prompt: string
}

export const LEVELS: LevelMeta[] = [
  {
    id: 'gentle',
    label: 'Мягкий старт',
    description: 'Медленная ясная речь, короткие простые фразы, поддержка и наводящие вопросы',
    ttsSpeed: 0.85,
    prompt:
      'Speak SLOWLY and CLEARLY, like a patient friendly teacher talking with a beginner. ' +
      'Use short simple sentences (5-10 words), plain everyday structure. ' +
      'Be warm and encouraging: praise effort, gently rephrase when the learner struggles, ask simple guiding questions to keep them talking. ' +
      'Avoid idioms, slang and complex grammar. Standard neutral pronunciation.',
  },
  {
    id: 'casual',
    label: 'Обычный разговор',
    description: 'Естественный темп, живая повседневная речь, лёгкие разговорные фразочки',
    ttsSpeed: 1.0,
    prompt:
      'Speak naturally at a relaxed normal conversational pace, like a friendly native speaker chatting with someone they just met. ' +
      'Use everyday expressions and common contractions. Medium-length sentences. ' +
      'React naturally with short reactions (Oh nice!, Really?, That makes sense) and follow-up questions. ' +
      'Light use of fillers like "well", "you know", "actually".',
  },
  {
    id: 'native',
    label: 'Быстрый носитель',
    description: 'Живой темп, идиомы, сокращения, слова-паразиты — как в разговоре с другом',
    ttsSpeed: 1.1,
    prompt:
      'Speak like a native speaker talking quickly and naturally with a friend. ' +
      'Use idioms, phrasal verbs, contractions, filler words ("well", "you know", "kinda", "sorta", "like", "honestly"), casual structures, ' +
      'sometimes trailing off or self-correcting mid-sentence like real spontaneous speech. ' +
      'Keep the pace brisk and topics lively. Do NOT slow down or simplify for the learner.',
  },
  {
    id: 'hardcore',
    label: 'Хардкор',
    description: 'Очень быстрая речь, сленг, сарказм, резкие смены темы — как у носителя в жизни',
    ttsSpeed: 1.25,
    prompt:
      'Speak like a hyper-fast, chatty big-city native. Heavy slang and colloquialisms, playful sarcasm and teasing, ' +
      'rapid topic changes, cultural references, interjections and interruptions ("wait wait", "oh hold on", "no way"). ' +
      'Use run-on sentences and explosive reactions like real unfiltered native speech. Never simplify.',
  },
]

export function getLevel(id: string): LevelMeta {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[1]
}

export interface VoiceMeta {
  id: string
  label: string
  hint: string
  /** Microsoft Edge нейроголос (движок №1 — максимально естественный) */
  edge: string
  /** Локаль Google TTS (движок №2, запасной) */
  googleTl: 'en' | 'en-GB'
}

// Нейроголоса Microsoft Edge (Read Aloud) — звучат как живой человек.
// Если Edge недоступен, автоматически используется Google TTS с тем же акцентом.
export const VOICES: VoiceMeta[] = [
  { id: 'ava', label: 'Ava · США, женский', hint: 'мягкий, очень естественный', edge: 'en-US-AvaMultilingualNeural', googleTl: 'en' },
  { id: 'andrew', label: 'Andrew · США, мужской', hint: 'уверенный и тёплый', edge: 'en-US-AndrewMultilingualNeural', googleTl: 'en' },
  { id: 'emma', label: 'Emma · США, женский', hint: 'яркий и живой', edge: 'en-US-EmmaMultilingualNeural', googleTl: 'en' },
  { id: 'brian', label: 'Brian · США, мужской', hint: 'молодой, дружелюбный', edge: 'en-US-BrianMultilingualNeural', googleTl: 'en' },
  { id: 'sonia', label: 'Sonia · Британия, жен.', hint: 'британский акцент', edge: 'en-GB-SoniaNeural', googleTl: 'en-GB' },
  { id: 'ryan', label: 'Ryan · Британия, муж.', hint: 'британский акцент', edge: 'en-GB-RyanNeural', googleTl: 'en-GB' },
]

export function getVoice(id: string): VoiceMeta {
  return VOICES.find((v) => v.id === id) ?? VOICES[0]
}

// ---------- Словарный запас (vocabulary) ----------

export type VocabId = 'basic' | 'intermediate' | 'advanced'

export interface VocabMeta {
  id: VocabId
  label: string
  description: string
  /** Инструкция для LLM о том, какими словами говорить */
  prompt: string
}

export const VOCAB_LEVELS: VocabMeta[] = [
  {
    id: 'basic',
    label: 'Простой (A1–A2)',
    description: 'Только самые частые повседневные слова, короткие знакомые фразы',
    prompt:
      'Use ONLY the most frequent everyday English words (roughly the top 1500 words). ' +
      'Prefer short familiar words over precise ones ("big" not "enormous", "get" not "obtain"). ' +
      'If you need a complex idea, express it with simple words. Avoid idioms, slang, rare, academic or fancy words entirely. ' +
      'It is fine to repeat the same simple words often.',
  },
  {
    id: 'intermediate',
    label: 'Средний (B1–B2)',
    description: 'Обычная разговорная лексика, иногда новые слова в контексте',
    prompt:
      'Use natural everyday conversational vocabulary with a moderate range: common phrasal verbs, a few vivid adjectives, ' +
      'occasionally one slightly richer word or common idiom introduced naturally in context (the learner can often guess it from context). ' +
      'Do not stack many advanced words in one sentence. Keep the overall flow simple and clear.',
  },
  {
    id: 'advanced',
    label: 'Богатый (C1+)',
    description: 'Полный словарь носителя: идиомы, точные слова, устойчивые связки',
    prompt:
      'Use full native-speaker vocabulary: precise and vivid word choice, idioms, collocations, expressive phrasing. ' +
      'Do not simplify your vocabulary for the learner — rich, natural word choice is the point of this setting.',
  },
]

export function getVocabLevel(id: string): VocabMeta {
  return VOCAB_LEVELS.find((v) => v.id === id) ?? VOCAB_LEVELS[1]
}

export const SPEED_MIN = 0.5
export const SPEED_MAX = 2.0
