import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store } from '@ngrx/store';

import { ThirdIronButtonsComponent } from './third-iron-buttons.component';
import { ExlibrisStoreService } from '../../services/exlibris-store.service';
import { SearchEntityService } from '../../services/search-entity.service';
import { ConfigService } from '../../services/config.service';
import { MOCK_MODULE_PARAMETERS } from '../../services/config.service.spec';
import { ButtonInfoService } from '../../services/button-info.service';

describe('ThirdIronButtonsComponent', () => {
  // Minimal mock Store supporting select(projectionFn)
  let state$: BehaviorSubject<any>;
  const mockStore = {
    select: (projection: (state: any) => any) => state$.asObservable().pipe(map(projection)),
  } as unknown as Store<any>;

  beforeEach(async () => {
    state$ = new BehaviorSubject<any>({});

    await TestBed.configureTestingModule({
      imports: [ThirdIronButtonsComponent],
      providers: [
        ExlibrisStoreService,
        ConfigService,
        { provide: Store, useValue: mockStore },
        { provide: 'MODULE_PARAMETERS', useValue: MOCK_MODULE_PARAMETERS },
        // Minimal stubs to satisfy DI; we don't execute enhance in this basic test
        { provide: SearchEntityService, useValue: { shouldEnhance: () => false } },
        {
          provide: ButtonInfoService,
          useValue: {
            getDisplayInfo: () => new BehaviorSubject(null).asObservable(),
            buildCombinedLinks: () => [],
            buildPrimoLinks: () => [],
          },
        },
      ],
    }).compileComponents();
  });

  it('should create component successfully', () => {
    const fixture = TestBed.createComponent(ThirdIronButtonsComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
