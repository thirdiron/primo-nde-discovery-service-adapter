import { ButtonType } from '../shared/button-type.enum';
import { EntityType } from '../shared/entity-type.enum';
import { IconType } from '../shared/icon-type.enum';
import { SearchEntity } from './searchEntity.types';

export interface PrimoViewModel {
  onlineLinks: OnlineLink[];
  consolidatedCoverage: string;
  // Only present on Primo builds released before November 2026.
  directLink?: string;
  ariaLabel: string;
}

// The members of Primo's `nde-online-availability` host component that we rely on.
export interface PrimoAvailabilityHost {
  searchResult?: SearchEntity | null;
  onlineAvailability?: string | null;
  // Builds released before November 2026 take the view model's `directLink`; newer builds take no argument.
  onAvailabilityClicked?: (directLink?: string) => void;
}

export interface OnlineLink {
  type: 'PDF' | 'HTML';
  url: string;
  ariaLabel?: string;
  source?: string; // quicklink, unpaywall
  label?: string; // Get PDF, Read Online
}

export type LinkEntityType = 'PDF' | 'HTML' | 'primoAvailability' | EntityType;

// used for the combined link values from the Primo viewModel and Third Iron display options
export interface StackLink {
  entityType: LinkEntityType; // PDF, HTML, primoAvailability, plus TI EntityType (Article, Journal, Unknown)
  url: string;
  // When set, clicking the link calls this instead of navigating to `url`. Call it synchronously
  // from the click handler so any `window.open` inside it keeps the user gesture.
  action?: () => void;
  ariaLabel?: string;
  icon?: IconType; // Third Iron icons
  label?: string;
  mainButtonType?: ButtonType; // Third Iron button types
  showSecondaryButton?: boolean;
  source?: string; // quicklink, primoAvailability, thirdIron
}
