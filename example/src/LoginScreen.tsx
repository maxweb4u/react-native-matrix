import React, {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {SessionCredentials} from 'react-native-matrix';
import {isCryptoSupported} from 'react-native-matrix/crypto';

import {DEFAULT_HOMESERVER_URL, SEEDED_ACCOUNTS} from './config';
import {login} from './login';

interface LoginScreenProps {
  onSignedIn: (credentials: SessionCredentials, encrypted: boolean) => void;
}

export function LoginScreen({onSignedIn}: LoginScreenProps) {
  // Editable because a physical device cannot reach the Mac's localhost, and
  // finding that out through a failed sign-in is a bad first impression.
  const [homeserver, setHomeserver] = useState<string>(DEFAULT_HOMESERVER_URL);
  const [user, setUser] = useState<string>(SEEDED_ACCOUNTS[0].user);
  const [password, setPassword] = useState<string>(SEEDED_ACCOUNTS[0].password);
  const [encrypted, setEncrypted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const credentials = await login(
        homeserver.trim().replace(/\/+$/, ''),
        user.trim(),
        password,
      );
      // Asking before the session is built lets the toggle be disabled rather
      // than the start throw. Same check, better moment.
      onSignedIn(credentials, encrypted && isCryptoSupported(credentials));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.form}>
        <Text style={styles.title}>react-native-matrix</Text>
        <Text style={styles.subtitle}>
          On a physical device use the Mac's LAN address, not localhost.
        </Text>

        <TextInput
          style={styles.input}
          value={homeserver}
          onChangeText={setHomeserver}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://localhost:8008"
        />
        <TextInput
          style={styles.input}
          value={user}
          onChangeText={setUser}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="user"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          secureTextEntry
          placeholder="password"
        />

        <View style={styles.row}>
          <Text style={styles.rowLabel}>End-to-end encryption</Text>
          <Switch value={encrypted} onValueChange={setEncrypted} />
        </View>
        <Text style={styles.hint}>
          Without an IndexedDB polyfill the crypto store is in memory, so room
          keys are lost when the app restarts.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, busy && styles.buttonBusy]}
          disabled={busy}
          onPress={() => {
            signIn();
          }}>
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          Seeded accounts: {SEEDED_ACCOUNTS.map(a => a.user).join(', ')} — run{' '}
          <Text style={styles.code}>npm run synapse:up</Text> in the repository
          root first.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#ffffff'},
  form: {flex: 1, justifyContent: 'center', padding: 24, gap: 12},
  title: {fontSize: 24, fontWeight: '700', color: '#11161c'},
  subtitle: {fontSize: 13, color: '#6b7683', marginBottom: 12},
  input: {
    borderWidth: 1,
    borderColor: '#dfe3e8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#11161c',
  },
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  rowLabel: {fontSize: 15, color: '#11161c'},
  hint: {fontSize: 12, color: '#6b7683'},
  code: {fontFamily: 'Courier', color: '#11161c'},
  error: {color: '#d1394a', fontSize: 13},
  button: {
    backgroundColor: '#3478f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonBusy: {opacity: 0.6},
  buttonText: {color: '#ffffff', fontSize: 16, fontWeight: '600'},
});
