import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import {getErrorMessage} from './apiSafety';
import {getPanelMetrics} from './responsivePanel';
import {requireFileReadPermission} from './pluginPermissions';
import {
  Keyword,
  KeywordGroup,
  displayGroups,
  keywordSignature,
  makeId,
  normalizeGroups,
  normalizeKey,
} from './storage';

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_PADDING = 20;
const ITEM_HEIGHT = 60;

const IMPORT_URL =
  'file:///storage/emulated/0/MyStyle/SnKeyworder/keywords.json';
const IMPORT_MSG_MS = 4000;
// Longer than the import toast: undo is the only safety net on delete, and a
// full e-ink refresh plus noticing the banner eats several seconds.
const UNDO_MS = 9000;

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  keywords: Keyword[];
  groups: KeywordGroup[];
  onUpdate: (kws: Keyword[]) => Promise<void>;
  onUpdateGroups: (groups: KeywordGroup[]) => Promise<void>;
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

function parseImportItem(
  item: any,
): Pick<Keyword, 'label' | 'key' | 'groups'> | null {
  if (typeof item === 'string') {
    const label = item.trim();
    return label ? {label, groups: []} : null;
  }

  const label = typeof item?.label === 'string' ? item.label.trim() : '';
  if (!label) {
    return null;
  }
  return {
    label,
    key: normalizeKey(item.key),
    groups: normalizeGroups([item.groups, item.group, item.key]),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

type ManageMode = 'keywords' | 'groups';
type UndoAction =
  | {kind: 'keyword'; item: Keyword; index: number}
  | {
      kind: 'group';
      item: KeywordGroup;
      index: number;
      memberIds: string[];
    };

export default function ConfigPanel({
  keywords,
  groups,
  onUpdate,
  onUpdateGroups,
  onBack,
}: Props) {
  const windowSize = useWindowDimensions();
  const panelMetrics = useMemo(
    () => getPanelMetrics(windowSize.width, windowSize.height),
    [windowSize.width, windowSize.height],
  );
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<ManageMode>('keywords');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newGroups, setNewGroups] = useState<string[]>([]);
  const [groupLetterFilter, setGroupLetterFilter] = useState<string | null>(
    null,
  );
  const [showAllGroupKeywords, setShowAllGroupKeywords] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const importMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
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
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const offerUndo = useCallback((action: UndoAction) => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoAction(action);
    undoTimerRef.current = setTimeout(() => setUndoAction(null), UNDO_MS);
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

  const resetForm = useCallback(() => {
    setAdding(false);
    setEditingId(null);
    setNewLabel('');
    setNewKey('');
    setNewGroups([]);
    setAddError(null);
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

  const sortedGroupKeywords = useMemo(
    () => [...keywords].sort((a, b) => a.label.localeCompare(b.label)),
    [keywords],
  );

  const selectedGroup = useMemo(
    () => groups.find(group => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const keyword of keywords) {
      for (const name of keyword.groups ?? []) {
        const key = name.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [keywords]);

  const groupKeywordPool = useMemo(() => {
    if (selectedGroup == null || showAllGroupKeywords) {
      return sortedGroupKeywords;
    }
    return sortedGroupKeywords.filter(keyword =>
      (keyword.groups ?? []).some(
        groupName =>
          groupName.toLowerCase() === selectedGroup.name.toLowerCase(),
      ),
    );
  }, [selectedGroup, showAllGroupKeywords, sortedGroupKeywords]);

  const activeGroupLetters = useMemo(() => {
    const letters: string[] = [];
    for (const kw of groupKeywordPool) {
      const letter = (kw.label[0] ?? '#').toUpperCase();
      if (!letters.includes(letter)) {
        letters.push(letter);
      }
    }
    return letters;
  }, [groupKeywordPool]);

  useEffect(() => {
    if (
      groupLetterFilter != null &&
      !activeGroupLetters.includes(groupLetterFilter)
    ) {
      setGroupLetterFilter(null);
    }
  }, [activeGroupLetters, groupLetterFilter]);

  const visibleGroupKeywords = useMemo(() => {
    if (groupLetterFilter == null) {
      return groupKeywordPool;
    }
    return groupKeywordPool.filter(
      kw => (kw.label[0] ?? '#').toUpperCase() === groupLetterFilter,
    );
  }, [groupLetterFilter, groupKeywordPool]);

  useEffect(() => {
    if (
      selectedGroupId &&
      !groups.some(group => group.id === selectedGroupId)
    ) {
      setSelectedGroupId(null);
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    setGroupLetterFilter(null);
    setShowAllGroupKeywords(false);
  }, [selectedGroupId]);

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
    setEditingId(null);
    setNewLabel('');
    setNewKey('');
    setNewGroups([]);
    setAddError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleStartEdit = useCallback((keyword: Keyword) => {
    setAdding(true);
    setEditingId(keyword.id);
    setNewLabel(keyword.label);
    setNewKey(keyword.key ?? '');
    setNewGroups(normalizeGroups(keyword.groups));
    setAddError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleToggleDraftGroup = useCallback((groupName: string) => {
    setNewGroups(prev =>
      prev.some(item => item.toLowerCase() === groupName.toLowerCase())
        ? prev.filter(item => item.toLowerCase() !== groupName.toLowerCase())
        : normalizeGroups([prev, groupName]),
    );
    setAddError(null);
  }, []);

  const handleConfirmSave = useCallback(async () => {
    const label = newLabel.trim();
    if (!label) {
      resetForm();
      return;
    }
    const key = normalizeKey(newKey);
    const previousKeyword = editingId
      ? keywords.find(k => k.id === editingId)
      : null;
    const keywordGroups = normalizeGroups(newGroups);
    const nextKeyword = {
      id: editingId ?? makeId(),
      label,
      pinned: previousKeyword?.pinned ?? false,
      key,
      groups: keywordGroups,
    };
    const existing = keywords.find(
      k =>
        k.id !== editingId &&
        keywordSignature(k) === keywordSignature(nextKeyword),
    );
    if (existing) {
      setAddError(`"${key ? `${key}:${label}` : label}" already exists`);
      return;
    }
    try {
      const updated = editingId
        ? keywords.map(k => (k.id === editingId ? nextKeyword : k))
        : [...keywords, nextKeyword];
      await onUpdate(updated);
      resetForm();
    } catch (error) {
      setAddError(getErrorMessage(error, 'Could not save keyword'));
    }
  }, [newLabel, editingId, newKey, newGroups, keywords, onUpdate, resetForm]);

  const handleCancelAdd = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const handleImport = useCallback(async () => {
    if (importing) {
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      await requireFileReadPermission();
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
        .filter(Boolean) as Array<Pick<Keyword, 'label' | 'key' | 'groups'>>;
      const toAdd = uniqueKeywords(
        parsed.map(item => ({
          id: makeId(),
          label: item.label,
          pinned: false,
          key: normalizeKey(item.key),
          groups: normalizeGroups([item.groups, item.key]),
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
      const index = keywords.findIndex(k => k.id === id);
      const deleted = keywords[index];
      if (!deleted) {
        return;
      }
      const updated = keywords.filter(k => k.id !== id);
      try {
        await onUpdate(updated);
        offerUndo({kind: 'keyword', item: deleted, index});
      } catch (error) {
        showImportMsg(getErrorMessage(error, 'Could not delete keyword'));
      }
    },
    [keywords, offerUndo, onUpdate, showImportMsg],
  );

  const handleAddGroup = useCallback(async () => {
    const name = normalizeKey(newGroupName);
    if (!name) {
      return;
    }
    if (groups.some(group => group.name.toLowerCase() === name.toLowerCase())) {
      showImportMsg(`Group "${name}" already exists`);
      return;
    }
    const nextGroups = [...groups, {id: makeId(), name}].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    try {
      await onUpdateGroups(nextGroups);
      setNewGroupName('');
    } catch (error) {
      showImportMsg(getErrorMessage(error, 'Could not save group'));
    }
  }, [groups, newGroupName, onUpdateGroups, showImportMsg]);

  const handleDeleteGroup = useCallback(
    async (group: KeywordGroup) => {
      const groupIndex = groups.findIndex(item => item.id === group.id);
      const nextGroups = groups.filter(item => item.id !== group.id);
      const nextKeywords = keywords.map(keyword => ({
        ...keyword,
        groups: (keyword.groups ?? []).filter(
          name => name.toLowerCase() !== group.name.toLowerCase(),
        ),
      }));
      try {
        await onUpdate(nextKeywords);
        await onUpdateGroups(nextGroups);
        offerUndo({
          kind: 'group',
          item: group,
          index: groupIndex,
          memberIds: keywords
            .filter(keyword =>
              (keyword.groups ?? []).some(
                name => name.toLowerCase() === group.name.toLowerCase(),
              ),
            )
            .map(keyword => keyword.id),
        });
        if (selectedGroupId === group.id) {
          setSelectedGroupId(null);
        }
      } catch (error) {
        showImportMsg(getErrorMessage(error, 'Could not delete group'));
      }
    },
    [
      groups,
      keywords,
      onUpdate,
      onUpdateGroups,
      offerUndo,
      selectedGroupId,
      showImportMsg,
    ],
  );

  const handleUndo = useCallback(async () => {
    const action = undoAction;
    if (!action) {
      return;
    }
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    try {
      if (action.kind === 'keyword') {
        const restored = [...keywords];
        restored.splice(
          Math.min(action.index, restored.length),
          0,
          action.item,
        );
        await onUpdate(restored);
      } else {
        const restoredGroups = [...groups];
        if (
          !restoredGroups.some(
            group =>
              group.name.toLowerCase() === action.item.name.toLowerCase(),
          )
        ) {
          restoredGroups.splice(
            Math.min(action.index, restoredGroups.length),
            0,
            action.item,
          );
        }
        const memberIds = new Set(action.memberIds);
        await onUpdate(
          keywords.map(keyword =>
            memberIds.has(keyword.id)
              ? {
                  ...keyword,
                  groups: normalizeGroups([keyword.groups, action.item.name]),
                }
              : keyword,
          ),
        );
        await onUpdateGroups(restoredGroups);
      }
      setUndoAction(null);
    } catch (error) {
      showImportMsg(getErrorMessage(error, 'Could not undo delete'));
    }
  }, [groups, keywords, onUpdate, onUpdateGroups, showImportMsg, undoAction]);

  const handleToggleGroupKeyword = useCallback(
    async (keywordId: string) => {
      if (!selectedGroup) {
        return;
      }
      const groupName = selectedGroup.name;
      const nextKeywords = keywords.map(keyword => {
        if (keyword.id !== keywordId) {
          return keyword;
        }
        const hasGroup = (keyword.groups ?? []).some(
          item => item.toLowerCase() === groupName.toLowerCase(),
        );
        return {
          ...keyword,
          groups: hasGroup
            ? (keyword.groups ?? []).filter(
                item => item.toLowerCase() !== groupName.toLowerCase(),
              )
            : normalizeGroups([keyword.groups, groupName]),
        };
      });
      try {
        await onUpdate(nextKeywords);
      } catch (error) {
        showImportMsg(getErrorMessage(error, 'Could not update group'));
      }
    },
    [keywords, onUpdate, selectedGroup, showImportMsg],
  );

  const handleJump = useCallback((letter: string) => {
    setLetterFilter(prev => (prev === letter ? null : letter));
  }, []);

  const handleGroupJump = useCallback((letter: string) => {
    setGroupLetterFilter(prev => (prev === letter ? null : letter));
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

          <View style={styles.modeTabs}>
            <Pressable
              onPress={() => setMode('keywords')}
              style={({pressed}) => [
                styles.modeTab,
                mode === 'keywords' && styles.modeTabActive,
                pressed && styles.btnPressed,
              ]}>
              <Text
                style={[
                  styles.modeTabText,
                  mode === 'keywords' && styles.modeTabTextActive,
                ]}>
                Keywords
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('groups')}
              style={({pressed}) => [
                styles.modeTab,
                mode === 'groups' && styles.modeTabActive,
                pressed && styles.btnPressed,
              ]}>
              <Text
                style={[
                  styles.modeTabText,
                  mode === 'groups' && styles.modeTabTextActive,
                ]}>
                Groups
              </Text>
            </Pressable>
          </View>
          <View style={styles.lightDivider} />

          {undoAction != null && (
            <View style={styles.undoBanner}>
              <Text style={styles.undoText} numberOfLines={1}>
                Deleted{' '}
                {undoAction.kind === 'group'
                  ? undoAction.item.name
                  : undoAction.item.label}
              </Text>
              <Pressable onPress={handleUndo} style={styles.undoBtn}>
                <Text style={styles.undoBtnText}>Undo</Text>
              </Pressable>
            </View>
          )}

          {/* ── Legend + Add + Import buttons ── */}
          {mode === 'keywords' ? (
            <>
              <View style={styles.legendRow}>
                <Text style={styles.legendText}>
                  {'★ pin   ·   long press to edit or delete'}
                </Text>
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
                {!adding && (
                  <Pressable
                    onPress={handleStartAdd}
                    style={({pressed}) => [
                      styles.addBtn,
                      pressed && styles.btnPressed,
                    ]}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </Pressable>
                )}
              </View>
              {importMsg != null && (
                <View style={styles.importMsgBanner}>
                  <Text style={styles.importMsgText}>{importMsg}</Text>
                </View>
              )}
              <View style={styles.lightDivider} />

              {/* ── Add input ── */}
              {adding && (
                <View style={styles.editorCard}>
                  <Text style={styles.editorTitle}>
                    {editingId != null ? 'Edit keyword' : 'New keyword'}
                  </Text>
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
                        onSubmitEditing={handleConfirmSave}
                        maxLength={48}
                      />
                    </View>
                    <View style={styles.keyField}>
                      <Text style={styles.inputLabel}>Structured Key</Text>
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
                        onSubmitEditing={handleConfirmSave}
                        maxLength={20}
                      />
                    </View>
                    <Pressable
                      onPress={handleConfirmSave}
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
                  {groups.length > 0 && (
                    <View style={styles.groupPickerRow}>
                      <Text style={styles.inputLabel}>Groups</Text>
                      <View style={styles.groupPickerWrap}>
                        {groups.map(group => {
                          const selected = newGroups.some(
                            item =>
                              item.toLowerCase() === group.name.toLowerCase(),
                          );
                          return (
                            <Pressable
                              key={group.id}
                              onPress={() => handleToggleDraftGroup(group.name)}
                              style={({pressed}) => [
                                styles.groupPickerChip,
                                selected && styles.groupPickerChipActive,
                                pressed && styles.btnPressed,
                              ]}>
                              <Text
                                style={[
                                  styles.groupPickerChipText,
                                  selected && styles.groupPickerChipTextActive,
                                ]}>
                                {group.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                  {addPreview !== '' && (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Inserts as</Text>
                      <Text style={styles.previewValue}>{addPreview}</Text>
                    </View>
                  )}
                  {addError != null && (
                    <View style={styles.addErrorBanner}>
                      <Text style={styles.addErrorText}>{addError}</Text>
                    </View>
                  )}
                  {editingId != null && (
                    <View style={styles.editDeleteRow}>
                      <Pressable
                        onPress={() => {
                          const id = editingId;
                          resetForm();
                          handleDelete(id);
                        }}
                        style={({pressed}) => [
                          styles.editDeleteBtn,
                          pressed && styles.btnPressed,
                        ]}>
                        <Text style={styles.editDeleteText}>
                          Delete keyword
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
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
                  <FlatList
                    key={`manage-${panelMetrics.columns}`}
                    style={styles.list}
                    data={visibleSorted}
                    numColumns={panelMetrics.columns}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.keywordGrid}
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    windowSize={7}
                    showsVerticalScrollIndicator={false}
                    renderItem={({item}) => (
                      <View
                        style={[
                          styles.itemCell,
                          panelMetrics.columns === 2 && styles.itemCellTwo,
                        ]}>
                        <ConfigItem
                          kw={item}
                          onEdit={handleStartEdit}
                          onTogglePin={handleTogglePin}
                        />
                      </View>
                    )}
                  />
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
                            letterFilter === letter &&
                              styles.alphaBtnTextActive,
                          ]}>
                          {letter}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.groupCreateRow}>
                <TextInput
                  style={styles.groupCreateInput}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="New group"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleAddGroup}
                />
                <Pressable
                  onPress={handleAddGroup}
                  style={({pressed}) => [
                    styles.addBtn,
                    pressed && styles.btnPressed,
                  ]}>
                  <Text style={styles.addBtnText}>+ Group</Text>
                </Pressable>
              </View>
              {importMsg != null && (
                <View style={styles.importMsgBanner}>
                  <Text style={styles.importMsgText}>{importMsg}</Text>
                </View>
              )}
              <View style={styles.lightDivider} />
              <View style={styles.groupManageArea}>
                <ScrollView
                  style={styles.groupList}
                  showsVerticalScrollIndicator={false}>
                  {groups.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>No groups yet.</Text>
                    </View>
                  ) : (
                    groups.map(group => (
                      <View key={group.id} style={styles.groupRowItem}>
                        <Pressable
                          onPress={() => setSelectedGroupId(group.id)}
                          style={({pressed}) => [
                            styles.groupSelectBtn,
                            selectedGroupId === group.id &&
                              styles.groupSelectBtnActive,
                            pressed && styles.btnPressed,
                          ]}>
                          <Text
                            style={[
                              styles.groupSelectText,
                              selectedGroupId === group.id &&
                                styles.groupSelectTextActive,
                            ]}>
                            {group.name}
                          </Text>
                          <Text style={styles.groupCountText}>
                            {groupCounts.get(group.name.toLowerCase()) ?? 0}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteGroup(group)}
                          style={({pressed}) => [
                            styles.deleteBtn,
                            pressed && styles.btnPressed,
                          ]}>
                          <Text style={styles.deleteBtnText}>{'✕'}</Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                </ScrollView>
                <View style={styles.membershipPane}>
                  <Text style={styles.membershipTitle}>
                    {selectedGroup
                      ? `${selectedGroup.name} ${
                          showAllGroupKeywords ? 'all keywords' : 'members'
                        }`
                      : 'Select a group'}
                  </Text>
                  <View style={styles.membershipBody}>
                    {selectedGroup == null ? (
                      <Text style={styles.membershipHint}>
                        Choose a group to add or remove keywords.
                      </Text>
                    ) : keywords.length === 0 ? (
                      <Text style={styles.membershipHint}>
                        Add keywords first, then assign them here.
                      </Text>
                    ) : (
                      <FlatList
                        style={styles.memberList}
                        data={visibleGroupKeywords}
                        keyExtractor={keyword => keyword.id}
                        initialNumToRender={16}
                        maxToRenderPerBatch={16}
                        windowSize={7}
                        showsVerticalScrollIndicator={false}
                        renderItem={({item: keyword}) => {
                          const checked = (keyword.groups ?? []).some(
                            groupName =>
                              groupName.toLowerCase() ===
                              selectedGroup.name.toLowerCase(),
                          );
                          return (
                            <Pressable
                              key={keyword.id}
                              onPress={() =>
                                handleToggleGroupKeyword(keyword.id)
                              }
                              style={({pressed}) => [
                                styles.memberRow,
                                pressed && styles.btnPressed,
                              ]}>
                              <View
                                style={[
                                  styles.memberCheckbox,
                                  checked && styles.memberCheckboxSelected,
                                ]}>
                                {checked && (
                                  <Text style={styles.memberCheckmark}>✓</Text>
                                )}
                              </View>
                              <Text style={styles.memberText} numberOfLines={1}>
                                {keyword.label}
                              </Text>
                            </Pressable>
                          );
                        }}
                      />
                    )}
                    {selectedGroup != null && keywords.length > 0 && (
                      <View style={styles.alphaRail}>
                        <Pressable
                          onPress={() => {
                            setShowAllGroupKeywords(prev => !prev);
                            setGroupLetterFilter(null);
                          }}
                          style={({pressed}) => [
                            styles.alphaBtn,
                            showAllGroupKeywords && styles.alphaBtnActive,
                            pressed && styles.btnPressed,
                          ]}>
                          <Text
                            style={[
                              styles.alphaBtnText,
                              showAllGroupKeywords && styles.alphaBtnTextActive,
                            ]}>
                            All
                          </Text>
                        </Pressable>
                        {activeGroupLetters.map(letter => (
                          <Pressable
                            key={letter}
                            onPress={() => handleGroupJump(letter)}
                            style={({pressed}) => [
                              styles.alphaBtn,
                              groupLetterFilter === letter &&
                                styles.alphaBtnActive,
                              pressed && styles.btnPressed,
                            ]}>
                            <Text
                              style={[
                                styles.alphaBtnText,
                                groupLetterFilter === letter &&
                                  styles.alphaBtnTextActive,
                              ]}>
                              {letter}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ─── ConfigItem ───────────────────────────────────────────────────────────────

function ConfigItem({
  kw,
  onEdit,
  onTogglePin,
}: {
  kw: Keyword;
  onEdit: (keyword: Keyword) => void;
  onTogglePin: (id: string) => void;
}) {
  const groupCount = displayGroups(kw).length;
  // Long-press the row to edit. Deliberately no delete control here: a
  // destructive tap target inside a whole-row gesture is easy to fire by
  // accident on e-ink, so delete lives in the editor instead. Pin stays --
  // a mis-fired pin is harmless and undone by tapping again.
  return (
    <Pressable
      onLongPress={() => onEdit(kw)}
      delayLongPress={400}
      style={({pressed}) => [styles.item, pressed && styles.itemPressed]}>
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
      {groupCount > 0 && (
        <View style={styles.flagBadge}>
          <Text allowFontScaling={false} style={styles.flagBadgeText}>
            {`${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`}
          </Text>
        </View>
      )}
      {kw.key != null && (
        <View style={styles.flagBadge}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={styles.flagBadgeText}>
            {kw.key}
          </Text>
        </View>
      )}
      {/* Absorbs the slack so the badges sit next to the label rather than
          being pushed to the far right of the cell. */}
      <View style={styles.itemSpacer} />
    </Pressable>
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

  // Mode tabs
  modeTabs: {
    flexDirection: 'row',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 8,
    gap: 8,
  },
  modeTab: {
    minWidth: 108,
    height: 36,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#999999',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modeTabActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  modeTabText: {
    fontSize: 14,
    color: '#555555',
    fontWeight: '700',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
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
  undoBanner: {
    minHeight: 42,
    paddingHorizontal: PANEL_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1A1A',
  },
  undoText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  undoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  undoBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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

  // Group management
  groupCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 10,
    gap: 8,
  },
  groupCreateInput: {
    flex: 1,
    height: 42,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  groupManageArea: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  groupList: {
    width: 220,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  groupRowItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: PANEL_PADDING,
    paddingRight: 8,
    gap: 8,
  },
  groupSelectBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupSelectBtnActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  groupSelectText: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    fontWeight: '700',
  },
  groupSelectTextActive: {
    color: '#FFFFFF',
  },
  groupCountText: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 12,
    color: '#777777',
    fontWeight: '700',
  },
  membershipPane: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    minWidth: 0,
  },
  membershipTitle: {
    marginBottom: 8,
    fontSize: 16,
    color: '#000000',
    fontWeight: '700',
  },
  membershipHint: {
    paddingTop: 20,
    fontSize: 15,
    color: '#777777',
    lineHeight: 22,
  },
  membershipBody: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  memberList: {
    flex: 1,
  },
  memberRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  memberCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#777777',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCheckboxSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  memberCheckmark: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  memberText: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
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
  groupRow: {
    paddingHorizontal: PANEL_PADDING,
    paddingBottom: 8,
    backgroundColor: '#F8F8F8',
  },
  groupInput: {
    height: 42,
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
  // The editor sits directly above the keyword list, so it needs to read as a
  // separate surface rather than as more list content.
  editorCard: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
    paddingTop: 10,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  editorTitle: {
    paddingHorizontal: PANEL_PADDING,
    paddingBottom: 8,
    fontSize: 15,
    color: '#000000',
    fontWeight: '700',
  },
  groupPickerRow: {
    paddingHorizontal: PANEL_PADDING,
    paddingBottom: 8,
    backgroundColor: '#F8F8F8',
  },
  groupPickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  groupPickerChip: {
    borderWidth: 1.5,
    borderColor: '#BBBBBB',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  groupPickerChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  groupPickerChipText: {
    fontSize: 13,
    color: '#555555',
    fontWeight: '700',
  },
  groupPickerChipTextActive: {
    color: '#FFFFFF',
  },
  editDeleteRow: {
    flexDirection: 'row',
    paddingHorizontal: PANEL_PADDING,
    paddingBottom: 10,
    backgroundColor: '#F8F8F8',
  },
  editDeleteBtn: {
    borderWidth: 1.5,
    borderColor: '#999999',
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editDeleteText: {
    fontSize: 13,
    color: '#444444',
    fontWeight: '700',
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
    // No flexDirection/flexWrap here on purpose. This used to be a manual
    // wrapping row grid layered on top of numColumns, which ignored the
    // column count: with numColumns={1} FlatList gives each item a
    // content-sized cell wrapper, so itemCell's width:'100%' resolved
    // against that wrapper and two rows sat side by side anyway. Let
    // numColumns do the work, exactly as KeywordPanel does.
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
  itemPressed: {
    backgroundColor: '#EEEEEE',
  },
  pinBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: {
    // Outline star for unpinned, filled for pinned. Both dark: the old
    // #CCCCCC outline was near-invisible on e-ink.
    fontSize: 24,
    color: '#444444',
  },
  pinIconActive: {
    color: '#000000',
  },
  itemLabel: {
    // Sizes to its content and shrinks if it must, but does not grow: growing
    // is what pushed the indicators out to the far right of the cell.
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
    fontSize: 20,
    color: '#000000',
    fontWeight: '500',
  },
  itemSpacer: {
    flex: 1,
  },
  // Keep long structured keys from consuming the keyword row.
  flagBadge: {
    minWidth: 26,
    maxWidth: '30%',
    borderWidth: 1,
    borderColor: '#999999',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignItems: 'center',
  },
  flagBadgeText: {
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
