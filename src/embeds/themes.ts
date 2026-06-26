export interface ThemePalette {
  small: number;
  medium: number;
  high: number;
  whale: number;
}

export const THEMES: Record<string, ThemePalette> = {
  // Clean Modern Light Mode (Apple-ish)
  'apple-classic-light': { small: 0xE5E5EA, medium: 0x007AFF, high: 0x34C759, whale: 0xFF9500 },
  'apple-rose-light':    { small: 0xF5E6E8, medium: 0xFF2D55, high: 0xAF52DE, whale: 0xFF3B30 },
  'apple-mint-light':    { small: 0xE8F5E9, medium: 0x5856D6, high: 0x30B0C7, whale: 0xFFCC00 },
  'apple-sand-light':    { small: 0xF7F5F0, medium: 0xA2845E, high: 0x4CD964, whale: 0xFF9500 },
  'apple-mono-light':    { small: 0xF2F2F7, medium: 0x8E8E93, high: 0x1C1C1E, whale: 0x000000 },

  // Clean Modern Dark Mode (Apple-ish)
  'apple-classic-dark':  { small: 0x2C2C2E, medium: 0x0A84FF, high: 0x30D158, whale: 0xFF9F0A },
  'apple-rose-dark':     { small: 0x3A2226, medium: 0xFF375F, high: 0xBF5AF2, whale: 0xFF453A },
  'apple-mint-dark':     { small: 0x1C2D24, medium: 0x5E5CE6, high: 0x64D2FF, whale: 0xFFD60A },
  'apple-sand-dark':     { small: 0x2A2722, medium: 0xC2A478, high: 0x34C759, whale: 0xFF9F0A },
  'apple-mono-dark':     { small: 0x1C1C1E, medium: 0x3A3A3C, high: 0x8E8E93, whale: 0xFFFFFF },

  // IDE-inspired Light Mode
  'vs-light':            { small: 0xE1E1E1, medium: 0x007ACC, high: 0x008000, whale: 0xA31515 },
  'github-light':        { small: 0xF6F8FA, medium: 0x0969DA, high: 0x1A7F37, whale: 0x9A6700 },
  'xcode-light':         { small: 0xF3F3F5, medium: 0x294C7A, high: 0x235728, whale: 0x833E29 },
  'intellij-light':      { small: 0xF2F2F2, medium: 0x000080, high: 0x808080, whale: 0x008000 },
  'solarized-light':     { small: 0xEEE8D5, medium: 0x268BD2, high: 0x859900, whale: 0xCB4B16 },

  // IDE-inspired Dark Mode
  'vscode-dark':         { small: 0x333333, medium: 0x007ACC, high: 0x4EC9B0, whale: 0xDCDCAA },
  'github-dark':         { small: 0x21262D, medium: 0x58A6FF, high: 0x30A14E, whale: 0xD29922 },
  'one-dark':            { small: 0x282C34, medium: 0x61AFEF, high: 0x98C379, whale: 0xE5C07B },
  'solarized-dark':      { small: 0x073642, medium: 0x268BD2, high: 0x859900, whale: 0xCB4B16 },
  'monokai':             { small: 0x272822, medium: 0x66D9EF, high: 0xA6E22E, whale: 0xF92672 },
};
