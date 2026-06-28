import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {
  PluginCommAPI,
  PluginDocAPI,
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
import {Keyword, makeId} from './storage';

const PANEL_WIDTH = 480;
const PANEL_PADDING = 20;

type Props = {
  source: 'lasso' | 'doc-selection';
  keywords: Keyword[];
  onAdded: (kw: Keyword) => Promise<void>;
  onDone: () => void;
};

type Phase =
  | {kind: 'loading'; msg: string}
  | {kind: 'ready'}
  | {kind: 'error'; msg: string};

const API_TIMEOUT_MS = 8000;
const OCR_TIMEOUT_MS = 15000;
const DEFAULT_PAGE_SIZE = {width: 1404, height: 1872};

async function recycleElements(elements: any[]): Promise<void> {
  for (const el of elements) {
    try {
      await el.recycle?.();
    } catch (error) {
      console.warn('[LassoAdd] recycle failed:', error);
    }
  }
}

function clearElementCache(): void {
  try {
    PluginCommAPI.clearElementCache();
  } catch (error) {
    console.warn('[LassoAdd] clearElementCache failed:', error);
  }
}

async function getCurrentPageSize(): Promise<{width: number; height: number}> {
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

  const sizeRes = (await withTimeout(
    PluginFileAPI.getPageSize(filePath, pageNum),
    'Page size lookup',
    API_TIMEOUT_MS,
  )) as ApiRes<{width: number; height: number}>;

  return requireApiResult(sizeRes, 'Could not read page size');
}

async function extractDocSelectedText(): Promise<string> {
  const selectedTextRes = (await withTimeout(
    PluginDocAPI.getLastSelectedText(),
    'Reading selected document text',
    API_TIMEOUT_MS,
  )) as ApiRes<string>;
  const selectedText = requireApiResult(
    selectedTextRes,
    'Could not read selected document text',
  ).trim();
  if (!selectedText) {
    throw new Error('No selected document text');
  }
  return selectedText;
}

async function extractLassoText(
  onStatus: (msg: string) => void,
): Promise<string> {
  // Typed text boxes: faster, no OCR needed
  try {
    const lassoTextRes = (await withTimeout(
      PluginNoteAPI.getLassoText(),
      'Reading selected typed text',
      API_TIMEOUT_MS,
    )) as ApiRes<Array<{textContentFull: string}>>;
    if (lassoTextRes?.success && lassoTextRes.result?.length) {
      const combined = lassoTextRes.result
        .map(tb => tb.textContentFull?.trim())
        .filter(Boolean)
        .join(' ');
      if (combined) {
        return combined;
      }
    }
  } catch (error) {
    console.warn('[LassoAdd] getLassoText failed, trying OCR:', error);
  }

  // Fall back to OCR on strokes
  onStatus('Recognizing handwriting…');
  const elementsRes = (await withTimeout(
    PluginCommAPI.getLassoElements(),
    'Reading selected handwriting',
    API_TIMEOUT_MS,
  )) as ApiRes<any[]>;
  if (!elementsRes?.success || !elementsRes.result?.length) {
    throw new Error('Nothing to recognize in selection');
  }

  const elements = elementsRes.result;
  try {
    const strokes = elements.filter((e: any) => e.type === 0);
    if (strokes.length === 0) {
      throw new Error('No strokes to recognize');
    }

    let pageSize = DEFAULT_PAGE_SIZE;
    try {
      pageSize = await getCurrentPageSize();
    } catch (error) {
      console.warn('[LassoAdd] page size lookup failed:', error);
      throw new Error('Could not read page size for handwriting recognition');
    }

    const recogRes = (await withTimeout(
      PluginCommAPI.recognizeElements(strokes, pageSize),
      'Handwriting recognition',
      OCR_TIMEOUT_MS,
    )) as ApiRes<string>;

    if (!recogRes?.success || !recogRes.result?.trim()) {
      throw new Error(
        recogRes?.error?.message ?? 'Could not recognize handwriting',
      );
    }
    return recogRes.result.trim();
  } finally {
    await recycleElements(elements);
    clearElementCache();
  }
}

async function extractText(
  source: Props['source'],
  onStatus: (msg: string) => void,
): Promise<string> {
  if (source === 'doc-selection') {
    return extractDocSelectedText();
  }
  return extractLassoText(onStatus);
}

export default function LassoAddPanel({
  source,
  keywords,
  onAdded,
  onDone,
}: Props) {
  const [phase, setPhase] = useState<Phase>({
    kind: 'loading',
    msg: 'Reading selection…',
  });
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    extractText(source, msg => {
      if (!cancelled) {
        setPhase({kind: 'loading', msg});
      }
    })
      .then(extracted => {
        if (cancelled) {
          return;
        }
        setText(extracted);
        setPhase({kind: 'ready'});
        setTimeout(() => inputRef.current?.focus(), 100);
      })
      .catch(err => {
        if (cancelled) {
          return;
        }
        setPhase({
          kind: 'error',
          msg: getErrorMessage(err, 'Could not read selection'),
        });
        setTimeout(() => inputRef.current?.focus(), 100);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const handleAdd = useCallback(async () => {
    const label = text.trim();
    if (!label || adding) {
      return;
    }
    const isDupe = keywords.some(
      k => k.label.toLowerCase() === label.toLowerCase(),
    );
    if (isDupe) {
      setAddError(`“${label}” is already a keyword`);
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await onAdded({id: makeId(), label, pinned: false});
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
      const keywordRes = (await withTimeout(
        PluginFileAPI.insertKeyWord(filePath, pageNum, label),
        'Keyword indexing',
        API_TIMEOUT_MS,
      )) as ApiRes<boolean>;
      requireApiResult(keywordRes, `Could not index "${label}"`);
      onDone();
    } catch (error) {
      setAddError(getErrorMessage(error, 'Failed to save'));
    } finally {
      setAdding(false);
    }
  }, [text, adding, keywords, onAdded, onDone]);

  const handleClose = useCallback(() => {
    if (!adding) {
      PluginManager.closePluginView();
    }
  }, [adding]);

  const isLoading = phase.kind === 'loading';
  const canAdd = !adding && !isLoading && text.trim().length > 0;

  return (
    <Pressable style={styles.overlay} onPress={handleClose}>
      <Pressable style={styles.panel} onPress={e => e.stopPropagation()}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add as Keyword</Text>
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

        {/* Body */}
        <View style={styles.body}>
          {isLoading ? (
            <Text style={styles.statusText}>{phase.msg}</Text>
          ) : (
            <>
              {phase.kind === 'error' && (
                <Text style={styles.hintText}>
                  {phase.msg} — type keyword below
                </Text>
              )}
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={text}
                onChangeText={t => {
                  setText(t);
                  setAddError(null);
                }}
                placeholder="Keyword…"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleAdd}
                maxLength={40}
              />
              {addError != null && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{addError}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.divider} />
        <View style={styles.footer}>
          <Pressable
            onPress={handleClose}
            style={({pressed}) => [
              styles.cancelBtn,
              pressed && styles.btnPressed,
            ]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleAdd}
            disabled={!canAdd}
            style={({pressed}) => [
              styles.addBtn,
              !canAdd && styles.addBtnDisabled,
              pressed && styles.btnPressed,
            ]}>
            <Text
              style={[styles.addBtnText, !canAdd && styles.addBtnTextDisabled]}>
              {adding ? 'Adding…' : 'Add'}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: PANEL_WIDTH,
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

  divider: {
    height: 1,
    backgroundColor: '#000000',
  },

  // Body
  body: {
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 24,
    gap: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    paddingVertical: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#888888',
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 14,
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  errorBanner: {
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: PANEL_PADDING,
    paddingVertical: 14,
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  addBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#000000',
  },
  addBtnDisabled: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCCCCC',
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addBtnTextDisabled: {
    color: '#CCCCCC',
  },
});
