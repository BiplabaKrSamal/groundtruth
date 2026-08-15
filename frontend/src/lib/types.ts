export interface QuestionOption {
  label: string
  is_correct: boolean
}

export interface Question {
  question_id: string
  prompt: string
  options: QuestionOption[]
  confidence: number
  source_chunk_ids: string[]
  source_excerpt: string
  time_limit_seconds: number
  correct_rate: number | null
  avg_answer_ms: number | null
}

export interface SessionData {
  session_id: string
  room_code: string
  host_token: string
  title: string
  source_text: string
  questions: Question[]
  phase: 'draft' | 'lobby' | 'live' | 'between' | 'ended'
}

export interface LeaderboardEntry {
  nickname: string
  score: number
  streak?: number
}

export type ServerMessage =
  | { type: 'joined'; participant_id: string }
  | { type: 'participants'; participants: { participant_id: string; nickname: string; score: number }[] }
  | { type: 'question'; index: number; total: number; question_id: string; prompt: string; options: string[]; time_limit_seconds: number }
  | { type: 'answer_progress'; answered: number; total: number }
  | { type: 'results'; question_id: string; correct_index: number; tally: number[]; correct_rate: number | null; confidence: number; source_excerpt: string; leaderboard: LeaderboardEntry[] }
  | { type: 'ended'; leaderboard: LeaderboardEntry[] }
