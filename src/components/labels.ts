/**
 * Every string the default components can render.
 *
 * Interpolated strings are functions rather than templates with placeholders.
 * That is a deliberate response to a 0.0.x defect: the Android action sheet
 * looked up a translation key that did not exist and rendered the interpolation
 * object, so the user saw `[object Object]`. A function cannot be missing an
 * argument without the compiler saying so, and there is no lookup to fail.
 */

export interface MatrixLabels {
  // Composer
  composerPlaceholder: string;
  send: string;
  attach: string;
  cancel: string;

  // Message states
  edited: string;
  deletedMessage: string;
  undecryptableMessage: string;
  unsupportedMessage: string;
  sending: string;
  sendFailed: string;
  retry: string;

  // Attachments
  image: string;
  video: string;
  audio: string;
  file: string;
  location: string;

  // Conversation chrome
  /** Day-separator label for the current day. */
  today: string;
  /** Day-separator label for the previous day. */
  yesterday: string;
  emptyConversation: string;
  loadingConversation: string;
  loadingEarlier: string;
  jumpToLatest: string;

  // Chat list
  emptyRoomList: string;
  invitation: string;
  acceptInvite: string;
  declineInvite: string;
  noMessagesYet: string;
  /** Prefix on the chat-list preview of the user's own last message. */
  ownMessagePrefix: string;

  /** One person typing, by display name. */
  typingOne: (displayName: string) => string;
  /** Two people typing. */
  typingTwo: (first: string, second: string) => string;
  /** Three or more; `count` is the total number of people typing. */
  typingMany: (count: number) => string;
  /** Accessibility label for a reaction chip. */
  reactionAccessibility: (key: string, count: number) => string;
}

export const defaultLabels: MatrixLabels = {
  composerPlaceholder: 'Message',
  send: 'Send',
  attach: 'Attach',
  cancel: 'Cancel',

  edited: 'edited',
  deletedMessage: 'Message deleted',
  undecryptableMessage: 'Cannot decrypt this message',
  unsupportedMessage: 'Unsupported message',
  sending: 'Sending…',
  sendFailed: 'Not sent',
  retry: 'Retry',

  image: 'Photo',
  video: 'Video',
  audio: 'Voice message',
  file: 'File',
  location: 'Location',

  today: 'Today',
  yesterday: 'Yesterday',
  emptyConversation: 'No messages yet',
  loadingConversation: 'Loading…',
  loadingEarlier: 'Loading earlier messages…',
  jumpToLatest: 'Jump to latest',

  emptyRoomList: 'No conversations yet',
  invitation: 'Invitation',
  acceptInvite: 'Accept',
  declineInvite: 'Decline',
  noMessagesYet: 'No messages yet',
  ownMessagePrefix: 'You: ',

  typingOne: (displayName) => `${displayName} is typing…`,
  typingTwo: (first, second) => `${first} and ${second} are typing…`,
  typingMany: (count) => `${count} people are typing…`,
  reactionAccessibility: (key, count) => `${key}, ${count} ${count === 1 ? 'person' : 'people'}`,
};
