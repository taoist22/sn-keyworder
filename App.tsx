import React, {useCallback, useEffect, useState} from 'react';
import {
  installPluginRouter,
  BUTTON_ID_TOOLBAR,
  BUTTON_ID_LASSO,
  consumeLastButtonEvent,
  subscribeToButtonEvents,
} from './src/pluginRouter';
import KeywordPanel from './src/KeywordPanel';
import ConfigPanel from './src/ConfigPanel';
import LassoAddPanel from './src/LassoAddPanel';
import {Keyword, loadKeywords, saveKeywords} from './src/storage';
import {PluginManager} from 'sn-plugin-lib';

installPluginRouter();

type View = 'main' | 'config' | 'lasso-add';

export default function App() {
  const [view, setView] = useState<View>('main');
  const [lassoKey, setLassoKey] = useState(0);
  const [keywords, setKeywords] = useState<Keyword[]>([]);

  useEffect(() => {
    const reload = () =>
      loadKeywords()
        .then(kws => setKeywords(kws))
        .catch(error => {
          console.error('[App] Failed to load keywords:', error);
        });

    reload();

    // Consume button pressed before this component mounted
    const pending = consumeLastButtonEvent();
    if (pending?.id === BUTTON_ID_LASSO) {
      setLassoKey(k => k + 1);
      setView('lasso-add');
    }

    // Listen for buttons pressed while mounted
    const unsubscribe = subscribeToButtonEvents(event => {
      if (event.id === BUTTON_ID_LASSO) {
        setLassoKey(k => k + 1);
        setView('lasso-add');
      } else if (event.id === BUTTON_ID_TOOLBAR) {
        setView('main');
      }
    });

    const lifeSub = PluginManager.addPluginLifeListener({
      onStart: reload,
      onStop() {
        setView('main');
      },
    });

    return () => {
      unsubscribe();
      lifeSub.remove();
    };
  }, []);

  const updateKeywords = useCallback(async (kws: Keyword[]) => {
    await saveKeywords(kws);
    setKeywords(kws);
  }, []);

  const handleKeywordAdded = useCallback(
    async (kw: Keyword) => {
      const updated = [...keywords, kw];
      await updateKeywords(updated);
    },
    [keywords, updateKeywords],
  );

  if (view === 'lasso-add') {
    return (
      <LassoAddPanel
        key={lassoKey}
        keywords={keywords}
        onAdded={handleKeywordAdded}
        onDone={() => setView('main')}
      />
    );
  }

  if (view === 'config') {
    return (
      <ConfigPanel
        keywords={keywords}
        onUpdate={updateKeywords}
        onBack={() => setView('main')}
      />
    );
  }

  return (
    <KeywordPanel keywords={keywords} onManage={() => setView('config')} />
  );
}
