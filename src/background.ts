// Need 1.3+ for EmulatedMediaFeatures
const debuggerProtocolVersion = '1.3';

/**
 * Determine if the given tab has a debugger attached
 *
 * @param tabId
 */
function tabIsActive(tabId: number) {
  return new Promise<boolean>((resolve) => {
    chrome.debugger.getTargets((debuggees) => {
      const exists = debuggees.some((debuggee) => {
        return debuggee.tabId === tabId && debuggee.attached;
      });
      resolve(exists);
    });
  });
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

function getCurrentTabColorScheme(tabId: number): Promise<'light' | 'dark'> {
  return new Promise((resolve) => {
    const handleResults = (results?: chrome.scripting.InjectionResult[]) => {
      const result: boolean = results?.[0]?.result ?? false;
      resolve(result ? 'dark' : 'light');
    };
    if (chrome.scripting) {
      // chrome version 88+
      chrome.scripting.executeScript(
        {
          target: { tabId },
          function: function () {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
          },
        },
        handleResults
      );
    } else {
      // chrome version < 88
      chrome.tabs.executeScript(
        tabId,
        {
          code: `window.matchMedia('(prefers-color-scheme: dark)).matches`,
        },
        handleResults
      );
    }
  });
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

async function handleClick(tab: chrome.tabs.Tab) {
  // tab.id will be undefined if the target is weird, like a chrome:// page
  if (tab.id === undefined) {
    return;
  }
  const tabId = tab.id;
  const debugee = { tabId };
  const active = await tabIsActive(tabId);
  if (!active) {
    chrome.debugger.attach(debugee, debuggerProtocolVersion, async () => {
      if (chrome.runtime.lastError) {
        return;
      } else {
        const tabColorScheme = await getCurrentTabColorScheme(tabId);
        const oppositeColorScheme = getOppositeColorScheme(tabColorScheme);
        setPageOptions(tabId, {
          name: 'prefers-color-scheme',
          value: oppositeColorScheme,
        });
      }
    });
  } else {
    chrome.debugger.detach(debugee);
  }
}

chrome.action.onClicked.addListener(handleClick);
