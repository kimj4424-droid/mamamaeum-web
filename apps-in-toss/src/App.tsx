import { Clipboard, graniteEvent } from '@apps-in-toss/web-framework'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Mode = 'inbound' | 'outbound'
type Screen = 'compose' | 'consent' | 'loading' | 'result'
type Reply = { tone: string; text: string }
type ApiResult = { summary?: string; replies?: Reply[] }

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://mamamaeum-web.vercel.app').replace(/\/$/, '')
const CONSENT_KEY = 'mamamaeum-ai-processing-consent'

const prompts: Record<Mode, string> = {
  inbound: `너는 성인 자녀가 부모님에게 받은 카카오톡 메시지에 답장하도록 돕는 한국어 대화 도우미다. 비난하거나 단정하지 말고, 감정적으로 힘든 상황은 안전과 도움을 우선하도록 안내해라. 반드시 아래 JSON만 출력해라. {"summary":"상황을 한 문장으로 공감해 설명","replies":[{"tone":"부드럽게","text":"답장"},{"tone":"분명하게","text":"답장"},{"tone":"마음을 담아","text":"답장"}]}`,
  outbound: `너는 성인 자녀가 부모님께 하고 싶은 말을 실제로 보낼 수 있는 한국어 문장으로 다듬어 주는 대화 도우미다. 비난하거나 단정하지 말고, 감정적으로 힘든 상황은 안전과 도움을 우선하도록 안내해라. 반드시 아래 JSON만 출력해라. {"summary":"상황을 한 문장으로 공감해 설명","replies":[{"tone":"부드럽게","text":"문장"},{"tone":"분명하게","text":"문장"},{"tone":"마음을 담아","text":"문장"}]}`,
}

function stripFence(value: string) {
  return value.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
}

function validResult(value: unknown): value is ApiResult {
  if (!value || typeof value !== 'object') return false
  const result = value as ApiResult
  return Array.isArray(result.replies) && result.replies.length > 0 && result.replies.every((reply) => reply?.tone && reply?.text)
}

async function readClipboard() {
  try {
    return await Clipboard.getText()
  } catch {
    return navigator.clipboard?.readText?.() ?? ''
  }
}

async function writeClipboard(text: string) {
  try {
    await Clipboard.setText(text)
  } catch {
    await navigator.clipboard?.writeText?.(text)
  }
}

