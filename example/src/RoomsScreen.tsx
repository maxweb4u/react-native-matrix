import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RoomSummary} from 'react-native-matrix';
import {RoomList, useMatrix} from 'react-native-matrix';

interface RoomsScreenProps {
  onSelectRoom: (room: RoomSummary) => void;
  onSignOut: () => void;
}

export function RoomsScreen({onSelectRoom, onSignOut}: RoomsScreenProps) {
  const {status, userId} = useMatrix();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Chats</Text>
          <Text style={styles.subtitle}>
            {userId} · {status.syncState}
            {status.totalUnread > 0 ? ` · ${status.totalUnread} unread` : ''}
            {status.isCryptoEnabled ? ' · encrypted' : ''}
          </Text>
        </View>
        <Pressable onPress={onSignOut} accessibilityRole="button">
          <Text style={styles.action}>Sign out</Text>
        </Pressable>
      </View>

      {/* Invites are pinned to the top and can be accepted inline. */}
      <RoomList onSelectRoom={onSelectRoom} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#ffffff'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dfe3e8',
  },
  title: {fontSize: 22, fontWeight: '700', color: '#11161c'},
  subtitle: {fontSize: 12, color: '#6b7683'},
  action: {fontSize: 15, color: '#3478f6'},
});
