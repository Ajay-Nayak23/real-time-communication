import { TestBed } from '@angular/core/testing';
import { WebRTCService } from './webrtc.service';
import { AuthService } from './auth.service';

describe('WebRTCService', () => {
  let service: WebRTCService;
  let authServiceSpy: any;

  beforeEach(() => {
    authServiceSpy = {
      getAccessToken: vi.fn().mockReturnValue('mock-jwt-token'),
      isAuthenticated: vi.fn().mockReturnValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        WebRTCService,
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });

    service = TestBed.inject(WebRTCService);
  });

  afterEach(() => {
    service.disconnectSignaling();
  });

  it('should be created and have idle state initially', () => {
    expect(service).toBeTruthy();
    expect(service.callState()).toBe('idle');
    expect(service.currentCall()).toBeNull();
    expect(service.isAudioMuted()).toBe(false);
    expect(service.isVideoMuted()).toBe(false);
    expect(service.isRemoteVideoMuted()).toBe(false);
    expect(service.hasMultipleVideoDevices()).toBe(false);
  });

  it('should handle incoming call invite and enter ringing state', () => {
    (service as any).handleSignalingMessage({
      type: 'call_invite',
      call_id: 101,
      caller_id: 2,
      caller_name: 'Bob',
      caller_avatar: null,
      call_type: 'audio',
      created_at: '2026-10-25T03:00:00Z',
    });

    expect(service.callState()).toBe('ringing');
    expect(service.currentCall()?.call_id).toBe(101);
    expect(service.currentCall()?.partner_name).toBe('Bob');
    expect(service.currentCall()?.is_caller).toBe(false);
  });

  it('should handle incoming video call invite with video call_type', () => {
    (service as any).handleSignalingMessage({
      type: 'call_invite',
      call_id: 102,
      caller_id: 3,
      caller_name: 'Charlie',
      caller_avatar: 'https://example.com/avatar.jpg',
      call_type: 'video',
      created_at: '2026-10-25T03:05:00Z',
    });

    expect(service.callState()).toBe('ringing');
    expect(service.currentCall()?.call_id).toBe(102);
    expect(service.currentCall()?.partner_name).toBe('Charlie');
    expect(service.currentCall()?.call_type).toBe('video');
  });

  it('should reject call and return to idle state', () => {
    service.currentCall.set({
      call_id: 101,
      partner_id: 2,
      partner_name: 'Bob',
      call_type: 'audio',
      is_caller: false,
    });
    service.callState.set('ringing');

    service.rejectCall('declined');

    expect(service.callState()).toBe('idle');
    expect(service.currentCall()).toBeNull();
  });

  it('should end active call and reset state to idle', () => {
    service.currentCall.set({
      call_id: 101,
      partner_id: 2,
      partner_name: 'Bob',
      call_type: 'video',
      is_caller: true,
    });
    service.callState.set('connected');

    service.endCall('completed');

    expect(service.callState()).toBe('idle');
    expect(service.currentCall()).toBeNull();
    expect(service.isVideoMuted()).toBe(false);
    expect(service.isRemoteVideoMuted()).toBe(false);
  });

  it('should handle call_rejected signaling message and set error', () => {
    service.callState.set('calling');
    (service as any).handleSignalingMessage({
      type: 'call_rejected',
      call_id: 101,
      reason: 'busy',
    });

    expect(service.callState()).toBe('idle');
    expect(service.error()).toBe('Call busy.');
  });

  it('should toggle local audio mute state correctly', () => {
    const fakeAudioTrack = {
      kind: 'audio',
      enabled: true,
      stop: vi.fn(),
    } as unknown as MediaStreamTrack;

    const fakeStream = {
      getAudioTracks: () => [fakeAudioTrack],
      getVideoTracks: () => [],
      getTracks: () => [fakeAudioTrack],
    } as unknown as MediaStream;

    service.localStream.set(fakeStream);

    const isEnabledFirst = service.toggleAudio();
    expect(isEnabledFirst).toBe(false);
    expect(service.isAudioMuted()).toBe(true);

    const isEnabledSecond = service.toggleAudio();
    expect(isEnabledSecond).toBe(true);
    expect(service.isAudioMuted()).toBe(false);
  });

  it('should toggle local video mute state when video track is present', async () => {
    const fakeVideoTrack = {
      kind: 'video',
      enabled: true,
      stop: vi.fn(),
    } as unknown as MediaStreamTrack;

    const fakeStream = {
      getAudioTracks: () => [],
      getVideoTracks: () => [fakeVideoTrack],
      getTracks: () => [fakeVideoTrack],
    } as unknown as MediaStream;

    service.localStream.set(fakeStream);

    const isEnabledFirst = await service.toggleVideo();
    expect(isEnabledFirst).toBe(false);
    expect(service.isVideoMuted()).toBe(true);

    const isEnabledSecond = await service.toggleVideo();
    expect(isEnabledSecond).toBe(true);
    expect(service.isVideoMuted()).toBe(false);
  });
});
