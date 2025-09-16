export const getQueryParam = (key) => new URLSearchParams(location.search).get(key);
