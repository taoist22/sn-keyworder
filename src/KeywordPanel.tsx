import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import {getPanelMetrics} from './responsivePanel';

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_PADDING = 20;
const ITEM_HEIGHT = 58;
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
const DEVICE_NATIVE_PORTRAIT: Record<number, {width: number; height: number}> =
  {
    3: {width: 1404, height: 1872}, // A5X
    4: {width: 1404, height: 1872}, // Nomad
    5: {width: 1920, height: 2560}, // Manta
  };

type LayoutBox = {
  label: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function nativePlacementSizeFor(
  pageWidth: number,
  pageHeight: number,
  deviceType: number | null,
): {width: number; height: number} {
  if (deviceType == null) {
    return {width: pageWidth, height: pageHeight};
  }
  const native = DEVICE_NATIVE_PORTRAIT[deviceType];
  if (!native) {
    return {width: pageWidth, height: pageHeight};
  }
  const isLandscape = pageWidth > pageHeight;
  const nativeWidth = isLandscape ? native.height : native.width;
  const nativeHeight = isLandscape ? native.width : native.height;
  return {
    width: Math.min(pageWidth, nativeWidth),
    height: Math.min(pageHeight, nativeHeight),
  };
}

async function getDeviceTypeSafe(): Promise<number | null> {
  try {
    const deviceType = (await PluginManager.getDeviceType()) as unknown;
    if (typeof deviceType === 'number') {
      return deviceType;
    }
    if (typeof (deviceType as any)?.result === 'number') {
      return (deviceType as any).result;
    }
  } catch {
    // Fall back to page size if the device type bridge is unavailable.
  }
  return null;
}

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
  const deviceType = await getDeviceTypeSafe();
  const placementSize = nativePlacementSizeFor(
    pageWidth,
    pageHeight,
    deviceType,
  );

  const isNote = filePath?.toLowerCase().endsWith('.note') ?? true;

  const boxes = createKeywordLayout(
    labels,
    placementSize.width,
    placementSize.height,
  );

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
  const windowSize = useWindowDimensions();
  const panelMetrics = useMemo(
    () => getPanelMetrics(windowSize.width, windowSize.height),
    [windowSize.width, windowSize.height],
  );
  const [inserting, setInserting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const activeLetters = useMemo(() => {
    const letters: string[] = [];
    const sorted = [...visibleKeywords].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    for (const kw of sorted) {
      const letter = (kw.label[0] ?? '#').toUpperCase();
      if (!letters.includes(letter)) {
        letters.push(letter);
      }
    }
    return letters;
  }, [visibleKeywords]);

  useEffect(() => {
    if (letterFilter != null && !activeLetters.includes(letterFilter)) {
      setLetterFilter(null);
    }
  }, [activeLetters, letterFilter]);

  const visibleKeywordsByLetter = useMemo(() => {
    if (letterFilter == null) {
      return visibleKeywords;
    }
    return visibleKeywords.filter(
      kw => (kw.label[0] ?? '#').toUpperCase() === letterFilter,
    );
  }, [letterFilter, visibleKeywords]);

  const visibleIds = useMemo(
    () => visibleKeywordsByLetter.map(k => k.id),
    [visibleKeywordsByLetter],
  );

  const sortedVisibleKeywords = useMemo(() => {
    return [...visibleKeywordsByLetter].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [visibleKeywordsByLetter]);

  const pinnedByLetter = useMemo(() => {
    if (letterFilter == null) {
      return pinned;
    }
    return pinned.filter(
      kw => (kw.label[0] ?? '#').toUpperCase() === letterFilter,
    );
  }, [letterFilter, pinned]);

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
    setLetterFilter(prev => (prev === letter ? null : letter));
  }, []);

  const handleFilterChange = useCallback((nextFilter: Filter) => {
    setFilter(nextFilter);
    setLetterFilter(null);
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
  const keywordColumns = panelMetrics.columns;
  const panelStyle = useMemo(
    () => [
      styles.panel,
      {width: panelMetrics.width, height: panelMetrics.height},
    ],
    [panelMetrics.height, panelMetrics.width],
  );

  // ── Render ──

  return (
    <Pressable style={styles.overlay} onPress={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={panelStyle} onPress={e => e.stopPropagation()}>
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
            <View style={styles.filterRow}>
              <FilterChip
                label="All"
                active={filter === 'all'}
                onPress={() => handleFilterChange('all')}
              />
              {pinned.length > 0 && (
                <FilterChip
                  label="Pinned"
                  active={filter === 'pinned'}
                  onPress={() => handleFilterChange('pinned')}
                />
              )}
              {filterKeys.map(key => (
                <FilterChip
                  key={key}
                  label={key}
                  active={filter === `${KEY_FILTER_PREFIX}${key}`}
                  onPress={() =>
                    handleFilterChange(`${KEY_FILTER_PREFIX}${key}`)
                  }
                />
              ))}
            </View>
          </View>
          <View style={styles.divider} />

          {/* ── Pinned section ── */}
          {filter === 'all' && pinnedByLetter.length > 0 && (
            <>
              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>PINNED</Text>
              </View>
              <ScrollView
                style={styles.pinnedScroll}
                scrollEnabled={pinnedByLetter.length > 3}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}>
                <View style={styles.keywordGrid}>
                  {pinnedByLetter.map(kw => (
                    <View
                      key={kw.id}
                      style={[
                        styles.keywordCell,
                        keywordColumns === 2 && styles.keywordCellTwo,
                      ]}>
                      <KeywordItem
                        kw={kw}
                        selected={selectedSet.has(kw.id)}
                        onToggleSelect={handleToggleSelect}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.divider} />
            </>
          )}

          {/* ── Full keyword list ── */}
          {sortedVisibleKeywords.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {filter === 'all'
                  ? 'No keywords yet.\nTap Manage to add your first keyword.'
                  : 'No keywords in this view.'}
              </Text>
            </View>
          ) : (
            <View style={styles.listArea}>
              <ScrollView
                style={styles.listScroll}
                showsVerticalScrollIndicator={false}>
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionLabelText}>
                    {letterFilter
                      ? `${letterFilter} KEYWORDS`
                      : filter === 'all'
                      ? 'ALL KEYWORDS'
                      : 'KEYWORDS'}
                  </Text>
                </View>
                <View style={styles.keywordGrid}>
                  {sortedVisibleKeywords.map(kw => (
                    <View
                      key={kw.id}
                      style={[
                        styles.keywordCell,
                        keywordColumns === 2 && styles.keywordCellTwo,
                      ]}>
                      <KeywordItem
                        kw={kw}
                        selected={selectedSet.has(kw.id)}
                        onToggleSelect={handleToggleSelect}
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
                    pressed && styles.alphaBtnPressed,
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
                      pressed && styles.alphaBtnPressed,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },

  // Header
  header: {
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
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
  // Subheader note
  subheader: {
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 6,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 6,
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
    maxHeight: 144,
  },

  // Full list
  listArea: {
    flex: 1,
    flexDirection: 'row',
  },
  listScroll: {
    flex: 1,
  },
  keywordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  keywordCell: {
    width: '100%',
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  keywordCellTwo: {
    width: '50%',
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
  alphaBtnPressed: {
    backgroundColor: '#E8E8E8',
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

  // Keyword item (shared by pinned and list)
  item: {
    height: ITEM_HEIGHT,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  itemPressed: {
    backgroundColor: '#F0F0F0',
  },
  itemText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  itemTextWrap: {
    flex: 1,
  },
  itemMeta: {
    marginTop: 1,
    fontSize: 10,
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
    width: 20,
    height: 20,
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
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
    lineHeight: 16,
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
