import React, {useCallback, useEffect, useState} from 'react';
import {installPluginRouter} from './src/pluginRouter';
import KeywordPanel from './src/KeywordPanel';
import ConfigPanel from './src/ConfigPanel';
import {Keyword, loadKeywords, saveKeywords} from './src/storage';
import {PluginManager} from 'sn-plugin-lib';

installPluginRouter();

export default function App() {
  const [view, setView] = useState<'main' | 'config'>('main');
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  useEffect(() => {
    const reload = () =>
      loadKeywords()
        .then(kws => setKeywords(kws))
        .catch(() => {});

    reload();


    const sub = PluginManager.addPluginLifeListener({
      onStart: reload,
      onStop() {},
    });

    return () => sub.remove();
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
      onRefresh={() => loadKeywords().then(kws => setKeywords(kws)).catch(() => {})}
    />
  );
}
