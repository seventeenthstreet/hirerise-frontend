/**
 * src/modules/career-advisor/services/advisor.api.ts
 *
 * All API calls for the AI Career Advisor module.
 * Uses apiFetch from services/apiClient.ts — auth headers handled automatically.
 */

import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatResponse {
  response:    string;
  studentName: string | null;
}

export interface WelcomeResponse {
  message:     string;
  studentName: string | null;
}

export interface ConversationTurn {
  id:           string;
  student_id:   string;
  user_message: string;
  ai_response:  string;
  created_at:   string;
}

export interface HistoryResponse {
  conversations: ConversationTurn[];
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * sendMessage(studentId, message)
 *
 * Sends the student's question to the AI Career Advisor.
 * Returns the Claude-generated personalised response.
 */
export function sendMessage(studentId: string, message: string): Promise<ChatResponse> {
  return apiFetch<ChatResponse>(`/advisor/chat/${studentId}`, {
    method: 'POST',
    body:   JSON.stringify({ message }),
  });
}

/**
 * getWelcome(studentId)
 *
 * Fetches the personalised welcome message for the advisor page.
 * No AI call — instant response.
 */
export function getWelcome(studentId: string): Promise<WelcomeResponse> {
  return apiFetch<WelcomeResponse>(`/advisor/welcome/${studentId}`);
}

/**
 * getHistory(studentId)
 *
 * Fetches the student's conversation history.
 */
export function getHistory(studentId: string): Promise<HistoryResponse> {
  return apiFetch<HistoryResponse>(`/advisor/history/${studentId}`);
}

export const advisorApi = {
  sendMessage,
  getWelcome,
  getHistory,
};
