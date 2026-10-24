import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CallService } from './call.service';
import { CallRecord } from '../models/call.model';

describe('CallService', () => {
  let service: CallService;
  let httpTesting: HttpTestingController;

  const mockUser1 = { id: 1, email: 'caller@example.com', name: 'Alice' };
  const mockUser2 = { id: 2, email: 'callee@example.com', name: 'Bob' };

  const mockCall: CallRecord = {
    id: 10,
    uuid: 'uuid-1234',
    caller: mockUser1,
    callee: mockUser2,
    other_participant: mockUser2,
    call_type: 'audio',
    status: 'ended',
    duration: 120,
    started_at: '2026-10-24T20:00:00Z',
    ended_at: '2026-10-24T20:02:00Z',
    created_at: '2026-10-24T19:59:50Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CallService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CallService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch call history via GET /api/calls/history/', () => {
    const mockResponse = {
      count: 1,
      next: null,
      previous: null,
      results: [mockCall],
    };

    service.getCallHistory({ call_type: 'audio', status: 'ended', page: 1 }).subscribe((res) => {
      expect(res.count).toBe(1);
      expect(res.results.length).toBe(1);
      expect(res.results[0].id).toBe(10);
    });

    const req = httpTesting.expectOne((r) => r.url.includes('/calls/history/'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('call_type')).toBe('audio');
    expect(req.request.params.get('status')).toBe('ended');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(mockResponse);
  });

  it('should fetch single call detail via GET /api/calls/:id/', () => {
    service.getCallDetail(10).subscribe((call) => {
      expect(call.id).toBe(10);
      expect(call.status).toBe('ended');
      expect(call.duration).toBe(120);
    });

    const req = httpTesting.expectOne((r) => r.url.includes('/calls/10/'));
    expect(req.request.method).toBe('GET');
    req.flush(mockCall);
  });
});
