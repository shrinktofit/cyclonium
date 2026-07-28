import {
  HeaderStylePlatformAdapter,
  type HeaderStyleMinigameApi,
} from '../minigame-shared/index.js';

export class BytedancePlatformAdapter extends HeaderStylePlatformAdapter {
  constructor(api: HeaderStyleMinigameApi) {
    super('bytedance', api, 'string');
  }
}
