import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';

import { ThirdIronJournalCoverComponent } from './third-iron-journal-cover.component';
import { JournalCoverService } from '../../services/journal-cover.service';
import { ExlibrisStoreService } from '../../services/exlibris-store.service';
import { MOCK_MODULE_PARAMETERS } from '../../services/config.service.spec';

describe('ThirdIronJournalCoverComponent', () => {
  let httpTesting: HttpTestingController;
  let journalCoverService: JournalCoverService;
  let component: ThirdIronJournalCoverComponent;
  let fixture: ComponentFixture<ThirdIronJournalCoverComponent>;
  let state$: BehaviorSubject<any>;
  const mockStore = {
    select: (projection: (state: any) => any) => state$.asObservable().pipe(map(projection)),
  } as unknown as Store<any>;

  beforeEach(async () => {
    state$ = new BehaviorSubject<any>({});
    await TestBed.configureTestingModule({
      imports: [ThirdIronJournalCoverComponent],
      providers: [
        JournalCoverService,
        ExlibrisStoreService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: 'MODULE_PARAMETERS',
          useValue: MOCK_MODULE_PARAMETERS,
        },
        {
          provide: Store,
          useValue: mockStore,
        },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    journalCoverService = TestBed.inject(JournalCoverService);

    fixture = TestBed.createComponent(ThirdIronJournalCoverComponent);
    component = fixture.componentInstance;
    // fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
