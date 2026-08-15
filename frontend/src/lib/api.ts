import type { Question, QuestionOption, SessionData } from './types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  createSession: (title: string, sourceText: string) =>
    request<SessionData>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ title, source_text: sourceText }),
    }),

  uploadPdf: async (sessionId: string, hostToken: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(
      `${BASE_URL}/api/sessions/${sessionId}/upload-pdf?host_token=${hostToken}`,
      { method: 'POST', body: form },
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(body.detail || 'Upload failed')
    }
    return res.json() as Promise<{ source_text: string }>
  },

  generateQuestions: (sessionId: string, hostToken: string, questionCount: number) =>
    request<SessionData>(
      `/api/sessions/${sessionId}/generate?host_token=${hostToken}`,
      { method: 'POST', body: JSON.stringify({ question_count: questionCount }) },
    ),

  updateQuestions: (sessionId: string, hostToken: string, questions: Question[]) =>
    request<SessionData>(
      `/api/sessions/${sessionId}/questions?host_token=${hostToken}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          questions: questions.map((q) => ({
            question_id: q.question_id,
            prompt: q.prompt,
            options: q.options,
          })),
        }),
      },
    ),

  deleteQuestion: (sessionId: string, hostToken: string, questionId: string) =>
    request<SessionData>(
      `/api/sessions/${sessionId}/questions/${questionId}?host_token=${hostToken}`,
      { method: 'DELETE' },
    ),

  publish: (sessionId: string, hostToken: string) =>
    request<SessionData>(`/api/sessions/${sessionId}/publish?host_token=${hostToken}`, {
      method: 'POST',
    }),

  getSession: (sessionId: string, hostToken: string) =>
    request<SessionData>(`/api/sessions/${sessionId}?host_token=${hostToken}`),

  getByRoomCode: (roomCode: string) =>
    request<{ session_id: string; title: string; phase: string; participant_count: number }>(
      `/api/sessions/by-room/${roomCode}`,
    ),
}

export type { QuestionOption }
export const wsUrl = (roomCode: string, params: Record<string, string>) => {
  const base = BASE_URL.replace(/^http/, 'ws')
  const query = new URLSearchParams(params).toString()
  return `${base}/ws/${roomCode}?${query}`
}
