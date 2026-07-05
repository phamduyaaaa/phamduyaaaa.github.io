import { firebaseConfig } from '../config/firebase.config.js';

const STORAGE_KEY = 'vla_mc_state_prod_v1';
let db = null;
let isOnline = false;

export async function initStorage() {
  try {
    if (window.firebase) {
      window.firebase.initializeApp(firebaseConfig);
      db = window.firebase.database();
      isOnline = true;
    }
  } catch (error) {
    console.warn("Firebase initialization failed, switching to LocalStorage offline mode:", error);
  }
  return isOnline;
}

export async function loadPersistedState() {
  let localData = { done: {}, notes: {} };
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) localData = JSON.parse(s);
  } catch (e) {
    console.warn("LocalStorage access blocked.");
  }

  if (isOnline && db) {
    try {
      const snap = await db.ref(STORAGE_KEY).get();
      if (snap.exists()) {
        const fbData = snap.val();
        return {
          done: { ...localData.done, ...(fbData.done || {}) },
          notes: { ...localData.notes, ...(fbData.notes || {}) }
        };
      }
    } catch (e) {
      console.error("Firebase fetch error:", e);
    }
  }
  return localData;
}

export async function savePersistedState(state) {
  const payload = { done: state.done, notes: state.notes };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("LocalStorage save error.");
  }

  if (isOnline && db) {
    try {
      await db.ref(STORAGE_KEY).set(payload);
    } catch (e) {
      console.error("Firebase sync error:", e);
    }
  }
}
