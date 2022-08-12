export type AdminMessage =
  | {
      type: 'friend';
      from: string;
      to: string;
    }
  | {
      type: 'join';
      from: string;
      channel: string;
    };

export type ChatMessage = {
  channel: string;
  message: string;
};
