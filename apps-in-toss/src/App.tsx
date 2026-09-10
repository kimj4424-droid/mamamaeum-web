import { Clipboard, graniteEvent } from '@apps-in-toss/web-framework'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Mode = 'inbound' | 'outbound'
type Screen = 'compose' | 'consent' | 'loading' | 'result' | 'feedback'
type Reply = { tone: string; strategy: string; text: string; expectedReaction: string }
type ApiResult = { summary?: string; replies?: Reply[] }
type Feedback = { category: string; message: string; contact: string; sending: boolean; sent: boolean; error: string }

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://mamamaeum-web.vercel.app').replace(/\/$/, '')
const CONSENT_KEY = 'mamamaeum-ai-processing-consent'
const AI_NOTICE = 'AI가 제안한 문장은 의료·심리·법률 등 전문가의 답변이나 진단이 아니며, 유일한 정답도 아닙니다. 중요한 결정이나 위기 상황에서는 신뢰할 수 있는 사람 또는 전문기관의 도움을 받아 주세요.'
const FEEDBACK_CATEGORIES = ['버그 신고', '기능 제안', '아쉬운 점', '좋았던 점']

const prompts: Record<Mode, string> = {
  inbound: `너는 성인 자녀가 부모님에게 받은 카카오톡 메시지에 답장하도록 돕는 한국어 대화 도우미다. 비난하거나 단정하지 말고, 감정적으로 힘든 상황은 안전과 도움을 우선하도록 안내해라. 답변 세 개는 서로 뚜렷이 달라야 한다. 1) 다정하게: 관계와 공감을 먼저 전하는 말, 2) 차분하고 분명하게: 요청이나 경계를 또렷이 전하는 말, 3) 솔직하게: 내 감정과 진심을 숨기지 않는 말. 각 답변에는 부모님이 받을 수 있는 예상 반응을 한 문장으로 덧붙여라. 반드시 아래 JSON만 출력해라. {"summary":"상황을 한 문장으로 공감해 설명","replies":[{"tone":"다정하게","strategy":"관계와 공감을 먼저 전하는 말","text":"답장","expectedReaction":"부모님의 예상 반응"},{"tone":"차분하고 분명하게","strategy":"요청이나 경계를 또렷이 전하는 말","text":"답장","expectedReaction":"부모님의 예상 반응"},{"tone":"솔직하게","strategy":"내 감정과 진심을 숨기지 않는 말","text":"답장","expectedReaction":"부모님의 예상 반응"}]}`,
  outbound: `너는 성인 자녀가 부모님께 하고 싶은 말을 실제로 보낼 수 있는 한국어 문장으로 다듬어 주는 대화 도우미다. 비난하거나 단정하지 말고, 감정적으로 힘든 상황은 안전과 도움을 우선하도록 안내해라. 답변 세 개는 서로 뚜렷이 달라야 한다. 1) 다정하게: 관계와 공감을 먼저 전하는 말, 2) 차분하고 분명하게: 요청이나 경계를 또렷이 전하는 말, 3) 솔직하게: 내 감정과 진심을 숨기지 않는 말. 각 답변에는 부모님이 받을 수 있는 예상 반응을 한 문장으로 덧붙여라. 반드시 아래 JSON만 출력해라. {"summary":"상황을 한 문장으로 공감해 설명","replies":[{"tone":"다정하게","strategy":"관계와 공감을 먼저 전하는 말","text":"문장","expectedReaction":"부모님의 예상 반응"},{"tone":"차분하고 분명하게","strategy":"요청이나 경계를 또렷이 전하는 말","text":"문장","expectedReaction":"부모님의 예상 반응"},{"tone":"솔직하게","strategy":"내 감정과 진심을 숨기지 않는 말","text":"문장","expectedReaction":"부모님의 예상 반응"}]}`,
}

const fallbackStrategy: Record<string, string> = {
  '다정하게': '관계와 공감을 먼저 전하는 말',
  '차분하고 분명하게': '요청이나 경계를 또렷이 전하는 말',
  '솔직하게': '내 감정과 진심을 숨기지 않는 말',
}

