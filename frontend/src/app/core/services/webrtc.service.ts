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
  readonly isSocketConnected = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // WebRTC & WebSocket internals
  private socket: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private reconnectTimer: any = null;
  private shouldReconnect = true;

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

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
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

      this.socket.onclose = () => {
        this.isSocketConnected.set(false);
        this.socket = null;
        if (this.shouldReconnect && this.authService.isAuthenticated()) {
          this.reconnectTimer = setTimeout(() => {
            if (this.shouldReconnect) {
              this.connectSignaling();
            }
          }, 4000);
        }
      };

      this.socket.onerror = () => {
        this.isSocketConnected.set(false);
      };
    } catch {
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
   * Start an outgoing call to a specific user.
   */
  async startCall(
    calleeId: number,
    calleeName: string,
    callType: CallType = 'audio',
    calleeAvatar?: string | null
  ): Promise<void> {
    this.error.set(null);

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
      this.error.set('Could not access microphone or camera.');
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
   * Toggle local camera mute state (video calls).
   */
  toggleVideo(): boolean {
    const stream = this.localStream();
    if (!stream) return false;

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.isVideoMuted.set(!videoTrack.enabled);
      return videoTrack.enabled;
    }
    return false;
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

    // Receive remote media tracks
    pc.ontrack = (event: RTCTrackEvent) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream.set(event.streams[0]);
      } else {
        const stream = new MediaStream([event.track]);
        this.remoteStream.set(stream);
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
    if (!isPlatformBrowser(this.platformId) || !navigator.mediaDevices) {
      throw new Error('Media devices unavailable in current environment.');
    }

    const constraints: MediaStreamConstraints = {
      audio: true,
      video: callType === 'video',
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
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
        this.socket.send(JSON.stringify(message));
      } catch {}
    }
  }
}
