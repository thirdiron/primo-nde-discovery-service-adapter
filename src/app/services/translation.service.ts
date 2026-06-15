import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, combineLatest, map } from 'rxjs';
import { DebugLogService } from './debug-log.service';

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  // Memoized vid suffix (only the segment after the last ':' of the URL `vid` param).
  private vidSuffix: string | null = null;

  constructor(
    private translate: TranslateService,
    private debugLog: DebugLogService
  ) {
    // Log language changes once at the translation boundary so downstream callers don't need to.
    const onLangChange$ = (this.translate as any)?.onLangChange;
    if (onLangChange$ && typeof onLangChange$.subscribe === 'function') {
      onLangChange$.subscribe((evt: any) => {
        this.debugLog.debug('Translation.langChange', {
          lang: evt?.lang ?? null,
        });
      });
    }
  }

  /**
   * Gets translated text with fallback support
   * @param translationKey - The translation key to look up
   * @param fallbackText - Fallback text if translation is not found or equals the key
   * @returns Observable that emits the translated text (and updates on language changes) or fallback text
   */
  getTranslatedText$(translationKey: string, fallbackText: string): Observable<string> {
    const lookupKeys = this.getLookupKeys(translationKey);

    if (lookupKeys.length === 1) {
      // no VID value found, so use the single lookup key
      const key = lookupKeys[0];
      return this.translate
        .stream(key)
        .pipe(map(value => (this.isResolved(key, value) ? value : fallbackText)));
    }

    return combineLatest(lookupKeys.map(key => this.translate.stream(key))).pipe(
      map(values => {
        for (let i = 0; i < lookupKeys.length; i++) {
          if (this.isResolved(lookupKeys[i], values[i])) {
            return values[i];
          }
        }
        return fallbackText;
      })
    );
  }

  /**
   * For LibKey custom-label keys, try VID prefixed key first, then unprefixed.
   * All other keys use a single lookup - e.g. Primo's own native labels.
   */
  private getLookupKeys(translationKey: string): string[] {
    if (translationKey.startsWith('LibKey.')) {
      const vidSuffix = this.getVidSuffix();
      if (vidSuffix) {
        return [`${vidSuffix}.${translationKey}`, translationKey];
      }
    }
    return [translationKey];
  }

  // We consider a translation lookup successful if it is not the same as the key and has a truthy value.
  private isResolved(key: string, value: string | undefined): boolean {
    return !!value && value !== key;
  }

  /**
   * Reads the `vid` from the URL and returns only the segment after the last ':'.
   * The value is stable for a given page load, so it is computed once and memoized.
   */
  private getVidSuffix(): string {
    if (this.vidSuffix === null) {
      let vid = '';
      try {
        vid = new URLSearchParams(location.search).get('vid') || '';
      } catch {
        vid = '';
      }
      this.vidSuffix = vid.includes(':') ? vid.slice(vid.lastIndexOf(':') + 1) : vid;
    }
    return this.vidSuffix;
  }

  // POSSIBLE FUTURE ADDITIONS //

  /**
   * Sets the current language
   * @param language - The language code to set
   */
  // setLanguage(language: string): void {
  //   this.translate.use(language);
  // }

  /**
   * Gets the current language
   * @returns The current language code
   */
  // getCurrentLanguage(): string {
  //   return this.translate.currentLang;
  // }

  /**
   * Gets all available languages
   * @returns Array of available language codes
   */
  // getAvailableLanguages(): string[] {
  //   return this.translate.getLangs();
  // }
}
