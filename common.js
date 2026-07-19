/* common.js — shared utilities + storage for Smart Attendance (face + geo + time) */
/* eslint-disable no-undef */
(() => {
  'use strict';

  // ====== Constants ======
  const RADIUS_METERS = 20; // fixed as requested
  const LS_KEYS = {
    faces: 'sa_faces_v1',        // { name: [ [128 floats], [128 floats], ... ] }
    sessions: 'sa_sessions_v1',  // { token: {className, lat, lng, radius, createdAt, expiresAt} }
    attendance: 'sa_att_v1'      // { token: [ {name, time, lat, lng, accuracy} ] }
  };

  // ====== Safe JSON helpers ======
  function safeParse(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
  }
  function getJSON(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return safeParse(raw, fallback);
  }
  function setJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ====== LocalStorage facade ======
  const LocalStore = {
    // Faces
    getFaces() { return getJSON(LS_KEYS.faces, {}); },
    saveFaces(obj) { setJSON(LS_KEYS.faces, obj); },

    // Sessions
    getSessions() { return getJSON(LS_KEYS.sessions, {}); },
    saveSessions(obj) { setJSON(LS_KEYS.sessions, obj); },
    upsertSession(token, session) {
      const all = LocalStore.getSessions();
      all[token] = session;
      LocalStore.saveSessions(all);
    },
    getSession(token) { return LocalStore.getSessions()[token] || null; },
    deleteSession(token) {
      const all = LocalStore.getSessions();
      if (all[token]) { delete all[token]; }
      LocalStore.saveSessions(all);
      const att = LocalStore.getAttendanceAll();
      if (att[token]) { delete att[token]; }
      LocalStore.saveAttendanceAll(att);
    },

    // Attendance
    getAttendanceAll() { return getJSON(LS_KEYS.attendance, {}); },
    saveAttendanceAll(obj) { setJSON(LS_KEYS.attendance, obj); },
    getAttendance(token) { return LocalStore.getAttendanceAll()[token] || []; },
    addAttendance(token, record) {
      const all = LocalStore.getAttendanceAll();
      const list = all[token] || [];
      list.push(record);
      all[token] = list;
      LocalStore.saveAttendanceAll(all);
    }
  };

  // ====== Utilities ======
  function toRad(d) { return (d * Math.PI) / 180; }

  // Haversine distance in meters
  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function genToken(len = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    // Tiny time suffix to reduce collisions in rapid use
    return out + Date.now().toString(36).slice(-3);
  }

  function fmt(ts) { return new Date(ts).toLocaleString(); }

  // RFC-4180-ish CSV: quote with double-quotes, escape double-quotes as "".
  function downloadCSV(filename, rows) {
    const csv = rows
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ====== Expose to window (no modules needed) ======
  window.RADIUS_METERS = RADIUS_METERS;
  window.LS_KEYS = LS_KEYS;
  window.LocalStore = LocalStore;
  window.haversineMeters = haversineMeters;
  window.genToken = genToken;
  window.fmt = fmt;
  window.downloadCSV = downloadCSV;
})();
