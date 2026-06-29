import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import {FileUtils} from 'sn-plugin-lib';
import {getErrorMessage} from './apiSafety';
import {getPanelMetrics} from './responsivePanel';
import {Keyword, keywordSignature, makeId, normalizeKey} from './storage';

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_PADDING = 20;
const ITEM_HEIGHT = 60;

const IMPORT_DIR = '/storage/emulated/0/MyStyle/SnKeyworder';
const IMPORT_URL =
  'file:///storage/emulated/0/MyStyle/SnKeyworder/keywords.json';
const IMPORT_MSG_MS = 4000;

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  keywords: Keyword[];
  onUpdate: (kws: Keyword[]) => Promise<void>;
  onBack: () => void;
};

function uniqueKeywords(items: Keyword[], existingItems: Keyword[]): Keyword[] {
  const seen = new Set(existingItems.map(keywordSignature));
  const unique: Keyword[] = [];
  for (const item of items) {
    const signature = keywordSignature(item);
    if (!seen.has(signature)) {
      seen.add(signature);
      unique.push(item);
    }
  }
  return unique;
}

function parseImportItem(item: any): Pick<Keyword, 'label' | 'key'> | null {
  if (typeof item === 'string') {
    const label = item.trim();
    return label ? {label} : null;
  }

  const label = typeof item?.label === 'string' ? item.label.trim() : '';
  if (!label) {
    return null;
  }
  return {label, key: normalizeKey(item.key)};
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ConfigPanel({keywords, onUpdate, onBack}: Props) {
  const windowSize = useWindowDimensions();
  const panelMetrics = useMemo(
    () => getPanelMetrics(windowSize.width, windowSize.height),
    [windowSize.width, windowSize.height],
  );
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedNewKey = normalizeKey(newKey);
  const addPreview = newLabel.trim()
    ? normalizedNewKey
      ? `${normalizedNewKey}:${newLabel.trim()}`
      : newLabel.trim()
    : '';

  useEffect(() => {
    return () => {
      if (importMsgTimerRef.current) {
        clearTimeout(importMsgTimerRef.current);
      }
    };
  }, []);

  const showImportMsg = useCallback((msg: string) => {
    if (importMsgTimerRef.current) {
      clearTimeout(importMsgTimerRef.current);
    }
    setImportMsg(msg);
    importMsgTimerRef.current = setTimeout(
      () => setImportMsg(null),
      IMPORT_MSG_MS,
    );
  }, []);

  // Pinned first (in insertion order), then unpinned alphabetically
  const sorted = useMemo(() => {
    const pinned = keywords.filter(k => k.pinned);
    const unpinned = keywords
      .filter(k => !k.pinned)
      .sort((a, b) => a.label.localeCompare(b.label));
    return [...pinned, ...unpinned];
  }, [keywords]);
  const [letterFilter, setLetterFilter] = useState<string | null>(null);

  const activeLetters = useMemo(() => {
    const letters: string[] = [];
    for (const kw of sorted) {
      const letter = (kw.label[0] ?? '#').toUpperCase();
      if (!letters.includes(letter)) {
        letters.push(letter);
      }
    }
    return letters;
  }, [sorted]);

  useEffect(() => {
    if (letterFilter != null && !activeLetters.includes(letterFilter)) {
      setLetterFilter(null);
    }
  }, [activeLetters, letterFilter]);

  const visibleSorted = useMemo(() => {
    if (letterFilter == null) {
      return sorted;
    }
    return sorted.filter(
      kw => (kw.label[0] ?? '#').toUpperCase() === letterFilter,
    );
  }, [letterFilter, sorted]);

  const handleTogglePin = useCallback(
    async (id: string) => {
      const updated = keywords.map(k =>
        k.id === id ? {...k, pinned: !k.pinned} : k,
      );
      try {
        await onUpdate(updated);
      } catch (error) {
        showImportMsg(getErrorMessage(error, 'Could not save pin change'));
      }
    },
    [keywords, onUpdate, showImportMsg],
  );

  const handleStartAdd = useCallback(() => {
    setAdding(true);
    setNewLabel('');
    setNewKey('');
    setAddError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleConfirmAdd = useCallback(async () => {
    const label = newLabel.trim();
    if (!label) {
      setAdding(false);
      return;
    }
    const key = normalizeKey(newKey);
    const nextKeyword = {id: makeId(), label, pinned: false, key};
    const isDupe = keywords.some(
      k => keywordSignature(k) === keywordSignature(nextKeyword),
    );
    if (isDupe) {
      setAddError(`"${key ? `${key}:${label}` : label}" already exists`);
      return;
    }
    try {
      const updated = [...keywords, nextKeyword];
      await onUpdate(updated);
      setAdding(false);
      setNewLabel('');
      setNewKey('');
      setAddError(null);
    } catch (error) {
      setAddError(getErrorMessage(error, 'Could not save keyword'));
    }
  }, [newLabel, newKey, keywords, onUpdate]);

  const handleCancelAdd = useCallback(() => {
    setAdding(false);
    setNewLabel('');
    setNewKey('');
    setAddError(null);
  }, []);

  const handleImport = useCallback(async () => {
    if (importing) {
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      try {
        await (FileUtils as any).makeDir(IMPORT_DIR);
      } catch (error) {
        console.warn('[ConfigPanel] Could not create import directory:', error);
      }
      const response = await fetch(IMPORT_URL);
      if (!response.ok) {
        throw new Error('not_found');
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('invalid');
      }
      const parsed = (data as any[])
        .map(parseImportItem)
        .filter(Boolean) as Array<Pick<Keyword, 'label' | 'key'>>;
      const toAdd = uniqueKeywords(
        parsed.map(item => ({
          id: makeId(),
          label: item.label,
          pinned: false,
          key: normalizeKey(item.key),
        })),
        keywords,
      );
      if (toAdd.length === 0) {
        showImportMsg('No new keywords — all already in list');
      } else {
        await onUpdate([...keywords, ...toAdd]);
        showImportMsg(
          `Imported ${toAdd.length} keyword${toAdd.length !== 1 ? 's' : ''}`,
        );
      }
    } catch (e: any) {
      if (e?.message === 'invalid') {
        showImportMsg('Invalid format — use strings or {label,key}');
      } else if (e?.message === 'not_found') {
        showImportMsg(
          'keywords.json not found — place it at MyStyle/SnKeyworder/',
        );
      } else {
        showImportMsg(getErrorMessage(e, 'Could not import keywords'));
      }
    } finally {
      setImporting(false);
    }
  }, [importing, keywords, onUpdate, showImportMsg]);

  const handleDelete = useCallback(
    async (id: string) => {
      const updated = keywords.filter(k => k.id !== id);
      try {
        await onUpdate(updated);
      } catch (error) {
        showImportMsg(getErrorMessage(error, 'Could not delete keyword'));
      }
    },
    [keywords, onUpdate, showImportMsg],
  );

  const handleJump = useCallback((letter: string) => {
    setLetterFilter(prev => (prev === letter ? null : letter));
  }, []);

  return (
    <TouchableWithoutFeedback onPress={onBack}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.panel,
            {width: panelMetrics.width, height: panelMetrics.height},
          ]}
          onStartShouldSetResponder={() => true}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable
              onPress={onBack}
              style={({pressed}) => [
                styles.backBtn,
                pressed && styles.btnPressed,
              ]}>
              <Text style={styles.backBtnText}>{'← Back'}</Text>
            </Pressable>
            <Text style={styles.title}>Manage Keywords</Text>
          </View>
          <View style={styles.divider} />

          {/* ── Legend + Add + Import buttons ── */}
          <View style={styles.legendRow}>
            <Text style={styles.legendText}>{'★ pin   ✕ delete'}</Text>
            <Pressable
              onPress={handleImport}
              disabled={importing}
              style={({pressed}) => [
                styles.importBtn,
                pressed && styles.btnPressed,
                importing && styles.btnDisabled,
              ]}>
              <Text style={styles.importBtnText}>
                {importing ? '…' : 'Import'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleStartAdd}
              style={({pressed}) => [
                styles.addBtn,
                pressed && styles.btnPressed,
              ]}>
              <Text style={styles.addBtnText}>{'+ Add'}</Text>
            </Pressable>
          </View>
          {importMsg != null && (
            <View style={styles.importMsgBanner}>
              <Text style={styles.importMsgText}>{importMsg}</Text>
            </View>
          )}
          <View style={styles.lightDivider} />

          {/* ── Add input ── */}
          {adding && (
            <>
              <View style={styles.addRow}>
                <View style={styles.addField}>
                  <Text style={styles.inputLabel}>Keyword</Text>
                  <TextInput
                    ref={inputRef}
                    style={styles.addInput}
                    value={newLabel}
                    onChangeText={text => {
                      setNewLabel(text);
                      setAddError(null);
                    }}
                    placeholder="New keyword"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={handleConfirmAdd}
                    maxLength={48}
                  />
                </View>
                <View style={styles.keyField}>
                  <Text style={styles.inputLabel}>Key</Text>
                  <TextInput
                    style={styles.keyInput}
                    value={newKey}
                    onChangeText={text => {
                      setNewKey(text);
                      setAddError(null);
                    }}
                    placeholder="optional"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleConfirmAdd}
                    maxLength={20}
                  />
                </View>
                <Pressable
                  onPress={handleConfirmAdd}
                  style={({pressed}) => [
                    styles.addConfirmBtn,
                    pressed && styles.btnPressed,
                  ]}>
                  <Text style={styles.addConfirmText}>{'✓'}</Text>
                </Pressable>
                <Pressable
                  onPress={handleCancelAdd}
                  style={({pressed}) => [
                    styles.addCancelBtn,
                    pressed && styles.btnPressed,
                  ]}>
                  <Text style={styles.addCancelText}>{'✕'}</Text>
                </Pressable>
              </View>
              {addPreview !== '' && (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Saves as</Text>
                  <Text style={styles.previewValue}>{addPreview}</Text>
                </View>
              )}
              {addError != null && (
                <View style={styles.addErrorBanner}>
                  <Text style={styles.addErrorText}>{addError}</Text>
                </View>
              )}
              <View style={styles.lightDivider} />
            </>
          )}

          {/* ── Keyword list ── */}
          {visibleSorted.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {sorted.length === 0
                  ? 'No keywords yet.\nGo back and tap "+ Add".'
                  : 'No keywords for this letter.'}
              </Text>
            </View>
          ) : (
            <View style={styles.listArea}>
              <ScrollView
                style={styles.list}
                showsVerticalScrollIndicator={false}>
                <View style={styles.keywordGrid}>
                  {visibleSorted.map(item => (
                    <View
                      key={item.id}
                      style={[
                        styles.itemCell,
                        panelMetrics.columns === 2 && styles.itemCellTwo,
                      ]}>
                      <ConfigItem
                        kw={item}
                        onTogglePin={handleTogglePin}
                        onDelete={handleDelete}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.alphaRail}>
                <Pressable
                  onPress={() => setLetterFilter(null)}
                  style={({pressed}) => [
                    styles.alphaBtn,
                    letterFilter == null && styles.alphaBtnActive,
                    pressed && styles.btnPressed,
                  ]}>
                  <Text
                    style={[
                      styles.alphaBtnText,
                      letterFilter == null && styles.alphaBtnTextActive,
                    ]}>
                    All
                  </Text>
                </Pressable>
                {activeLetters.map(letter => (
                  <Pressable
                    key={letter}
                    onPress={() => handleJump(letter)}
                    style={({pressed}) => [
                      styles.alphaBtn,
                      letterFilter === letter && styles.alphaBtnActive,
                      pressed && styles.btnPressed,
                    ]}>
                    <Text
                      style={[
                        styles.alphaBtnText,
                        letterFilter === letter && styles.alphaBtnTextActive,
                      ]}>
                      {letter}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ─── ConfigItem ───────────────────────────────────────────────────────────────

function ConfigItem({
  kw,
  onTogglePin,
  onDelete,
}: {
  kw: Keyword;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={styles.item}>
      <Pressable
        onPress={() => onTogglePin(kw.id)}
        style={({pressed}) => [styles.pinBtn, pressed && styles.btnPressed]}>
        <Text style={[styles.pinIcon, kw.pinned && styles.pinIconActive]}>
          {kw.pinned ? '★' : '☆'}
        </Text>
      </Pressable>
      <Text style={styles.itemLabel} numberOfLines={1}>
        {kw.label}
      </Text>
      {kw.key != null && (
        <View style={styles.keyBadge}>
          <Text style={styles.keyBadgeText}>{kw.key}</Text>
        </View>
      )}
      <Pressable
        onPress={() => onDelete(kw.id)}
        style={({pressed}) => [styles.deleteBtn, pressed && styles.btnPressed]}>
        <Text style={styles.deleteBtnText}>{'✕'}</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },

  // Header
  header: {
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  btnPressed: {
    backgroundColor: '#E8E8E8',
  },

  // Dividers
  divider: {
    height: 1,
    backgroundColor: '#000000',
  },
  lightDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
  },

  // Legend row
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 8,
  },
  legendText: {
    flex: 1,
    fontSize: 12,
    color: '#888888',
  },
  importBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#555555',
    marginRight: 8,
  },
  importBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555555',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  importMsgBanner: {
    marginHorizontal: PANEL_PADDING,
    marginTop: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  importMsgText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },

  // Add input row
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#F8F8F8',
  },
  addField: {
    flex: 1,
  },
  keyField: {
    width: 118,
  },
  inputLabel: {
    marginBottom: 4,
    fontSize: 11,
    color: '#666666',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  addInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  keyInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#777777',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: '#F8F8F8',
  },
  previewLabel: {
    fontSize: 12,
    color: '#777777',
    fontWeight: '700',
  },
  previewValue: {
    flex: 1,
    fontSize: 13,
    color: '#000000',
    fontWeight: '700',
  },
  addConfirmBtn: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  addConfirmText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  addCancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCancelText: {
    fontSize: 16,
    color: '#555555',
    fontWeight: 'bold',
  },
  addErrorBanner: {
    marginHorizontal: PANEL_PADDING,
    marginBottom: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addErrorText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },

  // List
  listArea: {
    flex: 1,
    flexDirection: 'row',
  },
  list: {
    flex: 1,
  },
  keywordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  itemCell: {
    width: '100%',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  itemCellTwo: {
    width: '50%',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  alphaRail: {
    width: 30,
    borderLeftWidth: 1,
    borderLeftColor: '#E0E0E0',
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  alphaBtn: {
    width: 26,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
  },
  alphaBtnActive: {
    backgroundColor: '#000000',
  },
  alphaBtnText: {
    fontSize: 11,
    color: '#000000',
    fontWeight: '700',
  },
  alphaBtnTextActive: {
    color: '#FFFFFF',
  },

  // Item
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    gap: 12,
  },
  pinBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: {
    fontSize: 22,
    color: '#CCCCCC',
  },
  pinIconActive: {
    color: '#000000',
  },
  itemLabel: {
    flex: 1,
    fontSize: 20,
    color: '#000000',
    fontWeight: '500',
  },
  keyBadge: {
    maxWidth: 96,
    borderWidth: 1,
    borderColor: '#777777',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  keyBadgeText: {
    fontSize: 12,
    color: '#555555',
    fontWeight: '700',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
  },
  deleteBtnText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: 'bold',
  },

  // Empty state
  emptyState: {
    paddingVertical: 40,
    paddingHorizontal: PANEL_PADDING,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 26,
  },
});
