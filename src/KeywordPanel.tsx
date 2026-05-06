import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {PluginCommAPI, PluginFileAPI, PluginManager, PluginNoteAPI} from 'sn-plugin-lib';
import {Keyword} from './storage';

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_WIDTH = 480;
const PANEL_PADDING = 20;
const ITEM_HEIGHT = 60;
const SECTION_HEADER_HEIGHT = 28;
const ERROR_DISPLAY_MS = 2500;

// ─── Types ───────────────────────────────────────────────────────────────────

type ApiRes<T> =
  | {success: boolean; result?: T; error?: {message?: string}}
  | null
  | undefined;

type Props = {
  keywords: Keyword[];
  onManage: () => void;
  onRefresh: () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_WIDTH = 1404;
const DEFAULT_PAGE_HEIGHT = 1872;
const LABEL_FONT_SIZE = 40;
const LABEL_BOX_HEIGHT = 80;
const BOTTOM_MARGIN = 160;
const LEFT_MARGIN = 180;

async function doInsertKeyword(label: string): Promise<void> {
  let pageWidth = DEFAULT_PAGE_WIDTH;
  let pageHeight = DEFAULT_PAGE_HEIGHT;
  let filePath: string | undefined;
  let pageNum: number | undefined;

  try {
    const pathRes = (await PluginCommAPI.getCurrentFilePath()) as ApiRes<string>;
    const pageRes = (await PluginCommAPI.getCurrentPageNum()) as ApiRes<number>;
    if (pathRes?.success && pageRes?.success) {
      filePath = pathRes.result as string;
      pageNum = pageRes.result as number;
      const sizeRes = (await PluginFileAPI.getPageSize(
        filePath,
        pageNum,
      )) as ApiRes<{width: number; height: number}>;
      if (sizeRes?.success && sizeRes.result) {
        pageWidth = sizeRes.result.width;
        pageHeight = sizeRes.result.height;
      }
    }
  } catch {
    // fall through to defaults
  }

  const boxWidth = Math.max(
    LABEL_FONT_SIZE * 6,
    Math.min(
      Math.ceil(label.length * LABEL_FONT_SIZE * 0.75 * 1.4),
      pageWidth - 200,
    ),
  );
  const bottom = Math.round(pageHeight - BOTTOM_MARGIN);
  const top = bottom - LABEL_BOX_HEIGHT;
  const textRect = {left: LEFT_MARGIN, top, right: LEFT_MARGIN + boxWidth, bottom};

  const res = (await PluginNoteAPI.insertText({
    textContentFull: label,
    textRect,
    fontSize: LABEL_FONT_SIZE,
    textBold: 1,
    textItalics: 0,
    textAlign: 0,
    textEditable: 1,
    showLassoAfterInsert: true,
  })) as ApiRes<boolean>;

  if (!res?.success) {
    throw new Error(res?.error?.message ?? 'insertText failed');
  }

  // Best-effort: also add to native keyword index for page navigation
  try {
    if (filePath !== undefined && pageNum !== undefined) {
      await PluginFileAPI.insertKeyWord(filePath, pageNum, label);
    }
  } catch {
    // non-fatal — duplicate and other errors are acceptable
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KeywordPanel({keywords, onManage, onRefresh}: Props) {
  const [inserting, setInserting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const pinned = useMemo(
    () => keywords.filter(k => k.pinned),
    [keywords],
  );

  // All keywords grouped by first letter, alphabetical
  const sections = useMemo(() => {
    const sorted = [...keywords].sort((a, b) =>
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
  }, [keywords]);

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

  const handleInsert = useCallback(
    async (kw: Keyword) => {
      if (inserting) {
        return;
      }
      setInserting(true);
      setError(null);
      try {
        await doInsertKeyword(kw.label);
        PluginManager.closePluginView();
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Insert failed');
      } finally {
        setInserting(false);
      }
    },
    [inserting, showError],
  );

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


  // ── Render ──

  return (
    <Pressable style={styles.overlay} onPress={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.panel} onPress={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.title}>Keyword Page</Text>
            {false && (
              <Pressable
                onPress={onManage}
                style={({pressed}) => [
                  styles.manageBtn,
                  pressed && styles.btnPressed,
                ]}>
                <Text style={styles.manageBtnText}>Manage</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onRefresh}
              style={({pressed}) => [
                styles.manageBtn,
                pressed && styles.btnPressed,
              ]}>
              <Text style={styles.manageBtnText}>Refresh</Text>
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

          {/* ── Error banner ── */}
          {error != null && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Pinned section ── */}
          {pinned.length > 0 && (
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
                    <KeywordItem kw={kw} onPress={handleInsert} />
                  </React.Fragment>
                ))}
              </ScrollView>
              <View style={styles.divider} />
            </>
          )}

          {/* ── A-Z jump row (active letters only, full width) ── */}
          {activeLetters.size > 0 && (
            <View style={styles.jumpRow}>
              {Array.from(activeLetters).sort().map(letter => (
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
                {'No keywords yet.\nUse the Keyword Builder web tool to create your keywords.json file.'}
              </Text>
              <Pressable
                onPress={onRefresh}
                style={({pressed}) => [styles.refreshBtn, pressed && styles.btnPressed]}>
                <Text style={styles.refreshBtnText}>Load Keywords</Text>
              </Pressable>
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
                      <KeywordItem kw={kw} onPress={handleInsert} />
                    </React.Fragment>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}

        </Pressable>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

// ─── KeywordItem ─────────────────────────────────────────────────────────────

function KeywordItem({
  kw,
  onPress,
}: {
  kw: Keyword;
  onPress: (kw: Keyword) => void;
}) {
  return (
    <Pressable
      style={({pressed}) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => onPress(kw)}>
      <Text style={styles.itemText}>{kw.label}</Text>
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
    justifyContent: 'center',
  },
  itemPressed: {
    backgroundColor: '#F0F0F0',
  },
  itemText: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '500',
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
