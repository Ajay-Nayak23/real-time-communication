export const environment = {
  production: true,
  apiUrl: 'https://realtime-backend.onrender.com/api',
  wsUrl: 'wss://realtime-backend.onrender.com/ws',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};
