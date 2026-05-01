import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {Keyword, makeId} from './storage';

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_WIDTH = 480;
const PANEL_PADDING = 20;
const ITEM_HEIGHT = 64;

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  keywords: Keyword[];
  onUpdate: (kws: Keyword[]) => Promise<void>;
  onBack: () => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ConfigPanel({keywords, onUpdate, onBack}: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Pinned first (in insertion order), then unpinned alphabetically
  const sorted = useMemo(() => {
    const pinned = keywords.filter(k => k.pinned);
    const unpinned = keywords
      .filter(k => !k.pinned)
      .sort((a, b) => a.label.localeCompare(b.label));
    return [...pinned, ...unpinned];
  }, [keywords]);

  const handleTogglePin = useCallback(
    async (id: string) => {
      const updated = keywords.map(k =>
        k.id === id ? {...k, pinned: !k.pinned} : k,
      );
      await onUpdate(updated);
    },
    [keywords, onUpdate],
  );

  const handleStartAdd = useCallback(() => {
    setAdding(true);
    setNewLabel('');
    setAddError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleConfirmAdd = useCallback(async () => {
    const label = newLabel.trim();
    if (!label) {
      setAdding(false);
      return;
    }
    const isDupe = keywords.some(
      k => k.label.toLowerCase() === label.toLowerCase(),
    );
    if (isDupe) {
      setAddError(`"${label}" already exists`);
      return;
    }
    const updated = [...keywords, {id: makeId(), label, pinned: false}];
    await onUpdate(updated);
    setAdding(false);
    setNewLabel('');
    setAddError(null);
  }, [newLabel, keywords, onUpdate]);

  const handleCancelAdd = useCallback(() => {
    setAdding(false);
    setNewLabel('');
    setAddError(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const updated = keywords.filter(k => k.id !== id);
      await onUpdate(updated);
    },
    [keywords, onUpdate],
  );

  const renderItem = useCallback(
    ({item}: {item: Keyword}) => (
      <ConfigItem
        kw={item}
        onTogglePin={handleTogglePin}
        onDelete={handleDelete}
      />
    ),
    [handleTogglePin, handleDelete],
  );

  const keyExtractor = useCallback((item: Keyword) => item.id, []);

  const ItemSeparator = useCallback(
    () => <View style={styles.itemDivider} />,
    [],
  );

  return (
    <TouchableWithoutFeedback onPress={onBack}>
    <View style={styles.overlay}>
    <View style={styles.panel} onStartShouldSetResponder={() => true} onPress={e => e.stopPropagation()}>

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

      {/* ── Legend + Add button ── */}
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>{'★ pin   ✕ delete'}</Text>
        <Pressable
          onPress={handleStartAdd}
          style={({pressed}) => [styles.addBtn, pressed && styles.btnPressed]}>
          <Text style={styles.addBtnText}>{'+ Add'}</Text>
        </Pressable>
      </View>
      <View style={styles.lightDivider} />

      {/* ── Add input ── */}
      {adding && (
        <>
          <View style={styles.addRow}>
            <TextInput
              ref={inputRef}
              style={styles.addInput}
              value={newLabel}
              onChangeText={text => {setNewLabel(text); setAddError(null);}}
              placeholder="New keyword…"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleConfirmAdd}
              maxLength={40}
            />
            <Pressable
              onPress={handleConfirmAdd}
              style={({pressed}) => [styles.addConfirmBtn, pressed && styles.btnPressed]}>
              <Text style={styles.addConfirmText}>{'✓'}</Text>
            </Pressable>
            <Pressable
              onPress={handleCancelAdd}
              style={({pressed}) => [styles.addCancelBtn, pressed && styles.btnPressed]}>
              <Text style={styles.addCancelText}>{'✕'}</Text>
            </Pressable>
          </View>
          {addError != null && (
            <View style={styles.addErrorBanner}>
              <Text style={styles.addErrorText}>{addError}</Text>
            </View>
          )}
          <View style={styles.lightDivider} />
        </>
      )}

      {/* ── Keyword list ── */}
      {sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {'No keywords yet.\nGo back and tap "+ Add".'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={ItemSeparator}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
        />
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
    width: PANEL_WIDTH,
    height: 680,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
  itemDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginHorizontal: PANEL_PADDING,
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
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#F8F8F8',
  },
  addInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
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
  list: {
    flex: 1,
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
