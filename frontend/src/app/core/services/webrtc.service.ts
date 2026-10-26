import { Injectable, PLATFORM_ID, inject, signal, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ActiveCall, CallInviteEvent, CallType, CallUiState } from '../models/call.model';

@Injectable({
  providedIn: 'root',
})
export class WebRTCService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly wsBaseUrl = environment.wsUrl || 'ws://127.0.0.1:8000/ws';

  // Reactive State Signals
  readonly callState = signal<CallUiState>('idle');
  readonly currentCall = signal<ActiveCall | null>(null);
  readonly localStream = signal<MediaStream | null>(null);
  readonly remoteStream = signal<MediaStream | null>(null);
  readonly isAudioMuted = signal<boolean>(false);
  readonly isVideoMuted = signal<boolean>(false);
  readonly isRemoteVideoMuted = signal<boolean>(false);
  readonly hasMultipleVideoDevices = signal<boolean>(false);
  readonly isSocketConnected = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // WebRTC & WebSocket internals
  private socket: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private reconnectTimer: any = null;
  private shouldReconnect = true;
  private isRenegotiating = false;
  private currentFacingMode: 'user' | 'environment' = 'user';

  ngOnDestroy(): void {
    this.endCall('completed');
    this.disconnectSignaling();
  }

  /**
   * Connect to the WebRTC signaling WebSocket endpoint (/ws/calls/).
   */
  connectSignaling(): void {
    if (!isPlatformBrowser(this.platformId) || typeof WebSocket === 'undefined') {
      return;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.disconnectSignaling();
    this.shouldReconnect = true;

    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    const wsUrl = `${this.wsBaseUrl}/calls/?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[WebRTC] Signaling WebSocket connected');
        this.isSocketConnected.set(true);
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.handleSignalingMessage(data);
        } catch {
          // Ignore invalid frames
        }
      };

      this.socket.onclose = (event: CloseEvent) => {
        console.warn(`[WebRTC] Signaling WebSocket closed (code=${event.code})`);
        this.isSocketConnected.set(false);
        this.socket = null;
        if (event.code === 4401) {
          this.authService.refreshToken().subscribe({
            next: () => this.connectSignaling(),
            error: () => {},
          });
          return;
        }
        if (this.shouldReconnect && this.authService.isAuthenticated()) {
          this.reconnectTimer = setTimeout(() => {
            if (this.shouldReconnect) {
              this.connectSignaling();
            }
          }, 3000);
        }
      };

      this.socket.onerror = (err) => {
        console.error('[WebRTC] Signaling WebSocket error:', err);
        this.isSocketConnected.set(false);
      };
    } catch (err) {
      console.error('[WebRTC] Failed to initialize WebSocket:', err);
      this.isSocketConnected.set(false);
    }
  }

  /**
   * Disconnect signaling WebSocket connection.
   */
  disconnectSignaling(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.isSocketConnected.set(false);
  }

  /**
   * Start an outgoing call to a specific user (audio or video).
   */
  async startCall(
    calleeId: number,
    calleeName: string,
    callType: CallType = 'audio',
    calleeAvatar?: string | null
  ): Promise<void> {
    this.error.set(null);
    console.log(`[WebRTC] Starting ${callType} call to user #${calleeId} (${calleeName})`);

    // Ensure signaling connection is active
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log('[WebRTC] Signaling socket not ready, attempting connection...');
      this.connectSignaling();
      let retries = 0;
      while ((!this.socket || this.socket.readyState !== WebSocket.OPEN) && retries < 15) {
        await new Promise((r) => setTimeout(r, 100));
        retries++;
      }
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      const msg = 'Signaling server is not connected. Please ensure backend is running.';
      this.error.set(msg);
      throw new Error(msg);
    }

    try {
      const stream = await this.captureMedia(callType);
      this.localStream.set(stream);

      this.currentCall.set({
        call_id: 0, // Will be updated on call_initiated confirmation
        partner_id: calleeId,
        partner_name: calleeName,
        partner_avatar: calleeAvatar,
        call_type: callType,
        is_caller: true,
      });

      this.callState.set('calling');

      this.sendSignalingMessage({
        type: 'call_initiate',
        callee_id: calleeId,
        call_type: callType,
      });
    } catch (err: any) {
      console.error('[WebRTC] startCall failed:', err);
      this.error.set(err.message || 'Could not access media devices.');
      this.cleanupMedia();
      this.callState.set('idle');
      throw err;
    }
  }

  /**
   * Accept an incoming call invitation.
   */
  async acceptCall(): Promise<void> {
    const call = this.currentCall();
    if (!call || !call.call_id) return;

    try {
      const stream = await this.captureMedia(call.call_type);
      this.localStream.set(stream);

      this.sendSignalingMessage({
        type: 'call_accept',
        call_id: call.call_id,
      });

      this.callState.set('connected');
    } catch (err: any) {
      this.error.set('Could not access media devices to answer call.');
      this.rejectCall('failed');
      throw err;
    }
  }

  /**
   * Reject an incoming call invitation.
   */
  rejectCall(reason: string = 'declined'): void {
    const call = this.currentCall();
    if (call && call.call_id) {
      this.sendSignalingMessage({
        type: 'call_reject',
        call_id: call.call_id,
        reason,
      });
    }

    this.cleanupPeerConnection();
    this.cleanupMedia();
    this.currentCall.set(null);
    this.callState.set('idle');
  }

  /**
   * Terminate active call session.
   */
  endCall(reason: string = 'completed'): void {
    const call = this.currentCall();
    if (call && call.call_id) {
      this.sendSignalingMessage({
        type: 'call_end',
        call_id: call.call_id,
        reason,
      });
    }

    this.cleanupPeerConnection();
    this.cleanupMedia();
    this.currentCall.set(null);
    this.callState.set('idle');
  }

  /**
   * Toggle local microphone mute state.
   */
  toggleAudio(): boolean {
    const stream = this.localStream();
    if (!stream) return false;

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isAudioMuted.set(!audioTrack.enabled);
      return audioTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle local camera mute state (or upgrade if audio-only).
   */
  async toggleVideo(): Promise<boolean> {
    const stream = this.localStream();
    if (!stream) return false;

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.isVideoMuted.set(!videoTrack.enabled);
      return videoTrack.enabled;
    } else {
      // If no video track exists in local stream, perform renegotiation to upgrade to video
      await this.upgradeToVideo();
      return true;
    }
  }

  /**
   * Upgrade an ongoing audio call to a video call (WebRTC renegotiation).
   */
  async upgradeToVideo(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Video devices unavailable in current environment.');
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
        },
      });

      const videoTrack = videoStream.getVideoTracks()[0];
      if (!videoTrack) return;

      const currentLocal = this.localStream();
      let updatedLocal: MediaStream;

      if (currentLocal) {
        currentLocal.addTrack(videoTrack);
        updatedLocal = new MediaStream(currentLocal.getTracks());
      } else {
        updatedLocal = videoStream;
      }

      this.localStream.set(updatedLocal);
      this.isVideoMuted.set(false);

      const current = this.currentCall();
      if (current) {
        this.currentCall.set({ ...current, call_type: 'video' });
      }

      // Add track to RTCPeerConnection
      if (this.peerConnection) {
        this.peerConnection.addTrack(videoTrack, updatedLocal);
        // onnegotiationneeded will automatically fire and dispatch new SDP offer!
      }

      this.checkVideoDevices();
    } catch (err: any) {
      console.error('[WebRTC] Failed to upgrade to video:', err);
      this.error.set(err.message || 'Could not access camera for video upgrade.');
      throw err;
    }
  }

  /**
   * Switch front/rear camera without dropping the call.
   */
  async switchCamera(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    const currentLocal = this.localStream();
    if (!currentLocal) return;

    const oldVideoTrack = currentLocal.getVideoTracks()[0];
    if (!oldVideoTrack) return;

    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';

    try {
      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: this.currentFacingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        // Fallback without exact facingMode constraint
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.currentFacingMode },
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      // Replace track on RTCRtpSender smoothly without full renegotiation
      if (this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }

      // Stop old track and attach new track
      oldVideoTrack.stop();
      currentLocal.removeTrack(oldVideoTrack);
      currentLocal.addTrack(newVideoTrack);
      this.localStream.set(new MediaStream(currentLocal.getTracks()));
      this.isVideoMuted.set(false);
    } catch (err) {
      console.warn('[WebRTC] Could not switch camera:', err);
    }
  }

  /**
   * Query available video devices for multi-camera flip capability.
   */
  async checkVideoDevices(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      this.hasMultipleVideoDevices.set(videoInputs.length > 1);
    } catch {
      this.hasMultipleVideoDevices.set(false);
    }
  }

  // --- WebRTC Peer Connection Lifecycle ---

  private initPeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      return this.peerConnection;
    }

    const config: RTCConfiguration = {
      iceServers: environment.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }],
    };

    const pc = new RTCPeerConnection(config);

    // Add local tracks to peer connection
    const local = this.localStream();
    if (local) {
      local.getTracks().forEach((track) => pc.addTrack(track, local));
    }

    // Dynamic Media Renegotiation Handler
    pc.onnegotiationneeded = async () => {
      try {
        if (this.isRenegotiating || pc.signalingState !== 'stable') {
          return;
        }
        const call = this.currentCall();
        if (!call || !call.call_id || (this.callState() !== 'connected' && this.callState() !== 'calling')) {
          return;
        }
        this.isRenegotiating = true;
        await this.createAndSendOffer(call.call_id);
      } catch (err) {
        console.error('[WebRTC] Error during negotiationneeded:', err);
      } finally {
        this.isRenegotiating = false;
      }
    };

    // ICE candidate gathering
    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      const call = this.currentCall();
      if (event.candidate && call && call.call_id) {
        this.sendSignalingMessage({
          type: 'ice_candidate',
          call_id: call.call_id,
          payload: event.candidate.toJSON(),
        });
      }
    };

    // Receive remote media tracks (aggregates audio and video into remoteStream signal)
    pc.ontrack = (event: RTCTrackEvent) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      let stream = this.remoteStream();

      if (!stream) {
        stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
        this.remoteStream.set(stream);
      } else {
        if (!stream.getTracks().some((t) => t.id === event.track.id)) {
          stream.addTrack(event.track);
          this.remoteStream.set(new MediaStream(stream.getTracks()));
        }
      }

      // Track mute / unmute states for remote video
      if (event.track.kind === 'video') {
        this.isRemoteVideoMuted.set(!event.track.enabled || event.track.muted);
        event.track.onmute = () => this.isRemoteVideoMuted.set(true);
        event.track.onunmute = () => this.isRemoteVideoMuted.set(false);
        event.track.onended = () => this.isRemoteVideoMuted.set(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.endCall('failed');
      } else if (pc.connectionState === 'connected') {
        this.callState.set('connected');
      }
    };

    this.peerConnection = pc;
    return pc;
  }

  private async createAndSendOffer(callId: number): Promise<void> {
    const pc = this.initPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.sendSignalingMessage({
      type: 'sdp_offer',
      call_id: callId,
      payload: {
        type: offer.type,
        sdp: offer.sdp,
      },
    });
  }

  private async handleRemoteOffer(offer: RTCSessionDescriptionInit, callId: number): Promise<void> {
    const pc = this.initPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignalingMessage({
      type: 'sdp_answer',
      call_id: callId,
      payload: {
        type: answer.type,
        sdp: answer.sdp,
      },
    });
  }

  private async handleRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private async handleRemoteCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.peerConnection && candidate) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Candidate could not be processed
      }
    }
  }

  // --- Incoming Signaling Messages Router ---

  private handleSignalingMessage(data: any): void {
    switch (data.type) {
      case 'call_initiated': {
        const current = this.currentCall();
        if (current) {
          this.currentCall.set({ ...current, call_id: data.call_id });
        }
        break;
      }

      case 'call_invite': {
        // If already in a call, reject as busy
        if (this.callState() !== 'idle') {
          this.sendSignalingMessage({
            type: 'call_reject',
            call_id: data.call_id,
            reason: 'busy',
          });
          return;
        }

        const invite = data as CallInviteEvent;
        this.currentCall.set({
          call_id: invite.call_id,
          partner_id: invite.caller_id,
          partner_name: invite.caller_name,
          partner_avatar: invite.caller_avatar,
          call_type: invite.call_type,
          is_caller: false,
          started_at: invite.created_at,
        });
        this.callState.set('ringing');
        break;
      }

      case 'call_accepted': {
        const current = this.currentCall();
        if (current && current.call_id === data.call_id) {
          this.callState.set('connected');
          // Caller creates and transmits SDP offer
          this.createAndSendOffer(data.call_id);
        }
        break;
      }

      case 'call_rejected': {
        this.cleanupPeerConnection();
        this.cleanupMedia();
        this.currentCall.set(null);
        this.callState.set('idle');
        this.error.set(`Call ${data.reason || 'declined'}.`);
        break;
      }

      case 'sdp_offer': {
        if (data.payload && data.call_id) {
          this.handleRemoteOffer(data.payload, data.call_id);
        }
        break;
      }

      case 'sdp_answer': {
        if (data.payload) {
          this.handleRemoteAnswer(data.payload);
        }
        break;
      }

      case 'ice_candidate': {
        if (data.payload) {
          this.handleRemoteCandidate(data.payload);
        }
        break;
      }

      case 'call_ended': {
        this.cleanupPeerConnection();
        this.cleanupMedia();
        this.currentCall.set(null);
        this.callState.set('idle');
        break;
      }
    }
  }

  // --- Media & Resource Cleanup ---

  private async captureMedia(callType: CallType): Promise<MediaStream> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Media devices unavailable in current environment.');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Media capture is unavailable. If you are accessing this app over HTTP, please use http://localhost:4200 instead of an IP address for browser security.'
      );
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        callType === 'video'
          ? {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              facingMode: 'user',
            }
          : false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.checkVideoDevices();
      return stream;
    } catch (err: any) {
      // Fallback for strict camera constraints on low-end webcams
      if (callType === 'video' && (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')) {
        try {
          const fallback = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          this.checkVideoDevices();
          return fallback;
        } catch {}
      }

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error(
          callType === 'video'
            ? 'Camera or microphone permission was denied. Please allow camera and microphone access in your browser.'
            : 'Microphone permission was denied. Please allow microphone access in your browser address bar.'
        );
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error(
          callType === 'video'
            ? 'No camera or microphone device found on your computer.'
            : 'No microphone device found on your computer.'
        );
      }
      throw new Error(err.message || 'Could not access media devices.');
    }
  }

  private cleanupMedia(): void {
    const local = this.localStream();
    if (local) {
      local.getTracks().forEach((track) => track.stop());
      this.localStream.set(null);
    }

    const remote = this.remoteStream();
    if (remote) {
      remote.getTracks().forEach((track) => track.stop());
      this.remoteStream.set(null);
    }

    this.isAudioMuted.set(false);
    this.isVideoMuted.set(false);
    this.isRemoteVideoMuted.set(false);
    this.isRenegotiating = false;
  }

  private cleanupPeerConnection(): void {
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }
  }

  private sendSignalingMessage(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        console.log('[WebRTC] Outgoing signaling message:', message.type);
        this.socket.send(JSON.stringify(message));
      } catch (err) {
        console.error('[WebRTC] Failed to send frame:', err);
      }
    } else {
      console.warn('[WebRTC] Cannot send frame: socket not open (state=' + this.socket?.readyState + ')', message);
    }
  }
}
