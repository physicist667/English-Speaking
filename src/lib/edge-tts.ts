// Microsoft Edge Read Aloud TTS — нейронные голоса нового поколения (естественные, человеческие).
// Собственный WS-клиент протокола (speech.config → ssml → бинарные audio-фреймы до turn.end).
// ТОЛЬКО сервер (Node runtime): использует пакет ws и crypto.
import WebSocket from 'ws'
import crypto from 'crypto'

const TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WIN_EPOCH = 11644473600
const GEC_VERSION = '1-143.0.3650.96'

/** Токен Sec-MS-GEC: SHA-256 от Windows FILETIME (100-нс тики), округлённого к 5 минутам, + trusted token */
function generateSecMsGec(): string {
  let ticks = Math.floor(Date.now() / 1000) + WIN_EPOCH
  ticks -= ticks % 300
  ticks = ticks * 10_000_000
  return crypto
    .createHash('sha256')
    .update(`${ticks}${TRUSTED_TOKEN}`, 'ascii')
    .digest('hex')
    .toUpperCase()
}

function uuidNoDash(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;')
}

/** Синтез одной фразы → MP3 (audio-24khz-48kbitrate-mono-mp3) */
export function edgeSynthesize(text: string, voiceName: string, timeoutMs = 20000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reqId = uuidNoDash()
    const url =
      `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
      `?TrustedClientToken=${TRUSTED_TOKEN}` +
      `&Sec-MS-GEC=${generateSecMsGec()}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${reqId}`

    let ws: WebSocket
    try {
      ws = new WebSocket(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        },
        handshakeTimeout: timeoutMs,
      })
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
      return
    }
    ws.binaryType = 'arraybuffer'

    const audioChunks: Buffer[] = []
    let settled = false
    const finish = (err: Error | null, buf?: Buffer) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* noop */
      }
      if (err) reject(err)
      else resolve(buf as Buffer)
    }

    const timer = setTimeout(() => finish(new Error('edge tts timeout')), timeoutMs)

    ws.on('open', () => {
      const ts = new Date().toISOString()
      ws.send(
        `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
                },
              },
            },
          })
      )
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${voiceName}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`
      ws.send(
        `X-RequestId:${uuidNoDash()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`
      )
    })

    ws.on('message', (data: unknown, isBinary: boolean) => {
      if (isBinary) {
        const buf = Buffer.from(data as ArrayBuffer)
        if (buf.length < 2) return
        const headerLen = buf.readUInt16BE(0)
        const headers = buf.slice(2, 2 + headerLen).toString()
        if (headers.includes('Path:audio')) {
          const payload = buf.slice(2 + headerLen)
          if (payload.length > 0) audioChunks.push(payload)
        }
      } else if (String(data).includes('Path:turn.end')) {
        if (audioChunks.length === 0) finish(new Error('edge tts: no audio'))
        else finish(null, Buffer.concat(audioChunks))
      }
    })

    ws.on('error', (e) => finish(e instanceof Error ? e : new Error(String(e))))
    ws.on('close', () => {
      if (!settled) {
        if (audioChunks.length > 0) finish(null, Buffer.concat(audioChunks))
        else finish(new Error('edge tts: connection closed before audio'))
      }
    })
  })
}

/** Синтез с 2 попытками; возвращает null, если Edge недоступен (переключаемся на запасной движок) */
export async function edgeSynthesizeSafe(text: string, voiceName: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await edgeSynthesize(text, voiceName)
    } catch (e) {
      console.warn(
        `edge tts attempt ${attempt + 1} failed:`,
        e instanceof Error ? e.message : e
      )
    }
  }
  return null
}
