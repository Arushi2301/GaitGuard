let currentUri: string | null = null;

export const setVideoUri = (uri: string) => { currentUri = uri; };
export const getVideoUri = () => currentUri;