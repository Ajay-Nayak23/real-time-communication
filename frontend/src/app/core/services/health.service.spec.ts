import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HealthService } from './health.service';
import { environment } from '../../../environments/environment';

describe('HealthService', () => {
  let service: HealthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HealthService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(HealthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return isConnected=true when backend returns ok', () => {
    service.checkHealth().subscribe((res) => {
      expect(res.isConnected).toBe(true);
      expect(res.status).toBe('ok');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/health/`);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'ok' });
  });

  it('should return isConnected=false when backend fails', () => {
    service.checkHealth().subscribe((res) => {
      expect(res.isConnected).toBe(false);
      expect(res.status).toBe('disconnected');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/health/`);
    req.error(new ProgressEvent('error'));
  });
});
