import { useState, useCallback } from 'react';

/**
 * useMeetingHistory — Persists and replays Squad meetings using localStorage
 * Stores the last 20 meetings with full chat thread, artifacts, telemetry, and prompt.
 */

const STORAGE_KEY = 'squad3d_meeting_history';
const MAX_MEETINGS = 20;

export const useMeetingHistory = () => {
  const [meetings, setMeetings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  });

  const refresh = useCallback(() => {
    try {
      setMeetings(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch { setMeetings([]); }
  }, []);

  const saveMeeting = useCallback((data) => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const meeting = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        prompt: data.prompt || '',
        duration: data.duration || '00:00:00',
        domain: data.domain || 'unknown',
        chatThread: data.chatThread || [],
        artifacts: data.artifacts || {},
        telemetry: data.telemetry || { tokens: 0, apiCalls: 0, responseTime: 0 },
        agentCount: Object.keys(data.agents || {}).length || 5,
      };
      existing.unshift(meeting);
      const trimmed = existing.slice(0, MAX_MEETINGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      setMeetings(trimmed);
      return meeting.id;
    } catch (e) {
      console.warn('[MeetingHistory] Save failed:', e);
      return null;
    }
  }, []);

  const deleteMeeting = useCallback((id) => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const filtered = existing.filter(m => m.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      setMeetings(filtered);
    } catch (e) {
      console.warn('[MeetingHistory] Delete failed:', e);
    }
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMeetings([]);
  }, []);

  const getMeeting = useCallback((id) => {
    return meetings.find(m => m.id === id) || null;
  }, [meetings]);

  return { meetings, saveMeeting, deleteMeeting, clearAll, getMeeting, refresh };
};
