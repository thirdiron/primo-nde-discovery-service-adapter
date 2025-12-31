import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { map, take, toArray } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { ExlibrisStoreService } from './exlibris-store.service';
import { SearchEntity } from '../types/searchEntity.types';

describe('ExlibrisStoreService', () => {
  let service: ExlibrisStoreService;

  // Minimal mock Store that supports select(projectionFn)
  let state$: BehaviorSubject<any>;
  const mockStore = {
    select: (projection: (state: any) => any) => state$.asObservable().pipe(map(projection)),
  } as unknown as Store<any>;

  const makeEntity = (id: string): SearchEntity => ({
    pnx: {
      control: { recordid: [id] },
      addata: {},
      display: { title: ['t'], type: ['article'] },
    } as any,
  });

  const entityWith = (id: string) => makeEntity(id);

  const setState = (partial: any) => {
    state$.next({
      ...(state$.value || {}),
      ...partial,
    });
  };

  beforeEach(() => {
    state$ = new BehaviorSubject<any>({});

    TestBed.configureTestingModule({
      providers: [
        ExlibrisStoreService,
        {
          provide: Store,
          useValue: mockStore,
        },
      ],
    });

    service = TestBed.inject(ExlibrisStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns record by full-display.selectedRecordId when present', async () => {
    const id = 'cdi_selected_id';
    const entity = makeEntity(id);

    setState({
      ['full-display']: { selectedRecordId: id },
      Search: { entities: { [id]: entity } },
    });

    const result = await firstValueFrom(
      // No host fallback record provided -> selectedRecordId should be used.
      service.getRecordForEntity$(of(null)).pipe(take(1))
    );
    expect(result).toEqual(entity);
  });

  it('falls back to entity record id when no selectedRecordId', async () => {
    const fallbackId = 'cdi_fallback_id';
    const entity = makeEntity(fallbackId);

    setState({
      Search: { entities: { [fallbackId]: entity } },
    });

    const result = await firstValueFrom(
      service.getRecordForEntity$(of(entityWith(fallbackId))).pipe(take(1))
    );
    expect(result).toEqual(entity);
  });

  it('returns null when id not found in entities', async () => {
    const id = 'cdi_missing';
    setState({
      ['full-display']: { selectedRecordId: id },
      Search: { entities: {} },
    });

    const result = await firstValueFrom(
      service.getRecordForEntity$(of(entityWith('other-id'))).pipe(take(1))
    );
    expect(result).toBeNull();
  });

  it('emits updated record when full-display.selectedRecordId appears later', async () => {
    const initialId = 'cdi_initial';
    const dynamicId = 'cdi_dynamic';

    // Initially: user is in list view. Both initial and dynamic ids are in entities,
    // but there is no selectedRecordId yet. Should emit the fallback initial entity.
    const initialEntity = makeEntity(initialId);
    const dynamicEntity = makeEntity(dynamicId);
    setState({
      Search: { entities: { [initialId]: initialEntity, [dynamicId]: dynamicEntity } },
      ['full-display']: {},
    });

    const entity$ = new BehaviorSubject<SearchEntity | null>(entityWith(initialId));

    // Collect first two emissions from a single subscription:
    // 1) fallback initial entity (list view)
    // 2) selectedRecordId dynamic entity (full display selection appears)
    const emissionsPromise = firstValueFrom(
      service.getRecordForEntity$(entity$).pipe(take(2), toArray())
    );

    // Then: full-display.selectedRecordId is set to dynamic id and should emit dynamic entity.
    setState({
      ['full-display']: { selectedRecordId: dynamicId },
    });

    const emissions = await emissionsPromise;
    expect(emissions).toEqual([initialEntity, dynamicEntity]);
  });

  it('emits updated record when the provided fallback entity changes (reactive input)', async () => {
    const id1 = 'cdi_one';
    const id2 = 'cdi_two';
    const e1 = makeEntity(id1);
    const e2 = makeEntity(id2);

    // List view: no selectedRecordId, but entities contain both ids.
    setState({
      ['full-display']: {},
      Search: { entities: { [id1]: e1, [id2]: e2 } },
    });

    const entity$ = new BehaviorSubject<SearchEntity | null>(e1);

    // Collect first two emissions.
    const emissionsPromise = firstValueFrom(
      service.getRecordForEntity$(entity$).pipe(take(2), toArray())
    );

    // Switch host entity: should emit the new record.
    entity$.next(e2);

    const emissions = await emissionsPromise;
    expect(emissions).toEqual([e1, e2]);
  });
});
