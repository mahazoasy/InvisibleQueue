import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_SESSION_KEY = '@invisible_queue_guest_session';
const ACTIVE_ENTRY_KEY = '@invisible_queue_active_entry';

export const getGuestSession = async (): Promise<string> => {
  let sessionId = await AsyncStorage.getItem(GUEST_SESSION_KEY);
  if (!sessionId) {
    sessionId = generateUUID();
    await AsyncStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }
  return sessionId;
};

export const setActiveEntry = async (entryId: string, queueId: string): Promise<void> => {
  await AsyncStorage.setItem(ACTIVE_ENTRY_KEY, JSON.stringify({ entryId, queueId }));
};

export const getActiveEntry = async (): Promise<{ entryId: string; queueId: string } | null> => {
  const data = await AsyncStorage.getItem(ACTIVE_ENTRY_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearActiveEntry = async (): Promise<void> => {
  await AsyncStorage.removeItem(ACTIVE_ENTRY_KEY);
};

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};