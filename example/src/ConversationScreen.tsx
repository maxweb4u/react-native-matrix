import React from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RoomSummary} from 'react-native-matrix';
import {ChatScreen, useRoom} from 'react-native-matrix';
import {useRoomEncryption} from 'react-native-matrix/crypto';

interface ConversationScreenProps {
  room: RoomSummary;
  onBack: () => void;
}

export function ConversationScreen({room, onBack}: ConversationScreenProps) {
  const {room: summary, members} = useRoom(room.id);
  const {isEncrypted, isCryptoEnabled, enable} = useRoomEncryption(room.id);

  const confirmEncrypt = () => {
    Alert.alert(
      'Encrypt this room?',
      'This cannot be undone. The Matrix specification has no way to turn ' +
        'encryption back off.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Encrypt',
          style: 'destructive',
          onPress: () => {
            enable().catch(error => Alert.alert('Could not encrypt', String(error)));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.action}>Back</Text>
        </Pressable>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {summary?.name ?? room.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {members.length} member{members.length === 1 ? '' : 's'}
            {isEncrypted ? ' · encrypted' : ''}
          </Text>
        </View>

        {!isEncrypted && isCryptoEnabled ? (
          <Pressable onPress={confirmEncrypt} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.action}>Encrypt</Text>
          </Pressable>
        ) : (
          <View style={styles.actionSpacer} />
        )}
      </View>

      {/*
        Everything below the header is the library: history, day separators,
        reactions, typing indicator, composer, and keyboard handling. Long-press
        a message to reply to it.
      */}
      <ChatScreen roomId={room.id} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#ffffff'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dfe3e8',
  },
  titleBlock: {flex: 1},
  title: {fontSize: 17, fontWeight: '600', color: '#11161c'},
  subtitle: {fontSize: 12, color: '#6b7683'},
  action: {fontSize: 15, color: '#3478f6'},
  actionSpacer: {width: 52},
});
