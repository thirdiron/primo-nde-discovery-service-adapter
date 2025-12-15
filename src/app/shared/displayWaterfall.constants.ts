import { ButtonType } from '../shared/button-type.enum';
import { EntityType } from '../shared/entity-type.enum';
import { DisplayWaterfallResponse } from '../types/displayWaterfallResponse.types';

export const DEFAULT_DISPLAY_WATERFALL_RESPONSE: DisplayWaterfallResponse = {
  entityType: EntityType.Unknown,
  mainButtonType: ButtonType.None,
  mainUrl: '',
  secondaryUrl: '',
  showSecondaryButton: false,
  showBrowzineButton: false,
};
