// POST /api/tts — озвучка текста естественным человеческим голосом.
// Цепочка движков (первый доступный побеждает):
//   1. Microsoft Edge Read Aloud (нейроголоса Ava/Andrew/Emma/Brian/Sonia/Ryan) — максимально живой голос
//   2. Google Translate TTS — запасной, тот же акцент (en / en-GB)
//   3. z-ai-web-dev-sdk TTS — последний резерв
// Скорость/темп регулируется на КЛИЕНТЕ через audio.playbackRate с сохранением питча.
import { NextRequest, NextResponse } from 'next/server'
import { getVoice } from '@/lib/practice-config'
import { edgeSynthesizeSafe } from '@/lib/edge-tts'
import { getZAI } from '@/lib/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // лимит серверлесс-функции на Vercel (TTS-цепочка с ретраями)

const MAX_CHUNK = 900
const GOOGLE_CHUNK = 190

function makeWavHeader(dataLen: number, sampleRate = 24000, channels = 1, bits = 16): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataLen, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE((sampleRate * channels * bits) / 8, 28)
  header.writeUInt16LE((channels * bits) / 8, 32)
  header.writeUInt16LE(bits, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataLen, 40)
  return header
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text]
  const chunks: string[] = []
  let current = ''
  for (const s of sentences) {
    if ((current + s).length <= maxLen) {
      current += s
    } else {
      if (current.trim()) chunks.push(current.trim())
      if (s.length <= maxLen) {
        current = s
      } else {
        // очень длинное «предложение» — режем по словам
        let tail = s
        while (tail.length > maxLen) {
          let cut = tail.lastIndexOf(' ', maxLen)
          if (cut <= 0) cut = maxLen
          chunks.push(tail.slice(0, cut).trim())
          tail = tail.slice(cut)
        }
        current = tail
      }
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

function audioResponse(audio: Buffer, contentType: string, engine: string) {
  return new NextResponse(new Uint8Array(audio), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(audio.length),
      'Cache-Control': 'no-cache',
      'X-TTS-Engine': engine,
    },
  })
}

/** Движок 1: Microsoft Edge нейроголос */
async function tryEdge(text: string, edgeVoice: string): Promise<Buffer | null> {
  const chunks = splitIntoChunks(text, MAX_CHUNK)
  const parts: Buffer[] = []
  for (const chunk of chunks) {
    const buf = await edgeSynthesizeSafe(chunk, edgeVoice)
    if (!buf) return null
    parts.push(buf)
  }
  return Buffer.concat(parts)
}

/** Движок 2: Google Translate TTS (чанки ≤190 символов, склейка MP3) */
async function tryGoogle(text: string, tl: string): Promise<Buffer | null> {
  try {
    const chunks = splitIntoChunks(text, GOOGLE_CHUNK)
    const parts: Buffer[] = []
    for (const chunk of chunks) {
      const url =
        `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}` +
        `&q=${encodeURIComponent(chunk)}`
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Referer: 'https://translate.google.com/',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return null
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 512) return null
      parts.push(buf)
    }
    return Buffer.concat(parts)
  } catch {
    return null
  }
}

/** Движок 3 (резерв): z-ai SDK → PCM → WAV */
async function trySdk(text: string): Promise<Buffer | null> {
  try {
    const zai = await getZAI()
    const chunks = splitIntoChunks(text, MAX_CHUNK)
    const buffers: Buffer[] = []
    for (const chunk of chunks) {
      const response = await zai.audio.tts.create({
        input: chunk,
        voice: 'jam',
        speed: 1.0,
        response_format: 'pcm',
        stream: false,
      })
      buffers.push(Buffer.from(new Uint8Array(await response.arrayBuffer())))
    }
    const pcm = Buffer.concat(buffers)
    return Buffer.concat([makeWavHeader(pcm.length), pcm])
  } catch (e) {
    console.error('sdk tts failed:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice: rawVoice } = await req.json()

    const cleanText = String(text ?? '')
      .replace(/[*_#`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleanText) {
      return NextResponse.json({ error: 'Пустой текст' }, { status: 400 })
    }

    const voice = getVoice(String(rawVoice ?? 'ava'))

    // 1) Edge нейроголос — самый естественный
    const edgeAudio = await tryEdge(cleanText, voice.edge)
    if (edgeAudio) return audioResponse(edgeAudio, 'audio/mpeg', `edge:${voice.edge}`)

    // 2) Google TTS — запасной
    const googleAudio = await tryGoogle(cleanText, voice.googleTl)
    if (googleAudio) return audioResponse(googleAudio, 'audio/mpeg', `google:${voice.googleTl}`)

    // 3) SDK — последний резерв
    const sdkAudio = await trySdk(cleanText)
    if (sdkAudio) return audioResponse(sdkAudio, 'audio/wav', 'sdk')

    return NextResponse.json({ error: 'Не удалось озвучить текст' }, { status: 502 })
  } catch (err) {
    console.error('tts error:', err)
    return NextResponse.json({ error: 'Не удалось озвучить текст' }, { status: 500 })
  }
}
