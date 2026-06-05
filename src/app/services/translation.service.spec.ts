import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

import { TranslationService } from './translation.service';
import { DebugLogService } from './debug-log.service';

interface SetupOptions {
  translationsByKey?: Record<string, string>;
}

const setup = (opts: SetupOptions = {}) => {
  const streamedKeys: string[] = [];
  const streamSubjects = new Map<string, BehaviorSubject<string>>();
  const langChange$ = new BehaviorSubject<any>({ lang: 'en', previousLang: 'fr' });

  const getOrCreateSubject = (key: string): BehaviorSubject<string> => {
    if (!streamSubjects.has(key)) {
      const initial = opts.translationsByKey?.[key] ?? key;
      streamSubjects.set(key, new BehaviorSubject<string>(initial));
    }
    return streamSubjects.get(key)!;
  };

  const translateMock = {
    stream: (key: string) => {
      streamedKeys.push(key);
      return getOrCreateSubject(key).asObservable();
    },
    onLangChange: langChange$.asObservable(),
  } as unknown as TranslateService;

  const debugLogMock = {
    debug: jasmine.createSpy('debug'),
  } as unknown as DebugLogService;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      TranslationService,
      { provide: TranslateService, useValue: translateMock },
      { provide: DebugLogService, useValue: debugLogMock },
    ],
  });

  const service = TestBed.inject(TranslationService);
  return { service, streamSubjects, streamedKeys, debugLogMock };
};

describe('TranslationService', () => {
  it('emits fallback when translation equals the key, otherwise emits translated value', () => {
    const { service, streamSubjects, streamedKeys, debugLogMock } = setup({
      translationsByKey: { TRANSLATION_KEY: 'TRANSLATION_KEY' },
    });

    const received: string[] = [];
    const sub = service
      .getTranslatedText$('TRANSLATION_KEY', 'Fallback')
      .subscribe(v => received.push(v));

    expect(streamedKeys).toEqual(['TRANSLATION_KEY']);
    expect(received[0]).toBe('Fallback');

    streamSubjects.get('TRANSLATION_KEY')!.next('Translated!');
    expect(received[1]).toBe('Translated!');

    streamSubjects.get('TRANSLATION_KEY')!.next('');
    expect(received[2]).toBe('Fallback');

    expect((debugLogMock as any).debug).toHaveBeenCalledWith('Translation.langChange', {
      lang: 'en',
    });

    sub.unsubscribe();
  });

  describe('View Id (VID) prefix cascade', () => {
    const libKey = 'LibKey.articleLinkText';
    const prefixedKey = 'Campus1ViewId.LibKey.articleLinkText';

    it('uses prefixed translation when prefixed key resolves', () => {
      const { service, streamedKeys } = setup({
        translationsByKey: {
          [prefixedKey]: 'View 1 Read Article',
          [libKey]: 'Read Article',
        },
      });
      spyOn(service as any, 'getVidSuffix').and.returnValue('Campus1ViewId');

      const received: string[] = [];
      const sub = service.getTranslatedText$(libKey, 'Default').subscribe(v => received.push(v));

      expect(streamedKeys).toEqual([prefixedKey, libKey]);
      expect(received[0]).toBe('View 1 Read Article');
      sub.unsubscribe();
    });

    it('falls back to unprefixed LibKey key when prefixed key is missing', () => {
      const { service, streamedKeys } = setup({
        translationsByKey: {
          [prefixedKey]: prefixedKey,
          [libKey]: 'Read Article',
        },
      });
      spyOn(service as any, 'getVidSuffix').and.returnValue('Campus1ViewId');

      const received: string[] = [];
      const sub = service.getTranslatedText$(libKey, 'Default').subscribe(v => received.push(v));

      expect(streamedKeys).toEqual([prefixedKey, libKey]);
      expect(received[0]).toBe('Read Article');
      sub.unsubscribe();
    });

    it('falls back to default text when both prefixed and unprefixed keys are missing', () => {
      // setting key values to the key itself is the behavior from the translation service when no value is found for a given key
      const { service, streamedKeys } = setup({
        translationsByKey: {
          [prefixedKey]: prefixedKey,
          [libKey]: libKey,
        },
      });
      spyOn(service as any, 'getVidSuffix').and.returnValue('Campus1ViewId');

      const received: string[] = [];
      const sub = service.getTranslatedText$(libKey, 'Default').subscribe(v => received.push(v));

      expect(streamedKeys).toEqual([prefixedKey, libKey]);
      expect(received[0]).toBe('Default');
      sub.unsubscribe();
    });

    it('derives prefix from only the segment after the last colon in URL vid', () => {
      const { service, streamedKeys } = setup({
        translationsByKey: {
          [prefixedKey]: 'Campus Read Article',
        },
      });
      spyOn(URLSearchParams.prototype, 'get').and.returnValue('01COLSCHL_INST:Campus1ViewId');

      const sub = service.getTranslatedText$(libKey, 'Default').subscribe();

      expect(streamedKeys[0]).toBe(prefixedKey);
      sub.unsubscribe();
    });

    it('does not prefix non-LibKey keys', () => {
      const { service, streamedKeys } = setup();
      spyOn(service as any, 'getVidSuffix').and.returnValue('Campus1ViewId');

      const sub = service.getTranslatedText$('fulldisplay.HTML', 'Read Online').subscribe();

      expect(streamedKeys).toEqual(['fulldisplay.HTML']);
      sub.unsubscribe();
    });

    it('skips prefixed lookup when vid suffix is empty', () => {
      const { service, streamedKeys } = setup();
      spyOn(service as any, 'getVidSuffix').and.returnValue('');

      const sub = service.getTranslatedText$(libKey, 'Default').subscribe();

      expect(streamedKeys).toEqual([libKey]);
      sub.unsubscribe();
    });
  });
});
