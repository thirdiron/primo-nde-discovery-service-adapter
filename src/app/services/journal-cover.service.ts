import { Injectable } from '@angular/core';
import { SearchEntity } from '../types/searchEntity.types';
import { map, Observable, of } from 'rxjs';
import { SearchEntityService } from './search-entity.service';
import { EntityType } from '../shared/entity-type.enum';
import { HttpService } from './http.service';
import { ApiResult, ArticleData, JournalData } from '../types/tiData.types';
import { ConfigService } from './config.service';

export const DEFAULT_JOURNAL_COVER_INFO = {
  ariaLabel: '',
  buttonText: '',
  color: '',
  entityType: EntityType.Unknown,
  icon: '',
  url: '',
  showBrowzineButton: false,
};

/**
 * This Service is responsible for initiating the call to Third Iron article/journal endpoints
 * to retrieve a Journal Cover image url
 */
@Injectable({
  providedIn: 'root',
})
export class JournalCoverService {
  constructor(
    private httpService: HttpService,
    private searchEntityService: SearchEntityService,
    private configService: ConfigService
  ) {}

  getJournalCoverUrl(entity: SearchEntity): Observable<string> {
    // Route cover enhancement based on cover-eligibility (shouldEnhanceCover) and
    // available identifiers, rather than getEntityType (which is DOI-centric for articles).
    const shouldEnhanceCover = this.searchEntityService.shouldEnhanceCover(entity);
    if (!shouldEnhanceCover) {
      return of('');
    }

    const isArticle = this.searchEntityService.isArticle(entity);
    const doi = this.searchEntityService.getDoi(entity);
    const issn = this.searchEntityService.getIssn(entity);

    // If a DOI is present, use the article endpoint (it returns the journal via include=journal).
    if (isArticle && doi) {
      return this.httpService
        .getArticle(doi)
        .pipe(map(res => this.transformRes(res, EntityType.Article)));
    }

    // Otherwise, if an ISSN is present (journals and ISSN-only articles), use the journal endpoint.
    if (issn) {
      return this.httpService
        .getJournal(issn)
        .pipe(map(res => this.transformRes(res, EntityType.Journal)));
    }

    return of('');
  }

  transformRes(response: ApiResult, type: EntityType): string {
    const data = this.httpService.getData(response);
    const journal = this.httpService.getIncludedJournal(response);

    // If our response object data isn't an Article and isn't a Journal,
    // we can't proceed, so return empty string
    if (
      !this.httpService.isArticle(data) &&
      !this.httpService.isJournal(data)
    ) {
      return '';
    }

    const coverImageUrl = this.getCoverImageUrl(type, data, journal);
    const defaultCoverImage = this.isDefaultCoverImage(coverImageUrl);

    if (
      coverImageUrl &&
      !defaultCoverImage &&
      this.configService.showJournalCoverImages()
    ) {
      return coverImageUrl;
    }

    return '';
  }

  private getCoverImageUrl(
    type: EntityType,
    data: ArticleData | JournalData,
    journal: JournalData | null
  ): string {
    let coverImageUrl = '';

    if (type === EntityType.Journal && this.httpService.isJournal(data)) {
      if (data && data.coverImageUrl) {
        coverImageUrl = data.coverImageUrl;
      }
    }

    if (type === EntityType.Article) {
      if (journal && journal.coverImageUrl) {
        coverImageUrl = journal.coverImageUrl;
      }
    }

    return coverImageUrl;
  }

  private isDefaultCoverImage(coverImageUrl: string): boolean {
    return !!(
      coverImageUrl && coverImageUrl.toLowerCase().indexOf('default') > -1
    );
  }
}
