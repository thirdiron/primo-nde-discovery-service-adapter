import { Component, input, computed, effect, signal } from '@angular/core';
import { EntityType } from 'src/app/shared/entity-type.enum';
import { IconType } from 'src/app/shared/icon-type.enum';
import { BaseButtonComponent } from '../base-button/base-button.component';
import { TranslationService } from '../../services/translation.service';
import { StackLink } from 'src/app/types/primoViewModel.types';
import { StackedButtonComponent } from '../stacked-dropdown/components/stacked-button.component';

@Component({
  selector: 'article-link-button',
  standalone: true,
  imports: [BaseButtonComponent, StackedButtonComponent],
  templateUrl: './article-link-button.component.html',
  styleUrl: './article-link-button.component.scss',
})
export class ArticleLinkButtonComponent {
  url = input.required<string>();
  stack = input<boolean>(false);
  stackType = input<'main' | 'dropdown'>('main');
  link = input<StackLink>({
    entityType: EntityType.Unknown,
    url: '',
    label: '',
  });

  EntityTypeEnum = EntityType;
  IconType = IconType;

  buttonText = signal<string>('');

  updatedLink = computed(() => {
    const originalLink = this.link();
    const label = this.buttonText() || originalLink.label;
    return {
      ...originalLink,
      label,
      icon: IconType.ArticleLink,
      source: originalLink.source ?? 'thirdIron',
    };
  });

  constructor(private translationService: TranslationService) {
    effect(
      onCleanup => {
        // Note: button text updates reactively via TranslateService stream subscription.
        const sub = this.translationService
          .getTranslatedText$('LibKey.articleLinkText', 'Read Article')
          .subscribe(text => this.buttonText.set(text));
        onCleanup(() => sub.unsubscribe());
      },
      { allowSignalWrites: true }
    );
  }
}
