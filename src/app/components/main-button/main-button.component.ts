import { Component, effect, input, computed, signal } from '@angular/core';
import { IconType } from 'src/app/shared/icon-type.enum';
import { BaseButtonComponent } from '../base-button/base-button.component';
import { ButtonType } from 'src/app/shared/button-type.enum';
import { EntityType } from 'src/app/shared/entity-type.enum';
import { TranslationService } from '../../services/translation.service';
import { StackLink } from 'src/app/types/primoViewModel.types';
import { StackedButtonComponent } from '../stacked-dropdown/components/stacked-button.component';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'main-button',
  standalone: true,
  imports: [BaseButtonComponent, StackedButtonComponent],
  templateUrl: './main-button.component.html',
  styleUrl: './main-button.component.scss',
})
export class MainButtonComponent {
  IconType = IconType;
  url = input.required<string>();
  buttonType = input.required<ButtonType>();
  stack = input<boolean>(false);
  stackType = input<'main' | 'dropdown'>('main');
  link = input<StackLink>({
    entityType: EntityType.Unknown,
    url: '',
    label: '',
  });

  // Derived values from inputs
  buttonText = signal<string>('');
  buttonIcon = computed<IconType>(() => this.getButtonIcon(this.buttonType()));

  updatedLink = computed(() => {
    const originalLink = this.link();
    const computedLabel = this.buttonText() || originalLink.label;
    const defaultIcon = IconType.None;
    const computedIcon = this.buttonIcon() || originalLink.icon || defaultIcon;

    return {
      ...originalLink,
      label: computedLabel,
      icon: computedIcon,
      source: originalLink.source ?? 'thirdIron',
    };
  });

  constructor(
    private translationService: TranslationService,
    private navigationService: NavigationService
  ) {
    effect(
      onCleanup => {
        const translation = this.getButtonTextTranslation(this.buttonType());
        if (!translation) {
          this.buttonText.set('');
          return;
        }

        const sub = this.translationService
          .getTranslatedText$(translation.translationKey, translation.fallbackText)
          .subscribe(text => this.buttonText.set(text));

        onCleanup(() => sub.unsubscribe());
      },
      { allowSignalWrites: true }
    );
  }

  onClick(event: MouseEvent) {
    // We’ve seen some discovery services intercept basic a href links, and have
    // been encouraged to intercept clicks more closely. We should continue
    // intercepting clicks like this unless we hear feedback from discovery
    // service vendors that this is no longer desired or necessary.
    event.preventDefault();
    event.stopPropagation();

    this.navigationService.openUrl(this.url());

    return false;
  }

  private getButtonTextTranslation(
    buttonType: ButtonType
  ): { translationKey: string; fallbackText: string } | null {
    switch (buttonType) {
      case ButtonType.Retraction:
        return {
          translationKey: 'LibKey.articleRetractionWatchText',
          fallbackText: 'Retracted Article',
        };
      case ButtonType.ExpressionOfConcern:
        return {
          translationKey: 'LibKey.articleExpressionOfConcernText',
          fallbackText: 'Expression of Concern',
        };
      case ButtonType.ProblematicJournalArticle:
        return {
          translationKey: 'LibKey.problematicJournalText',
          fallbackText: 'Problematic Journal',
        };
      case ButtonType.DirectToPDF:
        return {
          translationKey: 'LibKey.articlePDFDownloadLinkText',
          fallbackText: 'Download PDF',
        };
      case ButtonType.ArticleLink:
        return {
          translationKey: 'LibKey.articleLinkText',
          fallbackText: 'Read Article',
        };
      case ButtonType.DocumentDelivery:
        return {
          translationKey: 'LibKey.documentDeliveryFulfillmentText',
          fallbackText: 'Request PDF',
        };
      case ButtonType.UnpaywallDirectToPDF:
        return {
          translationKey: 'LibKey.articlePDFDownloadViaUnpaywallText',
          fallbackText: 'Download PDF (via Unpaywall)',
        };
      case ButtonType.UnpaywallArticleLink:
        return {
          translationKey: 'LibKey.articleLinkViaUnpaywallText',
          fallbackText: 'Read Article (via Unpaywall)',
        };
      case ButtonType.UnpaywallManuscriptPDF:
        return {
          translationKey: 'LibKey.articleAcceptedManuscriptPDFViaUnpaywallText',
          fallbackText: 'Download PDF (Accepted Manuscript via Unpaywall)',
        };
      case ButtonType.UnpaywallManuscriptLink:
        return {
          translationKey: 'LibKey.articleAcceptedManuscriptArticleLinkViaUnpaywallText',
          fallbackText: 'Read Article (Accepted Manuscript via Unpaywall)',
        };
    }
    return null;
  }

  getButtonIcon(buttonType: ButtonType): IconType {
    let icon = IconType.None;
    switch (buttonType) {
      case ButtonType.Retraction:
        icon = IconType.ArticleAlert;
        break;
      case ButtonType.ExpressionOfConcern:
        icon = IconType.ArticleAlert;
        break;
      case ButtonType.ProblematicJournalArticle:
        icon = IconType.ArticleAlert;
        break;
      case ButtonType.DirectToPDF:
        icon = IconType.DownloadPDF;
        break;
      case ButtonType.ArticleLink:
        icon = IconType.ArticleLink;
        break;
      case ButtonType.DocumentDelivery:
        icon = IconType.DownloadPDF;
        break;
      case ButtonType.UnpaywallDirectToPDF:
        icon = IconType.DownloadPDF;
        break;
      case ButtonType.UnpaywallArticleLink:
        icon = IconType.ArticleLink;
        break;
      case ButtonType.UnpaywallManuscriptPDF:
        icon = IconType.DownloadPDF;
        break;
      case ButtonType.UnpaywallManuscriptLink:
        icon = IconType.ArticleLink;
        break;
    }

    return icon;
  }
}
