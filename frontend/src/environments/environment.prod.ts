export const environment = {
  production: true,
  apiUrl: 'https://realtime-backend-fazx.onrender.com/api',
  wsUrl: 'wss://realtime-backend-fazx.onrender.com/ws',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};
