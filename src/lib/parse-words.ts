// Парсер текста со словами (файл или вставка).
// Поддерживает форматы на строку:
//   apple - яблоко | apple: яблоко | apple, яблоко | apple; яблоко
//   apple = яблоко | apple (яблоко) | apple<TAB>яблоко | apple
//   "1. apple - яблоко" (нумерация), пропускает строки-заголовки (word/слово/перевод/translation)

export interface ParsedWord {
  word: string
  translation?: string | null
}

const HEADER_RE = /^(word|words|слово|слова|english|term|термин)\s*[,;=:|\t-]?\s*(translation|translate|перевод|переводы|значение|russian|ru)?\s*$/i

export function parseWordsFromText(content: string, limit = 500): ParsedWord[] {
  const out: ParsedWord[] = []
  const seen = new Set<string>()
  const lines = content.split(/\r?\n/)

  for (const rawLine of lines) {
    if (out.length >= limit) break

    let line = rawLine.trim()
    if (!line) continue

    // убрать CSV-кавычки
    line = line.replace(/^"(.*)"$/, '$1').trim()
    if (!line || HEADER_RE.test(line)) continue

    // убрать нумерацию в начале: "1.", "2)", "3 -", "01)", "12 "
    line = line.replace(/^\s*\d{1,3}[.)\]]\s*/, '')
    line = line.replace(/^\s*\d{1,3}\s*[-–—:]\s*/, '')
    // буллеты
    line = line.replace(/^[-•*·]\s+/, '')
    if (!line) continue

    let word = ''
    let translation = ''

    // "word (translation)"
    const parens = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
    if (parens) {
      word = parens[1]
      translation = parens[2]
    } else {
      // разделители по приоритету: TAB, =, ;, " - ", ":", ","
      const seps: [RegExp, number | undefined][] = [
        [/\t/, undefined],
        [/\s*=\s*/, undefined],
        [/\s*;\s*/, undefined],
        [/\s+[-–—]\s+/, undefined],
        [/:\s+/, undefined],
        [/,\s*/, undefined],
      ]
      let matched = false
      for (const [re] of seps) {
        const m = line.split(re)
        if (m.length >= 2 && m[0].trim() && m.slice(1).join(',').trim()) {
          word = m[0]
          translation = m.slice(1).join(', ')
          matched = true
          break
        }
      }
      if (!matched) word = line
    }

    word = word.trim().replace(/^["']|["']$/g, '').trim()
    translation = (translation || '').trim().replace(/^["']|["']$/g, '').trim()

    if (!word || word.length > 80) continue
    // слово не должно содержать предложение-разделители (защита от мусора)
    if (/[.!?]{1}$/.test(word) && word.split(/\s+/).length > 6) continue

    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      word,
      translation: translation || null,
    })
  }

  return out
}