export default function App() {
  const [mode, setMode] = useState<Mode>('inbound')
  const [screen, setScreen] = useState<Screen>('compose')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ApiResult | null>(null)
  const [notice, setNotice] = useState('')

  const title = mode === 'inbound' ? '부모님이 보낸 카톡' : '부모님께 하고 싶은 말'
  const placeholder = mode === 'inbound' ? '받은 메시지를 붙여넣어 주세요' : '아직 못 한 말을 편하게 적어 주세요'
  const canGenerate = message.trim().length > 0 && message.length <= 30000

  useEffect(() => {
    const unsubscribe = graniteEvent.addEventListener('backEvent', {
      onEvent: () => {
        if (screen === 'result' || screen === 'consent') setScreen('compose')
      },
    })
    return unsubscribe
  }, [screen])

  const consented = useMemo(() => {
    try {
      return localStorage.getItem(CONSENT_KEY) === 'v1'
    } catch {
      return false
    }
  }, [screen])

  async function paste() {
    const text = await readClipboard()
    if (!text) {
      setNotice('클립보드에 붙여넣을 텍스트가 없어요.')
      return
    }
    setMessage(text.slice(0, 30000))
    setNotice('')
  }

  async function generate() {
    if (!canGenerate) return
    if (!consented) {
      setScreen('consent')
      return
    }
    setScreen('loading')
    setNotice('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: prompts[mode],
          messages: [{ role: 'user', content: message.trim() }],
          max_tokens: 700,
        }),
      })
      if (!response.ok) throw new Error(`API ${response.status}`)
      const payload = await response.json()
      const text = payload.content?.find((block: { type?: string }) => block.type === 'text')?.text
      const parsed = text ? JSON.parse(stripFence(text)) : null
      if (!validResult(parsed)) throw new Error('invalid response')
      setResult(parsed)
      setScreen('result')
    } catch {
      setNotice('답장을 만들지 못했어요. 잠시 후 다시 시도해주세요.')
      setScreen('compose')
    }
  }

  function allowAiProcessing() {
    try {
      localStorage.setItem(CONSENT_KEY, 'v1')
    } catch {
      // 브라우저 저장소를 사용할 수 없어도 이번 요청은 계속 진행합니다.
    }
    void generateAfterConsent()
  }

  async function generateAfterConsent() {
    setScreen('loading')
    setNotice('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: prompts[mode], messages: [{ role: 'user', content: message.trim() }], max_tokens: 700 }),
      })
      if (!response.ok) throw new Error(`API ${response.status}`)
      const payload = await response.json()
      const text = payload.content?.find((block: { type?: string }) => block.type === 'text')?.text
      const parsed = text ? JSON.parse(stripFence(text)) : null
      if (!validResult(parsed)) throw new Error('invalid response')
      setResult(parsed)
      setScreen('result')
    } catch {
      setNotice('답장을 만들지 못했어요. 잠시 후 다시 시도해주세요.')
      setScreen('compose')
    }
  }

  if (screen === 'consent') {
    return <main className="page"><section className="card"><p className="eyebrow">AI 처리 안내</p><h1>답장을 만들기 전에 확인해 주세요</h1><p>입력한 내용은 답장 제안을 만들기 위해 엄마마음 서버를 거쳐 Anthropic AI API로 전송됩니다. 서비스는 원문과 결과를 별도로 저장하지 않지만, AI 제공자는 기본 정책에 따라 입력과 출력을 최대 30일 보관할 수 있습니다.</p><p className="muted">이름, 연락처, 주소, 금융정보 등 불필요한 개인정보는 가리고 입력해 주세요.</p></section><button className="primary" onClick={allowAiProcessing}>동의하고 답장 만들기</button><button className="textButton" onClick={() => setScreen('compose')}>돌아가기</button></main>
  }

  if (screen === 'loading') {
    return <main className="page centered"><div className="spinner" /><h1>마음을 담아 문장을 만들고 있어요</h1><p>잠시만 기다려 주세요.</p></main>
  }

  if (screen === 'result' && result) {
    return <main className="page"><header><p className="eyebrow">엄마마음</p><h1>이렇게 말해보는 건 어때요?</h1><p>{result.summary || '상대가 부담 없이 들을 수 있도록 여러 표현을 준비했어요.'}</p></header><section className="replyList">{result.replies?.map((reply) => <article className="replyCard" key={reply.tone}><span>{reply.tone}</span><p>{reply.text}</p><button className="secondary" onClick={() => void writeClipboard(reply.text).then(() => setNotice('문장을 복사했어요.'))}>문장 복사</button></article>)}</section>{notice && <p className="notice">{notice}</p>}<button className="primary" onClick={() => { setResult(null); setScreen('compose') }}>다시 입력하기</button></main>
  }

  return <main className="page"><header><p className="eyebrow">엄마마음</p><h1>부모님과의 대화,<br />조금 덜 어렵게</h1><p>말하기 어려운 마음을 부드러운 카톡 문장으로 정리해 드려요.</p></header><div className="tabs"><button className={mode === 'inbound' ? 'active' : ''} onClick={() => setMode('inbound')}>받은 카톡 답장</button><button className={mode === 'outbound' ? 'active' : ''} onClick={() => setMode('outbound')}>하고 싶은 말</button></div><section className="card"><label htmlFor="message">{title}</label><textarea id="message" value={message} maxLength={30000} onChange={(event) => setMessage(event.target.value)} placeholder={placeholder} /><div className="fieldFooter"><button className="secondary" onClick={() => void paste()}>클립보드에서 붙여넣기</button><span>{message.length.toLocaleString()} / 30,000</span></div></section>{notice && <p className="notice">{notice}</p>}<button className="primary" disabled={!canGenerate} onClick={() => void generate()}>답장 제안 받기</button><p className="privacy">입력 내용은 답장 생성에만 사용하며 서비스에 저장하지 않아요. <a href={`${API_BASE_URL}/privacy.html`} target="_blank" rel="noreferrer">개인정보 처리방침</a></p></main>
}
