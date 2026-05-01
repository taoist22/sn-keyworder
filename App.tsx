import React, {useCallback, useEffect, useState} from 'react';
import {installPluginRouter} from './src/pluginRouter';
import KeywordPanel from './src/KeywordPanel';
import ConfigPanel from './src/ConfigPanel';
import {Keyword, loadKeywords, saveKeywords} from './src/storage';

installPluginRouter();

export default function App() {
  const [view, setView] = useState<'main' | 'config'>('main');
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  useEffect(() => {
    loadKeywords()
      .then(setKeywords)
      .catch(() => {}); // non-fatal — start with empty list
  }, []);

  const updateKeywords = useCallback(async (kws: Keyword[]) => {
    setKeywords(kws);
    await saveKeywords(kws);
  }, []);

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
    <KeywordPanel
      keywords={keywords}
      onUpdate={updateKeywords}
      onManage={() => setView('config')}
    />
  );
}
