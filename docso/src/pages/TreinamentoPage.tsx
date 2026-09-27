import { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'

type Step = {
  order: number
  title: string
  description?: string
  notes?: string
}

type QuizQuestion = {
  id: string
  question: string
  options: string[]
}

type QuizResult = {
  passed: boolean
  score: number
  results: { correct: boolean; correctIndex: number }[]
}

type Assignment = {
  id: string
  status: string
  startedAt: string | null
  completedAt: string | null
  assignee: { name: string }
  organization: { name: string }
  process: {
    id: string
    title: string
    objective: string | null
    executor: string | null
    frequency: string | null
    steps: Step[]
    quiz: QuizQuestion[] | null
  }
}

export default function TreinamentoPage() {
  const { token } = useParams({ from: '/treinamento/$token' })
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set())
  const [completed, setCompleted] = useState(false)

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([])
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)

  const { data: assignment, isLoading, isError } = useQuery({
    queryKey: ['treinamento', token],
    queryFn: () => api.get<Assignment>(`/api/training/${token}`),
  })

  useEffect(() => {
    if (assignment) {
      setQuizAnswers(new Array(assignment.process.quiz?.length ?? 0).fill(null))
    }
  }, [assignment?.process.quiz?.length])

  const startMutation = useMutation({
    mutationFn: () => api.post(`/api/training/${token}/start`, {}),
  })

  type QuizFailBody = { code: string; passed: false; score: number; results: QuizResult['results'] }

  const completeMutation = useMutation({
    mutationFn: (answers: number[]) =>
      api.post<{ passed: true }>(`/api/training/${token}/complete`, { answers }),
    onSuccess: () => setCompleted(true),
    onError: (err) => {
      const body = (err as Error & { body?: QuizFailBody }).body
      if (body?.code === 'QUIZ_FAILED') {
        setQuizResult({ passed: false, score: body.score, results: body.results })
      }
    },
  })

  function toggleStep(order: number) {
    setDoneSteps(prev => {
      const next = new Set(prev)
      if (next.has(order)) next.delete(order)
      else next.add(order)
      return next
    })
  }

  function setAnswer(qi: number, value: number) {
    setQuizAnswers(prev => prev.map((a, i) => i === qi ? value : a))
    if (quizResult) setQuizResult(null)
  }

  async function handleComplete() {
    await completeMutation.mutateAsync(quizAnswers.map(a => a ?? -1))
  }

  if (isLoading) {
    return (
      <div style={styles.centered}>
        <div style={{ color: '#A0A0A0', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
          Carregando treinamento...
        </div>
      </div>
    )
  }

  if (isError || !assignment) {
    return (
      <div style={styles.centered}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 20, color: '#0A0A0A', marginBottom: 8 }}>
            Treinamento não encontrado
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#A0A0A0', lineHeight: 1.6 }}>
            Este link pode ter expirado ou já foi utilizado.
          </div>
        </div>
      </div>
    )
  }

  const steps: Step[] = Array.isArray(assignment.process.steps) ? assignment.process.steps : []
  const quiz: QuizQuestion[] = Array.isArray(assignment.process.quiz) ? assignment.process.quiz : []
  const hasQuiz = quiz.length > 0

  const progress = steps.length > 0 ? Math.round((doneSteps.size / steps.length) * 100) : 0
  const allStepsDone = steps.length > 0 && doneSteps.size === steps.length
  const allAnswered = quizAnswers.every(a => a !== null)
  const isCompleted = completed || assignment.status === 'completed'
  const hasStarted = assignment.status !== 'pending' || startMutation.isSuccess

  // Quiz passed on previous successful run
  const quizPassed = !hasQuiz || (quizResult?.passed ?? false) || isCompleted

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.logo}>
          docso
          <span style={styles.logoDot} />
        </span>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#A0A0A0' }}>
          {assignment.organization.name}
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.inner}>

          {isCompleted && (
            <div style={styles.completedBanner}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#39BD3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,9 7,13 15,5" />
              </svg>
              <span>Treinamento concluído! Bom trabalho, {assignment.assignee.name.split(' ')[0]}.</span>
            </div>
          )}

          <div style={styles.processHeader}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, color: '#A0A0A0', textTransform: 'uppercase', marginBottom: 12 }}>
              — Treinamento
            </div>
            <h1 style={styles.processTitle}>{assignment.process.title}</h1>
            {assignment.process.objective && (
              <p style={styles.processObjective}>{assignment.process.objective}</p>
            )}
            <div style={styles.processMeta}>
              {assignment.process.executor && (
                <div style={styles.metaTag}>{assignment.process.executor}</div>
              )}
              {assignment.process.frequency && (
                <div style={styles.metaTag}>{assignment.process.frequency}</div>
              )}
            </div>
          </div>

          {steps.length > 0 && hasStarted && !isCompleted && (
            <div style={styles.progressBlock}>
              <div style={styles.progressLabel}>
                <span style={{ color: '#666', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Progresso</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#0A0A0A' }}>{progress}%</span>
              </div>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${progress}%` }} />
              </div>
            </div>
          )}

          {!hasStarted && !isCompleted && (
            <div style={{ marginBottom: 32 }}>
              <button onClick={() => startMutation.mutate()} disabled={startMutation.isPending} style={styles.btnPrimary}>
                {startMutation.isPending ? 'Iniciando...' : 'Iniciar treinamento'}
              </button>
            </div>
          )}

          {steps.length > 0 && (
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, color: '#A0A0A0', textTransform: 'uppercase', marginBottom: 16 }}>
                — Passos
              </div>
              <div style={styles.stepsList}>
                {steps.map(step => {
                  const done = doneSteps.has(step.order)
                  const interactive = hasStarted && !isCompleted
                  return (
                    <div
                      key={step.order}
                      onClick={() => interactive && toggleStep(step.order)}
                      style={{ ...styles.stepRow, cursor: interactive ? 'pointer' : 'default', opacity: isCompleted ? 0.7 : 1 }}
                    >
                      <div style={{ ...styles.stepCheckbox, ...(done ? styles.stepCheckboxDone : {}) }}>
                        {done && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1.5,5 4,7.5 8.5,2.5" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14, color: done ? '#A0A0A0' : '#0A0A0A', textDecoration: done ? 'line-through' : 'none', marginBottom: step.description ? 6 : 0, lineHeight: 1.4 }}>
                          <span style={{ color: '#C8C8C8', fontFamily: "'DM Mono', monospace", fontSize: 11, marginRight: 10 }}>
                            {String(step.order).padStart(2, '0')}
                          </span>
                          {step.title}
                        </div>
                        {step.description && (
                          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: done ? '#C8C8C8' : '#666', lineHeight: 1.6 }}>
                            {step.description}
                          </div>
                        )}
                        {step.notes && (
                          <div style={styles.stepNote}>{step.notes}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quiz — aparece após todas as etapas concluídas */}
          {hasQuiz && allStepsDone && hasStarted && !isCompleted && (
            <div style={{ marginTop: 40 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, color: '#A0A0A0', textTransform: 'uppercase', marginBottom: 16 }}>
                — Quiz
              </div>

              {quizResult && !quizResult.passed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(254,116,81,0.08)', border: '1px solid rgba(254,116,81,0.2)', borderRadius: 10, marginBottom: 20, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#FE7451', fontWeight: 500 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="8" cy="8" r="6.5"/><line x1="8" y1="5" x2="8" y2="8.5"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/>
                  </svg>
                  {quizResult.score}% de acerto — precisa de 70% para concluir. Revise e tente novamente.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {quiz.map((q, qi) => {
                  const resultItem = quizResult?.results[qi]
                  return (
                    <div key={q.id} style={{ background: '#fff', border: '1px solid #E4E4E4', borderRadius: 12, padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14, color: '#0A0A0A', lineHeight: 1.4 }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#C0C0C0', marginRight: 8 }}>{String(qi + 1).padStart(2, '0')}</span>
                        {q.question}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {q.options.map((opt, oi) => {
                          const selected = quizAnswers[qi] === oi
                          const isCorrectAnswer = resultItem && oi === resultItem.correctIndex
                          const isWrongSelected = resultItem && selected && !resultItem.correct

                          let borderColor = selected ? '#0A0A0A' : '#E4E4E4'
                          let bgColor = selected ? '#0A0A0A0D' : '#fff'
                          if (resultItem) {
                            if (isCorrectAnswer) { borderColor = '#39BD3D'; bgColor = 'rgba(57,189,61,0.06)' }
                            else if (isWrongSelected) { borderColor = '#FE7451'; bgColor = 'rgba(254,116,81,0.06)' }
                          }

                          return (
                            <button
                              key={oi}
                              onClick={() => !quizResult && setAnswer(qi, oi)}
                              disabled={!!quizResult}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '11px 14px', borderRadius: 8,
                                border: `1.5px solid ${borderColor}`,
                                background: bgColor,
                                cursor: quizResult ? 'default' : 'pointer',
                                textAlign: 'left', transition: 'all 0.12s',
                              }}
                            >
                              <div style={{
                                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                                border: `2px solid ${selected ? '#0A0A0A' : '#D0D0D0'}`,
                                background: selected ? '#0A0A0A' : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                              </div>
                              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#0A0A0A', lineHeight: 1.4 }}>
                                {opt}
                              </span>
                              {resultItem && isCorrectAnswer && (
                                <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#39BD3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="2,7 5.5,10.5 12,3.5" />
                                </svg>
                              )}
                              {resultItem && isWrongSelected && (
                                <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#FE7451" strokeWidth="2" strokeLinecap="round">
                                  <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
                                </svg>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Botão concluir */}
          {hasStarted && !isCompleted && (
            <div style={{ marginTop: 32 }}>
              {(!hasQuiz && allStepsDone) || (hasQuiz && allStepsDone && quizPassed) ? (
                <button
                  onClick={handleComplete}
                  disabled={completeMutation.isPending}
                  style={styles.btnPrimary}
                >
                  {completeMutation.isPending ? 'Concluindo...' : 'Marcar como concluído'}
                </button>
              ) : hasQuiz && allStepsDone && quizResult && !quizResult.passed ? (
                <button
                  onClick={() => {
                    setQuizResult(null)
                    setQuizAnswers(new Array(quiz.length).fill(null))
                  }}
                  style={styles.btnPrimary}
                >
                  Tentar novamente
                </button>
              ) : hasQuiz && allStepsDone && !quizPassed ? (
                <button
                  onClick={handleComplete}
                  disabled={!allAnswered || completeMutation.isPending}
                  style={{ ...styles.btnPrimary, opacity: allAnswered ? 1 : 0.4, cursor: allAnswered ? 'pointer' : 'not-allowed' }}
                >
                  {completeMutation.isPending ? 'Verificando...' : 'Verificar respostas'}
                </button>
              ) : (
                <button disabled style={{ ...styles.btnPrimary, opacity: 0.4, cursor: 'not-allowed' }}>
                  Marcar como concluído
                </button>
              )}
              {!allStepsDone && steps.length > 0 && (
                <div style={{ marginTop: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#A0A0A0' }}>
                  Marque todos os passos para continuar
                </div>
              )}
              {hasQuiz && allStepsDone && !quizResult && !quizPassed && !allAnswered && (
                <div style={{ marginTop: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#A0A0A0' }}>
                  Responda todas as perguntas do quiz para concluir
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#FAFAFA', display: 'flex', flexDirection: 'column' as const },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: '1px solid #E4E4E4', background: '#FAFAFA' },
  logo: { fontFamily: "'Geist', -apple-system, sans-serif", fontWeight: 500, fontSize: 20, letterSpacing: '-0.06em', color: '#0A0A0A', display: 'inline-flex', alignItems: 'baseline', userSelect: 'none' as const },
  logoDot: { display: 'inline-block', width: '0.16em', height: '0.16em', borderRadius: '50%', background: '#30BCFE', marginLeft: '0.04em', position: 'relative' as const, top: '-0.02em', flexShrink: 0 },
  centered: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' },
  main: { flex: 1, display: 'flex', justifyContent: 'center', padding: '48px 24px 80px' },
  inner: { width: '100%', maxWidth: 640 },
  completedBanner: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(57, 189, 61, 0.08)', border: '1px solid rgba(57, 189, 61, 0.2)', borderRadius: 10, marginBottom: 32, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#39BD3D', fontWeight: 500 },
  processHeader: { marginBottom: 32 },
  processTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.5px', color: '#0A0A0A', margin: '0 0 12px 0', lineHeight: 1.2 },
  processObjective: { fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: '#666', lineHeight: 1.7, margin: '0 0 16px 0' },
  processMeta: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  metaTag: { fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 0.5, color: '#666', background: '#F0F0F0', padding: '3px 10px', borderRadius: 99 },
  progressBlock: { marginBottom: 32 },
  progressLabel: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 },
  progressBar: { height: 4, background: '#E4E4E4', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#30BCFE', borderRadius: 2, transition: 'width 0.3s ease' },
  btnPrimary: { background: '#0A0A0A', color: '#FAFAFA', border: 'none', borderRadius: 8, padding: '11px 24px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14, cursor: 'pointer', letterSpacing: '-0.2px' },
  stepsList: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  stepRow: { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 10, transition: 'background 0.15s', background: 'transparent' },
  stepCheckbox: { width: 20, height: 20, borderRadius: 6, border: '1.5px solid #E4E4E4', background: '#fff', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
  stepCheckboxDone: { background: '#39BD3D', border: '1.5px solid #39BD3D' },
  stepNote: { marginTop: 8, padding: '8px 12px', background: 'rgba(250,219,2,0.08)', borderRadius: 6, borderLeft: '2px solid #FADB02', fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#888', lineHeight: 1.6 },
}
