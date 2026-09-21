// The collaboration endpoint lives on the same host as the page (the dev
// server proxies it), so there is no environment variable here: a `VITE_*`
// variable would only repeat what the address bar already says.
export const getCollabUrl = (
  location: Pick<Location, 'protocol' | 'host'> = window.location,
): string => {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

  return `${protocol}//${location.host}/collab`;
};
