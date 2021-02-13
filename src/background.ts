/**
 * The set of tabIds which have the debugger attached
 */
const debuggerTabs: Set<number> = new Set();

// Need 1.3+ for EmulatedMediaFeatures
const debuggerProtocolVersion = '1.3';

const defaultColorScheme = window.matchMedia('(prefers-color-scheme: dark)')
  .matches
  ? 'dark'
  : 'light';

updateTitle(getOppositeColorScheme(defaultColorScheme));

function updateTitle(colorScheme: string, tabId?: number) {
  chrome.browserAction.setTitle({ title: `Set page to ${colorScheme}`, tabId });
}
/**
 * Options to send with Emulation.setEmulatedMedia
 */
interface EmulatedMediaOptions {
  media: string;
  features: EmulatedMediaFeatures[];
}

interface EmulatedMediaFeatures {
  name: string;
  value: string;
}

function getOppositeColorScheme(currentScheme: string): string {
  return currentScheme === 'light' ? 'dark' : 'light';
}

function setPageOptions(tabId: number, ...options: EmulatedMediaFeatures[]) {
  const commandParams: EmulatedMediaOptions = {
    media: 'screen',
    features: options,
  };
  chrome.debugger.sendCommand(
    { tabId },
    'Emulation.setEmulatedMedia',
    commandParams
  );
}

function cleanup(tabId: number) {
  debuggerTabs.delete(tabId);
  updateTitle(getOppositeColorScheme(defaultColorScheme), tabId);
}

chrome.browserAction.onClicked.addListener((tab) => {
  const tabId = tab.id!;
  const debugee = { tabId };
  if (!debuggerTabs.has(tabId)) {
    chrome.debugger.attach(debugee, debuggerProtocolVersion, () => {
      if (chrome.runtime.lastError) {
        alert(chrome.runtime.lastError.message);
      } else {
        debuggerTabs.add(tabId);
        const colorScheme = getOppositeColorScheme(defaultColorScheme);
        setPageOptions(tabId, {
          name: 'prefers-color-scheme',
          value: colorScheme,
        });
        updateTitle(defaultColorScheme, tabId);
      }
    });
  } else {
    chrome.debugger.detach(debugee, () => {
      cleanup(tabId);
    });
  }
});

chrome.debugger.onDetach.addListener(({ tabId }) => {
  cleanup(tabId!);
});
