import { Component, computed, effect, input, signal } from '@angular/core';
import { EntityType } from 'src/app/shared/entity-type.enum';
import { IconType } from 'src/app/shared/icon-type.enum';
import { BaseButtonComponent } from '../base-button/base-button.component';
import { TranslationService } from '../../services/translation.service';
import { StackLink } from 'src/app/types/primoViewModel.types';
import { StackedButtonComponent } from '../stacked-dropdown/components/stacked-button.component';

@Component({
  selector: 'custom-browzine-button',
  standalone: true,
  imports: [BaseButtonComponent, StackedButtonComponent],
  templateUrl: './browzine-button.component.html',
  styleUrl: './browzine-button.component.scss',
})
export class BrowzineButtonComponent {
  url = input.required<string>();
  entityType = input.required<EntityType>();
  stack = input<boolean>(false);
  stackType = input<'main' | 'dropdown'>('dropdown');
  link = input<StackLink>({
    entityType: EntityType.Unknown,
    url: '',
    label: '',
  });

  EntityType = EntityType;
  IconType = IconType;

  buttonText = signal<string>('');

  updatedLink = computed(() => {
    const originalLink = this.link();
    const label = this.buttonText() || originalLink.label;
    return {
      ...originalLink,
      label,
      icon: IconType.BrowZine,
      source: originalLink.source ?? 'thirdIron',
    };
  });

  constructor(private translationService: TranslationService) {
    effect(
      onCleanup => {
        const translation = this.getButtonTextTranslation(this.entityType());
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

  private getButtonTextTranslation(
    entityType: EntityType
  ): { translationKey: string; fallbackText: string } | null {
    if (entityType === EntityType.Journal) {
      return {
        translationKey: 'LibKey.journalBrowZineWebLinkText',
        fallbackText: 'View Journal Contents',
      };
    } else {
      return {
        translationKey: 'LibKey.articleBrowZineWebLinkText',
        fallbackText: 'View Issue Contents',
      };
    }
  }
}
