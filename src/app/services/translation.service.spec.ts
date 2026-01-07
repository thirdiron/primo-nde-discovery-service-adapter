import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

import { TranslationService } from './translation.service';
import { DebugLogService } from './debug-log.service';

describe('TranslationService', () => {
  it('emits fallback when translation equals the key, otherwise emits translated value', () => {
    const stream$ = new BehaviorSubject<string>('TRANSLATION_KEY');
    const langChange$ = new BehaviorSubject<any>({ lang: 'en', previousLang: 'fr' });

    const translateMock = {
      stream: (key: string) => {
        expect(key).toBe('TRANSLATION_KEY');
        return stream$.asObservable();
      },
      onLangChange: langChange$.asObservable(),
    } as unknown as TranslateService;

    const debugLogMock = {
      debug: jasmine.createSpy('debug'),
    } as unknown as DebugLogService;

    TestBed.configureTestingModule({
      providers: [
        TranslationService,
        { provide: TranslateService, useValue: translateMock },
        { provide: DebugLogService, useValue: debugLogMock },
      ],
    });

    const service = TestBed.inject(TranslationService);

    const received: string[] = [];
    const sub = service
      .getTranslatedText$('TRANSLATION_KEY', 'Fallback')
      .subscribe(v => received.push(v));

    // Initial emission equals key → fallback
    expect(received[0]).toBe('Fallback');

    // Update: a real translation should pass through
    stream$.next('Translated!');
    expect(received[1]).toBe('Translated!');

    // Update: empty string should fall back
    stream$.next('');
    expect(received[2]).toBe('Fallback');

    // Language change is logged
    expect((debugLogMock as any).debug).toHaveBeenCalledWith('Translation.langChange', {
      lang: 'en',
      previousLang: 'fr',
    });

    sub.unsubscribe();
  });
});
