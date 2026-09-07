import React, {useEffect, useRef} from 'react';
import {BackHandler, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {subscribeToButtonEvents} from './pluginRouter';

export type DuplicateChoice = 'skip' | 'all' | 'cancel';
export type DuplicateRequest = {labels: string[]; resolve: (choice: DuplicateChoice) => void};

export default function DuplicatePrompt({request}: {request: DuplicateRequest}) {
  const settled = useRef(false);
  const choose = (choice: DuplicateChoice) => {
    if (settled.current) {return;}
    settled.current = true;
    request.resolve(choice);
  };
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {choose('cancel'); return true;});
    const unsubscribe = subscribeToButtonEvents(() => choose('cancel'));
    return () => {back.remove(); unsubscribe(); choose('cancel');};
    // Each prompt owns one request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);
  return <View style={styles.overlay}>
    <View style={styles.panel}>
      <Text style={styles.title}>Already indexed on this page</Text>
      <ScrollView style={styles.list}><Text style={styles.text}>{request.labels.join('\n')}</Text></ScrollView>
      <Text style={styles.text}>Skip these keywords, or place their labels again without adding duplicate index entries.</Text>
      {([['skip', 'Skip duplicates'], ['all', 'Place all'], ['cancel', 'Cancel']] as const).map(([choice, label]) =>
        <Pressable key={choice} testID={`duplicate-${choice}`} style={styles.button} onPress={() => choose(choice)}>
          <Text style={styles.buttonText}>{label}</Text>
        </Pressable>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent'},
  panel: {width: '90%', maxWidth: 600, maxHeight: '90%', padding: 20, borderWidth: 1.5, borderColor: 'black', backgroundColor: 'white'},
  title: {fontSize: 21, fontWeight: 'bold', color: 'black', marginBottom: 16},
  list: {maxHeight: 200, marginBottom: 16},
  text: {fontSize: 17, color: 'black'},
  button: {padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'black'},
  buttonText: {fontSize: 17, fontWeight: 'bold', color: 'black', textAlign: 'center'},
});
