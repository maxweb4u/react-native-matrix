/**
 * react-native-matrix example.
 *
 * Sign in against the local Synapse, pick a conversation, chat. The whole
 * integration is this file plus `src/adapters.ts`: everything else is either
 * the library or ordinary application chrome.
 *
 * See memory_bank/ops/development.md#example-application.
 */

import React, {useState} from 'react';
import {ActivityIndicator, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import type {RoomSummary, SessionCredentials} from 'react-native-matrix';
import {MatrixProvider, MatrixUiProvider} from 'react-native-matrix';

import {adapters} from './src/adapters';
import {ConversationScreen} from './src/ConversationScreen';
import {LoginScreen} from './src/LoginScreen';
import {RoomsScreen} from './src/RoomsScreen';

interface Session {
  credentials: SessionCredentials;
  encrypted: boolean;
}

function App(): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<RoomSummary | null>(null);

  if (!session) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <LoginScreen
          onSignedIn={(credentials, encrypted) =>
            setSession({credentials, encrypted})
          }
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {/*
        MatrixUiProvider is optional. It is here to show that the whole default
        UI is restyled by one object, and that every string is replaceable.
      */}
      <MatrixUiProvider theme={{colors: {accent: '#3478f6'}}} locale="en">
        <MatrixProvider
          credentials={session.credentials}
          adapters={adapters}
          crypto={session.encrypted ? {enabled: true} : undefined}
          fallback={<Connecting />}
          onError={error => {
            // A library must not write to a consumer's console, so background
            // failures arrive here instead.
            console.warn('[matrix]', error.message);
          }}>
          {room ? (
            <ConversationScreen room={room} onBack={() => setRoom(null)} />
          ) : (
            <RoomsScreen
              onSelectRoom={setRoom}
              onSignOut={() => {
                setRoom(null);
                setSession(null);
              }}
            />
          )}
        </MatrixProvider>
      </MatrixUiProvider>
    </SafeAreaProvider>
  );
}

function Connecting(): React.JSX.Element {
  return (
    <View style={styles.connecting}>
      <ActivityIndicator color="#3478f6" />
      <Text style={styles.connectingText}>Syncing…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  connecting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  connectingText: {color: '#6b7683', fontSize: 14},
});

export default App;
