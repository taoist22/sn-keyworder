import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  PluginCommAPI,
  PluginFileAPI,
  PluginManager,
  PluginNoteAPI,
} from 'sn-plugin-lib';
import {Keyword, makeId} from './storage';

const PANEL_WIDTH = 480;
const PANEL_PADDING = 20;

type Props = {
  keywords: Keyword[];
  onAdded: (kw: Keyword) => Promise<void>;
  onDone: () => void;
};

type Phase =
  | {kind: 'loading'; msg: string}
  | {kind: 'ready'}
  | {kind: 'error'; msg: string};

type ApiRes<T> =
  | {success: boolean; result?: T; error?: {message?: string}}
  | null
  | undefined;

async function extractText(onStatus: (msg: string) => void): Promise<string> {
  // Typed text boxes: faster, no OCR needed
  const lassoTextRes = (await PluginNoteAPI.getLassoText()) as ApiRes<
    Array<{textContentFull: string}>
  >;
  if (lassoTextRes?.success && lassoTextRes.result?.length) {
    const combined = lassoTextRes.result
      .map(tb => tb.textContentFull?.trim())
      .filter(Boolean)
      .join(' ');
    if (combined) {
      return combined;
    }
  }

  // Fall back to OCR on strokes
  onStatus('Recognizing handwriting…');
  const elementsRes = (await PluginCommAPI.getLassoElements()) as ApiRes<any[]>;
  if (!elementsRes?.success || !elementsRes.result?.length) {
    throw new Error('Nothing to recognize in selection');
  }

  const strokes = elementsRes.result.filter((e: any) => e.type === 0);
  if (strokes.length === 0) {
    for (const el of elementsRes.result) {
      try {
        el.recycle?.();
      } catch {}
    }
    throw new Error('No strokes to recognize');
  }

  // Get page size for recognition coordinate mapping
  const pathRes = (await PluginCommAPI.getCurrentFilePath()) as ApiRes<string>;
  const pageRes = (await PluginCommAPI.getCurrentPageNum()) as ApiRes<number>;
  let pageSize = {width: 1404, height: 1872};
  if (
    pathRes?.success &&
    pathRes.result &&
    pageRes?.success &&
    pageRes.result !== undefined
  ) {
    const sizeRes = (await PluginFileAPI.getPageSize(
      pathRes.result,
      pageRes.result,
    )) as ApiRes<{width: number; height: number}>;
    if (sizeRes?.success && sizeRes.result) {
      pageSize = sizeRes.result;
    }
  }

  const recogRes = (await PluginCommAPI.recognizeElements(
    strokes,
    pageSize,
  )) as ApiRes<string>;

  for (const el of elementsRes.result) {
    try {
      await el.recycle?.();
    } catch {}
  }

  if (!recogRes?.success || !recogRes.result?.trim()) {
    throw new Error('Could not recognize handwriting');
  }
  return recogRes.result.trim();
}

export default function LassoAddPanel({keywords, onAdded, onDone}: Props) {
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
    extractText(msg => {
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
        setPhase({kind: 'error', msg: err?.message ?? 'Could not read selection'});
        setTimeout(() => inputRef.current?.focus(), 100);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      // Register with Supernote's native keyword index (best-effort)
      try {
        const pathRes = (await PluginCommAPI.getCurrentFilePath()) as ApiRes<string>;
        const pageRes = (await PluginCommAPI.getCurrentPageNum()) as ApiRes<number>;
        if (pathRes?.success && pathRes.result && pageRes?.success && pageRes.result !== undefined) {
          await (PluginFileAPI.insertKeyWord(pathRes.result, pageRes.result, label) as any);
        }
      } catch {}
      onDone();
    } catch {
      setAddError('Failed to save');
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
            style={({pressed}) => [styles.closeBtn, pressed && styles.btnPressed]}>
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
            style={({pressed}) => [styles.cancelBtn, pressed && styles.btnPressed]}>
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
