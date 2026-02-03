import { Injectable, Optional } from '@angular/core';
import { SearchEntity } from '../types/searchEntity.types';
import { EntityType } from '../shared/entity-type.enum';
import { DebugLogService } from './debug-log.service';

@Injectable({
  providedIn: 'root',
})
export class SearchEntityService {
  constructor(@Optional() private debugLog?: DebugLogService) {}

  isFiltered = (result: SearchEntity): boolean => {
    let validation = false;

    // On new result object is it:
    // result.pnx.delivery.delcategory[0] !== "Remote Search Resource"

    // if (result && result.delivery) {
    //   if (result.delivery.deliveryCategory && result.delivery.deliveryCategory.length > 0) {
    //     var deliveryCategory = result.delivery.deliveryCategory[0].trim().toLowerCase();

    //     if (deliveryCategory === "alma-p" && !showPrintRecords()) {
    //       validation = true;
    //     }
    //   }
    // }

    return validation;
  };

  shouldEnhance = (result: SearchEntity): { shouldEnhanceCover: boolean; shouldEnhanceButtons: boolean } => {
    let shouldEnhanceCover = false;
    let shouldEnhanceButtons = false;

    const isJournal = this.isJournal(result);
    const isArticle = this.isArticle(result);
    const hasIssn = !!this.getIssn(result);
    const hasDoi = !!this.getDoi(result);

    if (!this.isFiltered(result)) {
      // Cover images: show for journals with ISSN or articles with ISSN
      if ((isJournal && hasIssn) || (isArticle && (hasIssn || hasDoi))) {
        shouldEnhanceCover = true;
      }

      // Buttons: show for journals with ISSN or articles with a DOI
      if (isJournal && hasIssn) {
        shouldEnhanceButtons = true;
      }

      if (isArticle && hasDoi) {
        shouldEnhanceButtons = true;
      }
    }

    this.debugLog?.debug?.('SearchEntity.shouldEnhance', {
      isJournal,
      isArticle,
      hasIssn,
      hasDoi,
      shouldEnhanceCover,
      shouldEnhanceButtons,
    });

    return { shouldEnhanceCover, shouldEnhanceButtons };
  };

  isArticle = (result: SearchEntity): boolean => {
    var validation = false;

    if (result && result.pnx) {
      if (result.pnx.display && result.pnx.display.type) {
        var contentType = result.pnx.display.type[0]?.trim().toLowerCase();

        if (contentType?.indexOf('article') > -1) {
          validation = true;
        }
      }
    }

    return validation;
  };

  isJournal = (result: SearchEntity): boolean => {
    var validation = false;

    if (result && result.pnx) {
      if (result.pnx.display && result.pnx.display.type) {
        var contentType = result.pnx.display.type[0]?.trim().toLowerCase();

        if (contentType?.indexOf('journal') > -1) {
          validation = true;
        }
      }
    }

    return validation;
  };

  getIssn = (result: SearchEntity): string => {
    var issn = '';

    if (result && result.pnx && result.pnx.addata) {
      if (result.pnx.addata.issn) {
        if (result.pnx.addata.issn.length > 1) {
          issn = result.pnx.addata.issn
            .filter(function (issn) {
              return issn.length < 10 && /[\S]{4}\-[\S]{4}/.test(issn);
            })
            .join(',')
            .trim()
            .replace(/-/g, '');
        } else {
          if (result.pnx.addata.issn[0]) {
            issn = result.pnx.addata.issn[0].trim().replace('-', '');
          }
        }
      }

      if (result.pnx.addata.eissn && !issn) {
        if (result.pnx.addata.eissn.length > 1) {
          issn = result.pnx.addata.eissn
            .filter(function (issn) {
              return issn.length < 10 && /[\S]{4}\-[\S]{4}/.test(issn);
            })
            .join(',')
            .trim()
            .replace(/-/g, '');
        } else {
          if (result.pnx.addata.eissn[0]) {
            issn = result.pnx.addata.eissn[0].trim().replace('-', '');
          }
        }
      }
    }

    const encoded = encodeURIComponent(issn);
    return encoded;
  };

  getDoi = (result: SearchEntity): string => {
    var doi = '';
    if (result && result.pnx) {
      if (result.pnx.addata && result.pnx.addata.doi) {
        if (result.pnx.addata.doi[0]) {
          doi = result.pnx.addata.doi[0].trim();
        }
      }
    }

    const encoded = encodeURIComponent(doi);
    return encoded;
  };

  getEntityType = (entity: SearchEntity): EntityType | undefined => {
    let type = EntityType.Unknown;

    if (this.isJournal(entity) && this.getIssn(entity)) {
      return EntityType.Journal;
    }

    if (this.isArticle(entity) && this.getDoi(entity)) {
      return EntityType.Article;
    }

    if (this.isArticle(entity) && !this.getDoi(entity) && this.getIssn(entity)) {
      return EntityType.Journal;
    }

    return type;
  };
}
