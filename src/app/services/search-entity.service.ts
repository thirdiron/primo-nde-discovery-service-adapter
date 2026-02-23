import { Injectable } from '@angular/core';
import { SearchEntity } from '../types/searchEntity.types';
import { EntityType } from '../shared/entity-type.enum';

@Injectable({
  providedIn: 'root',
})
export class SearchEntityService {
  constructor() {}

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

  shouldEnhanceCover = (result: SearchEntity): boolean => {
    let shouldEnhanceCover = false;

    const isJournal = this.isJournal(result);
    const isArticle = this.isArticle(result);
    const hasIssn = !!this.getIssn(result);
    const hasDoi = !!this.getDoi(result);

    if (isArticle && hasDoi) {
      shouldEnhanceCover = true;
    }

    if (isArticle && !hasDoi && hasIssn) {
      shouldEnhanceCover = true;
    }

    if (isJournal && hasIssn) {
      shouldEnhanceCover = true;
    }

    return shouldEnhanceCover;
  };

  shouldEnhanceButtons = (result: SearchEntity): boolean => {
    let shouldEnhanceButtons = false;

    if (!this.isFiltered(result)) {
      const isJournal = this.isJournal(result);
      const isArticle = this.isArticle(result);
      const hasIssn = !!this.getIssn(result);
      const hasDoi = !!this.getDoi(result);

      // Buttons: show for journals with ISSN or articles with a DOI
      // not for articles with only ISSN
      if (isJournal && hasIssn) {
        shouldEnhanceButtons = true;
      }

      if (isArticle && hasDoi) {
        shouldEnhanceButtons = true;
      }
    }

    return shouldEnhanceButtons;
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

    return type;
  };
}
