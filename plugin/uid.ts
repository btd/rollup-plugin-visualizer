export const getUid = (alphabit: string | string[], size: number) => () => {
  let result = "";
  for (let i = 0; i < size; i++) {
    result += alphabit[(Math.random() * alphabit.length) | 0];
  }
  return result;
};