function stripFence(value: string) {
  return value.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
}

function parseResult(value: unknown): ApiResult | null {
  if (!value || typeof value !== 'object') return null
  const result = value as { summary?: unknown; replies?: unknown }
  if (!Array.isArray(result.replies) || result.replies.length === 0) return null

  const replies = result.replies.flatMap((reply): Reply[] => {
    if (!reply || typeof reply !== 'object') return []
    const candidate = reply as Partial<Reply>
    if (typeof candidate.tone !== 'string' || typeof candidate.text !== 'string') return []
    const tone = candidate.tone.trim()
    const text = candidate.text.trim()
    if (!tone || !text) return []
    return [{
      tone,
      text,
      strategy: typeof candidate.strategy === 'string' && candidate.strategy.trim()
        ? candidate.strategy.trim()
        : fallbackStrategy[tone] || '다른 방식으로 마음을 전하는 말',
      expectedReaction: typeof candidate.expectedReaction === 'string' && candidate.expectedReaction.trim()
        ? candidate.expectedReaction.trim()
        : '부모님이 내 마음을 한 번 더 생각해볼 수 있어요.',
    }]
  })

  return replies.length > 0
    ? { summary: typeof result.summary === 'string' ? result.summary : undefined, replies }
    : null
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
  const [mode, setMode] = useState<Mode>('outbound')
  const [screen, setScreen] = useState<Screen>('compose')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ApiResult | null>(null)
  const [notice, setNotice] = useState('')
  const [feedback, setFeedback] = useState<Feedback>({ category: '', message: '', contact: '', sending: false, sent: false, error: '' })
  const [feedbackReturnScreen, setFeedbackReturnScreen] = useState<Exclude<Screen, 'feedback'>>('compose')
  const requestController = useRef<AbortController | null>(null)

  const title = mode === 'inbound' ? '부모님이 보낸 카톡' : '엄마에게 하고 싶은 말'
  const placeholder = mode === 'inbound' ? '받은 메시지를 붙여넣어 주세요' : '아직 못 한 말을 편하게 적어 주세요'
  const canGenerate = message.trim().length > 0 && message.length <= 30000

  useEffect(() => {
    const unsubscribe = graniteEvent.addEventListener('backEvent', {
      onEvent: goBack,
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

  async function requestSuggestions() {
    const fallbackScreen = result ? 'result' : 'compose'
    const controller = new AbortController()
    requestController.current?.abort()
    requestController.current = controller
    setScreen('loading')
    setNotice('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system: prompts[mode],
          messages: [{ role: 'user', content: message.trim() }],
          max_tokens: 700,
        }),
      })
      if (!response.ok) {
        if (response.status === 429) throw new Error('rate-limited')
        throw new Error(`API ${response.status}`)
      }
      const payload = await response.json()
      const text = payload.content?.find((block: { type?: string }) => block.type === 'text')?.text
      const parsed = text ? parseResult(JSON.parse(stripFence(text))) : null
      if (!parsed) throw new Error('invalid response')
      setResult(parsed)
      setScreen('result')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setNotice(error instanceof Error && error.message === 'rate-limited'
        ? '시간당 최대 30회까지 답변을 받을 수 있어요. 잠시 후 다시 시도해주세요.'
        : '답장을 만들지 못했어요. 잠시 후 다시 시도해주세요.')
      setScreen(fallbackScreen)
    } finally {
      if (requestController.current === controller) requestController.current = null
    }
  }

  function goBack() {
    requestController.current?.abort()
    requestController.current = null
    setNotice('')
    if (screen === 'feedback') {
      setScreen(feedbackReturnScreen === 'loading' ? 'compose' : feedbackReturnScreen)
      return
    }
    if (screen === 'compose') {
      window.history.back()
      return
    }
    setScreen('compose')
  }

  function openFeedback(origin: Exclude<Screen, 'feedback'>) {
    if (origin === 'loading') requestController.current?.abort()
    setFeedbackReturnScreen(origin)
    setFeedback((current) => ({ ...current, error: '' }))
    setScreen('feedback')
  }

  async function submitFeedback() {
    const message = feedback.message.trim()
    if (!message) {
      setFeedback((current) => ({ ...current, error: '내용을 적어주세요.' }))
      return
    }

    setFeedback((current) => ({ ...current, sending: true, error: '' }))
    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: feedback.category, message, contact: feedback.contact.trim() }),
      })
      if (!response.ok) throw new Error(`API ${response.status}`)
      setFeedback((current) => ({ ...current, sending: false, sent: true }))
    } catch {
      setFeedback((current) => ({ ...current, sending: false, error: '전송에 실패했어요. 잠시 후 다시 시도해주세요.' }))
    }
  }

  const feedbackButton = (origin: Exclude<Screen, 'feedback'>) => <button className="feedbackButton" onClick={() => openFeedback(origin)}>의견 보내기</button>

  if (screen === 'feedback') {
    if (feedback.sent) {
      return <main className="page"><button className="backButton" onClick={goBack} aria-label="이전 화면으로 돌아가기">← 뒤로가기</button><section className="card feedbackSuccess"><p className="eyebrow">피드백 접수 완료</p><h1>의견을 보내주셔서 감사해요</h1><p>남겨주신 내용은 운영자가 확인하고 서비스 개선에 활용할게요.</p></section><button className="primary" onClick={() => setFeedback({ category: '', message: '', contact: '', sending: false, sent: false, error: '' })}>의견 하나 더 남기기</button></main>
    }

    return <main className="page"><button className="backButton" onClick={goBack} aria-label="이전 화면으로 돌아가기">← 뒤로가기</button><header><p className="eyebrow">엄마마음 피드백</p><h1>사용해 보신 의견을 들려주세요</h1><p>오류, 답변 품질, 있으면 좋을 기능 모두 괜찮아요.</p></header><section className="card feedbackForm"><label>어떤 의견인가요? <span>선택</span></label><div className="categoryList">{FEEDBACK_CATEGORIES.map((category) => <button key={category} className={feedback.category === category ? 'category active' : 'category'} onClick={() => setFeedback((current) => ({ ...current, category: current.category === category ? '' : category }))}>{category}</button>)}</div><label htmlFor="feedback-message">의견 내용 <span>필수</span></label><textarea id="feedback-message" value={feedback.message} maxLength={2000} onChange={(event) => setFeedback((current) => ({ ...current, message: event.target.value }))} placeholder="불편했던 점이나 바라는 점을 편하게 적어주세요" /><label htmlFor="feedback-contact">답변 받을 연락처 <span>선택</span></label><input id="feedback-contact" value={feedback.contact} maxLength={200} onChange={(event) => setFeedback((current) => ({ ...current, contact: event.target.value }))} placeholder="이메일 등" /><p className="privacy">민감한 개인정보는 적지 말아 주세요. 의견은 서비스 개선과 답변 목적으로만 사용됩니다.</p></section>{feedback.error && <p className="notice">{feedback.error}</p>}<button className="primary" disabled={feedback.sending} onClick={() => void submitFeedback()}>{feedback.sending ? '보내는 중…' : '의견 보내기'}</button></main>
  }

  async function generate() {
    if (!canGenerate) return
    if (!consented) {
      setScreen('consent')
      return
    }
    await requestSuggestions()
  }

  function allowAiProcessing() {
    try {
      localStorage.setItem(CONSENT_KEY, 'v1')
    } catch {
      // 브라우저 저장소를 사용할 수 없어도 이번 요청은 계속 진행합니다.
    }
    void requestSuggestions()
  }

  if (screen === 'consent') {
    return <main className="page"><button className="backButton" onClick={goBack} aria-label="이전 화면으로 돌아가기">← 뒤로가기</button>{feedbackButton('consent')}<section className="card"><p className="eyebrow">AI 처리 안내</p><h1>답장을 만들기 전에 확인해 주세요</h1><p>입력한 내용은 답장 제안을 만들기 위해 엄마마음 서버를 거쳐 Anthropic AI API로 전송됩니다. 서비스는 원문과 결과를 별도로 저장하지 않지만, AI 제공자는 기본 정책에 따라 입력과 출력을 최대 30일 보관할 수 있습니다.</p><p className="muted">이름, 연락처, 주소, 금융정보 등 불필요한 개인정보는 가리고 입력해 주세요.</p></section><p className="aiNotice" role="note">{AI_NOTICE}</p><button className="primary" onClick={allowAiProcessing}>동의하고 답장 만들기</button></main>
  }

  if (screen === 'loading') {
    return <main className="page centered"><button className="backButton topLeft" onClick={goBack} aria-label="입력 화면으로 돌아가기">← 뒤로가기</button>{feedbackButton('loading')}<div className="spinner" /><h1>마음을 담아 문장을 만들고 있어요</h1><p>잠시만 기다려 주세요.</p><button className="textButton" onClick={goBack}>생성 취소하고 돌아가기</button></main>
  }

  if (screen === 'result' && result) {
    return <main className="page"><button className="backButton" onClick={goBack} aria-label="입력 화면으로 돌아가기">← 뒤로가기</button>{feedbackButton('result')}<header><p className="eyebrow">엄마마음</p><h1>이렇게 말해보는 건 어때요?</h1><p>{result.summary || '상대가 부담 없이 들을 수 있도록 여러 표현을 준비했어요.'}</p></header><p className="aiNotice" role="note">{AI_NOTICE}</p><section className="replyList">{result.replies?.map((reply, index) => <article className="replyCard" key={`${reply.tone}-${index}`}><span>{reply.tone}</span><p className="strategy">{reply.strategy}</p><p>{reply.text}</p><div className="expectedReaction"><strong>엄마는 이렇게 느낄 수 있어요</strong><p>{reply.expectedReaction}</p></div><button className="secondary" onClick={() => void writeClipboard(reply.text).then(() => setNotice('문장을 복사했어요.'))}>문장 복사</button></article>)}</section>{notice && <p className="notice">{notice}</p>}<button className="primary" onClick={() => void requestSuggestions()}>다른 표현 다시 받기</button><button className="textButton" onClick={goBack}>입력 내용 수정하기</button></main>
  }

  return <main className="page"><button className="backButton" onClick={goBack} aria-label="이전 화면으로 돌아가기">← 뒤로가기</button>{feedbackButton('compose')}<header><p className="eyebrow">엄마마음</p><h1>부모님과의 대화,<br />조금 덜 어렵게</h1><p>말하기 어려운 마음을 부드러운 카톡 문장으로 정리해 드려요.</p></header><p className="aiNotice" role="note">{AI_NOTICE}</p><div className="tabs"><button className={mode === 'outbound' ? 'active' : ''} onClick={() => setMode('outbound')}>엄마에게 하고 싶은 말</button><button className={mode === 'inbound' ? 'active' : ''} onClick={() => setMode('inbound')}>받은 카톡 답장</button></div><section className="card"><label htmlFor="message">{title}</label><textarea id="message" value={message} maxLength={30000} onChange={(event) => setMessage(event.target.value)} placeholder={placeholder} /><div className="fieldFooter"><button className="secondary" onClick={() => void paste()}>클립보드에서 붙여넣기</button><span>{message.length.toLocaleString()} / 30,000</span></div></section>{notice && <p className="notice">{notice}</p>}<button className="primary" disabled={!canGenerate} onClick={() => void generate()}>답장 제안 받기</button><p className="limitNotice">AI 답변은 한 IP 주소 기준 시간당 최대 30회까지 받을 수 있어요.</p><p className="privacy">입력 내용은 답장 생성에만 사용하며 서비스에 저장하지 않아요. <a href={`${API_BASE_URL}/privacy.html`} target="_blank" rel="noreferrer">개인정보 처리방침</a></p></main>
}
