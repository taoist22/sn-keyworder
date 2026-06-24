import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  PluginCommAPI,
  PluginFileAPI,
  PluginManager,
  PluginNoteAPI,
} from 'sn-plugin-lib';
import {
  ApiRes,
  getErrorMessage,
  requireApiResult,
  withTimeout,
} from './apiSafety';
import {Keyword, keywordValue} from './storage';

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_WIDTH = 480;
const PANEL_PADDING = 20;
const ITEM_HEIGHT = 60;
const SECTION_HEADER_HEIGHT = 28;
const ERROR_DISPLAY_MS = 2500;

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  keywords: Keyword[];
  onManage: () => void;
};

type Filter = 'all' | 'pinned' | `key:${string}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_WIDTH = 1404;
const DEFAULT_PAGE_HEIGHT = 1872;
const LABEL_FONT_SIZE = 40;
const LABEL_BOX_HEIGHT = 50;
const BOTTOM_MARGIN = 160;
const LEFT_MARGIN = 180;
const RIGHT_MARGIN = 20;
const TOP_MARGIN = 80;
const H_GAP = 40;
const V_GAP = 24;
const MIN_LABEL_BOX_WIDTH = LABEL_FONT_SIZE * 4;
const KEY_FILTER_PREFIX = 'key:';
const API_TIMEOUT_MS = 8000;

type LayoutBox = {
  label: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function estimateLabelWidth(label: string): number {
  return Math.max(
    MIN_LABEL_BOX_WIDTH,
    Math.ceil(label.length * LABEL_FONT_SIZE * 0.8 * 1.15),
  );
}

function createKeywordLayout(
  labels: string[],
  pageWidth: number,
  pageHeight: number,
): LayoutBox[] {
  const maxRight = Math.max(
    LEFT_MARGIN + MIN_LABEL_BOX_WIDTH,
    pageWidth - RIGHT_MARGIN,
  );
  const maxWidth = Math.max(MIN_LABEL_BOX_WIDTH, maxRight - LEFT_MARGIN);
  const rows: Array<Array<{label: string; width: number}>> = [];
  let currentRow: Array<{label: string; width: number}> = [];
  let currentWidth = 0;

  for (const label of labels) {
    const width = Math.min(estimateLabelWidth(label), maxWidth);
    const nextWidth =
      currentRow.length === 0 ? width : currentWidth + H_GAP + width;

    if (currentRow.length > 0 && nextWidth > maxWidth) {
      rows.push(currentRow);
      currentRow = [{label, width}];
      currentWidth = width;
    } else {
      currentRow.push({label, width});
      currentWidth = nextWidth;
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  const firstBottom = pageHeight - BOTTOM_MARGIN;
  const availableHeight = Math.max(LABEL_BOX_HEIGHT, firstBottom - TOP_MARGIN);
  const naturalRowsHeight =
    rows.length * LABEL_BOX_HEIGHT + Math.max(0, rows.length - 1) * V_GAP;
  const rowGap =
    rows.length > 1 && naturalRowsHeight > availableHeight
      ? Math.max(
          8,
          Math.floor(
            (availableHeight - rows.length * LABEL_BOX_HEIGHT) /
              (rows.length - 1),
          ),
        )
      : V_GAP;
  const rowStride = LABEL_BOX_HEIGHT + rowGap;
  const boxes: LayoutBox[] = [];

  rows.forEach((row, rowIndex) => {
    const bottom = firstBottom - rowIndex * rowStride;
    const top = bottom - LABEL_BOX_HEIGHT;
    let left = LEFT_MARGIN;

    row.forEach(item => {
      const right = Math.min(maxRight, left + item.width);
      boxes.push({
        label: item.label,
        left,
        top,
        right,
        bottom: top + LABEL_BOX_HEIGHT,
      });
      left = right + H_GAP;
    });
  });

  return boxes;
}

async function doInsertKeywords(labels: string[]): Promise<void> {
  const pathRes = (await withTimeout(
    PluginCommAPI.getCurrentFilePath(),
    'Current file lookup',
    API_TIMEOUT_MS,
  )) as ApiRes<string>;
  const filePath = requireApiResult(pathRes, 'Could not read current file');

  const pageRes = (await withTimeout(
    PluginCommAPI.getCurrentPageNum(),
    'Current page lookup',
    API_TIMEOUT_MS,
  )) as ApiRes<number>;
  const pageNum = requireApiResult(pageRes, 'Could not read current page');

  let pageWidth = DEFAULT_PAGE_WIDTH;
  let pageHeight = DEFAULT_PAGE_HEIGHT;
  const sizeRes = (await withTimeout(
    PluginFileAPI.getPageSize(filePath, pageNum),
    'Page size lookup',
    API_TIMEOUT_MS,
  )) as ApiRes<{width: number; height: number}>;
  const pageSize = requireApiResult(sizeRes, 'Could not read page size');
  pageWidth = pageSize.width;
  pageHeight = pageSize.height;

  const isNote = filePath?.toLowerCase().endsWith('.note') ?? true;

  const boxes = createKeywordLayout(labels, pageWidth, pageHeight);

  for (const box of boxes) {
    const {label, left, top, right, bottom} = box;

    if (isNote) {
      const textRect = {left, top, right, bottom};
      const res = (await withTimeout(
        PluginNoteAPI.insertText({
          textContentFull: label,
          textRect,
          fontSize: LABEL_FONT_SIZE,
          textBold: 1,
          textItalics: 0,
          textAlign: 0,
          textEditable: 1,
          showLassoAfterInsert: false,
        }),
        `Inserting "${label}"`,
        API_TIMEOUT_MS,
      )) as ApiRes<boolean>;

      if (!res?.success) {
        throw new Error(res?.error?.message ?? `Could not insert "${label}"`);
      }
    }

    const kwRes = (await withTimeout(
      PluginFileAPI.insertKeyWord(filePath, pageNum, label),
      `Indexing "${label}"`,
      API_TIMEOUT_MS,
    )) as ApiRes<boolean>;
    if (!kwRes?.success) {
      throw new Error(
        kwRes?.error?.message ?? `Keyword indexing failed for "${label}"`,
      );
    }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KeywordPanel({keywords, onManage}: Props) {
  const [inserting, setInserting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sectionYRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  // Pinned keywords in insertion order
  const pinned = useMemo(() => keywords.filter(k => k.pinned), [keywords]);

  const filterKeys = useMemo(
    () =>
      Array.from(
        new Set(
          keywords.map(k => k.key).filter((key): key is string => Boolean(key)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [keywords],
  );

  const visibleKeywords = useMemo(() => {
    if (filter === 'pinned') {
      return keywords.filter(k => k.pinned);
    }
    if (filter.startsWith(KEY_FILTER_PREFIX)) {
      const key = filter.slice(KEY_FILTER_PREFIX.length);
      return keywords.filter(k => k.key === key);
    }
    return keywords;
  }, [filter, keywords]);

  const visibleIds = useMemo(
    () => visibleKeywords.map(k => k.id),
    [visibleKeywords],
  );

  // All keywords grouped by first letter, alphabetical
  const sections = useMemo(() => {
    const sorted = [...visibleKeywords].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    const map = new Map<string, Keyword[]>();
    for (const kw of sorted) {
      const letter = (kw.label[0] ?? '#').toUpperCase();
      if (!map.has(letter)) {
        map.set(letter, []);
      }
      map.get(letter)!.push(kw);
    }
    return Array.from(map.entries()).map(([letter, items]) => ({
      letter,
      items,
    }));
  }, [visibleKeywords]);

  const activeLetters = useMemo(
    () => new Set(sections.map(s => s.letter)),
    [sections],
  );

  // ── Actions ──

  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = setTimeout(() => setError(null), ERROR_DISPLAY_MS);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  }, []);

  const handleSelectVisible = useCallback(() => {
    setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  }, [visibleIds]);

  const handleClearSelected = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleInsertSelected = useCallback(async () => {
    if (inserting || selectedIds.length === 0) {
      return;
    }
    setInserting(true);
    setError(null);
    try {
      const labels = selectedIds
        .map(id => {
          const kw = keywords.find(k => k.id === id);
          return kw ? keywordValue(kw) : '';
        })
        .filter(Boolean);
      await doInsertKeywords(labels);
      PluginManager.closePluginView();
    } catch (caughtError) {
      showError(getErrorMessage(caughtError, 'Insert failed'));
    } finally {
      setInserting(false);
    }
  }, [inserting, selectedIds, keywords, showError]);

  const handleClose = useCallback(() => {
    if (!inserting) {
      PluginManager.closePluginView();
    }
  }, [inserting]);

  const handleJump = useCallback((letter: string) => {
    const y = sectionYRef.current[letter];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({y, animated: false});
    }
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedVisibleCount = useMemo(
    () => visibleIds.filter(id => selectedSet.has(id)).length,
    [selectedSet, visibleIds],
  );
  const canSelectFilter =
    filter !== 'all' &&
    visibleIds.length > 0 &&
    selectedVisibleCount < visibleIds.length;

  // ── Render ──

  return (
    <Pressable style={styles.overlay} onPress={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.panel} onPress={e => e.stopPropagation()}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.title}>Keyword Page</Text>
            <Pressable
              onPress={onManage}
              style={({pressed}) => [
                styles.manageBtn,
                pressed && styles.btnPressed,
              ]}>
              <Text style={styles.manageBtnText}>Manage</Text>
            </Pressable>
            <Pressable
              onPress={handleClose}
              style={({pressed}) => [
                styles.closeBtn,
                pressed && styles.btnPressed,
              ]}>
              <Text style={styles.closeText}>{'✕'}</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
          <View style={styles.subheader}>
            <Text style={styles.subheaderText}>
              Select keywords, then tap Insert
            </Text>
          </View>
          <View style={styles.divider} />

          {/* ── Error banner ── */}
          {error != null && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Filter row ── */}
          <View style={styles.filterWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}>
              <FilterChip
                label="All"
                active={filter === 'all'}
                onPress={() => setFilter('all')}
              />
              {pinned.length > 0 && (
                <FilterChip
                  label="Pinned"
                  active={filter === 'pinned'}
                  onPress={() => setFilter('pinned')}
                />
              )}
              {filterKeys.map(key => (
                <FilterChip
                  key={key}
                  label={key}
                  active={filter === `${KEY_FILTER_PREFIX}${key}`}
                  onPress={() => setFilter(`${KEY_FILTER_PREFIX}${key}`)}
                />
              ))}
            </ScrollView>
          </View>
          <View style={styles.divider} />

          {/* ── Pinned section ── */}
          {filter === 'all' && pinned.length > 0 && (
            <>
              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>PINNED</Text>
              </View>
              <ScrollView
                style={styles.pinnedScroll}
                scrollEnabled={pinned.length > 3}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}>
                {pinned.map((kw, idx) => (
                  <React.Fragment key={kw.id}>
                    {idx > 0 && <View style={styles.itemDivider} />}
                    <KeywordItem
                      kw={kw}
                      selected={selectedSet.has(kw.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  </React.Fragment>
                ))}
              </ScrollView>
              <View style={styles.divider} />
            </>
          )}

          {/* ── A-Z jump row (active letters only, full width) ── */}
          {activeLetters.size > 0 && (
            <View style={styles.jumpRow}>
              {Array.from(activeLetters)
                .sort()
                .map(letter => (
                  <Pressable
                    key={letter}
                    onPress={() => handleJump(letter)}
                    style={({pressed}) => [
                      styles.jumpBtn,
                      pressed && styles.jumpBtnPressed,
                    ]}>
                    <Text style={styles.jumpBtnText}>{letter}</Text>
                  </Pressable>
                ))}
            </View>
          )}

          <View style={styles.divider} />

          {/* ── Full keyword list (scrollable, grouped by letter) ── */}
          {sections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {filter === 'all'
                  ? 'No keywords yet.\nTap Manage to add your first keyword.'
                  : 'No keywords in this view.'}
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.listScroll}
              showsVerticalScrollIndicator={false}>
              {sections.map(({letter, items}) => (
                <View
                  key={letter}
                  onLayout={e => {
                    sectionYRef.current[letter] = e.nativeEvent.layout.y;
                  }}>
                  <View style={styles.listSectionHeader}>
                    <Text style={styles.listSectionHeaderText}>{letter}</Text>
                  </View>
                  {items.map((kw, idx) => (
                    <React.Fragment key={kw.id}>
                      {idx > 0 && <View style={styles.itemDivider} />}
                      <KeywordItem
                        kw={kw}
                        selected={selectedSet.has(kw.id)}
                        onToggleSelect={handleToggleSelect}
                      />
                    </React.Fragment>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}

          {/* ── Insert bar ── */}
          <View style={styles.divider} />
          <View style={styles.selectionTools}>
            {filter !== 'all' && (
              <Pressable
                onPress={handleSelectVisible}
                disabled={!canSelectFilter}
                style={({pressed}) => [
                  styles.toolBtn,
                  pressed && styles.btnPressed,
                  !canSelectFilter && styles.toolBtnDisabled,
                ]}>
                <Text style={styles.toolBtnText}>Select Filter</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleClearSelected}
              disabled={selectedIds.length === 0}
              style={({pressed}) => [
                styles.toolBtn,
                pressed && styles.btnPressed,
                selectedIds.length === 0 && styles.toolBtnDisabled,
              ]}>
              <Text style={styles.toolBtnText}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
          <View style={styles.insertBar}>
            <Text style={styles.selectHint}>
              {selectedIds.length === 0
                ? 'None selected'
                : `${selectedIds.length} selected`}
            </Text>
            <Pressable
              onPress={handleInsertSelected}
              disabled={inserting || selectedIds.length === 0}
              style={({pressed}) => [
                styles.insertBtn,
                (inserting || selectedIds.length === 0) &&
                  styles.insertBtnDisabled,
                pressed && styles.btnPressed,
              ]}>
              <Text
                style={[
                  styles.insertBtnText,
                  (inserting || selectedIds.length === 0) &&
                    styles.insertBtnTextDisabled,
                ]}>
                {inserting ? 'Inserting…' : 'Insert'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

// ─── KeywordItem ─────────────────────────────────────────────────────────────

function KeywordItem({
  kw,
  selected,
  onToggleSelect,
}: {
  kw: Keyword;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <Pressable
      style={({pressed}) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => onToggleSelect(kw.id)}>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected && <Text style={styles.checkmark}>{'✓'}</Text>}
      </View>
      <View style={styles.itemTextWrap}>
        <Text style={styles.itemText}>{kw.label}</Text>
        {kw.key != null && (
          <Text style={styles.itemMeta}>
            {kw.key}:{kw.label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.btnPressed,
      ]}>
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
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
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
  },
  manageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    marginRight: 10,
  },
  manageBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
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
  itemDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginHorizontal: PANEL_PADDING,
  },

  // Subheader note
  subheader: {
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 8,
    backgroundColor: '#F8F8F8',
  },
  subheaderText: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
  },

  // Error
  errorBanner: {
    marginHorizontal: PANEL_PADDING,
    marginVertical: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },

  // Pinned section
  filterWrap: {
    backgroundColor: '#FFFFFF',
  },
  filterRow: {
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    minWidth: 58,
    height: 34,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#999999',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  filterChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  filterChipText: {
    fontSize: 13,
    color: '#555555',
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sectionLabel: {
    paddingHorizontal: PANEL_PADDING,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
    letterSpacing: 1,
  },
  pinnedScroll: {
    maxHeight: 192,
  },

  // A-Z jump row (active letters only, full width)
  jumpRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 10,
  },
  jumpBtn: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  jumpBtnPressed: {
    backgroundColor: '#D0D0D0',
  },
  jumpBtnText: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '700',
  },

  // Full list
  listScroll: {
    flex: 1,
  },
  listSectionHeader: {
    height: SECTION_HEADER_HEIGHT,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: PANEL_PADDING,
    justifyContent: 'center',
  },
  listSectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555555',
    letterSpacing: 0.5,
  },

  // Keyword item (shared by pinned and list)
  item: {
    height: ITEM_HEIGHT,
    paddingHorizontal: PANEL_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  itemPressed: {
    backgroundColor: '#F0F0F0',
  },
  itemText: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '500',
  },
  itemTextWrap: {
    flex: 1,
  },
  itemMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#777777',
    fontWeight: '600',
  },
  // Selection tools
  selectionTools: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 8,
    gap: 10,
  },
  toolBtn: {
    flex: 1,
    height: 34,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#777777',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnDisabled: {
    opacity: 0.35,
  },
  toolBtnText: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '700',
  },

  // Checkbox
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#AAAAAA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  checkmark: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
    lineHeight: 18,
  },

  // Insert bar
  insertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 12,
    gap: 14,
  },
  selectHint: {
    flex: 1,
    fontSize: 15,
    color: '#888888',
  },
  insertBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#000000',
  },
  insertBtnDisabled: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCCCCC',
  },
  insertBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  insertBtnTextDisabled: {
    color: '#CCCCCC',
  },

  // Empty state
  emptyState: {
    paddingVertical: 40,
    paddingHorizontal: PANEL_PADDING,
    alignItems: 'center',
    gap: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 26,
  },
  refreshBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  refreshBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});
