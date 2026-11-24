import { createContext, useContext } from 'react';

// 사용자 이름(설정에서 바꾼 것). 없으면 '사용자 C'.
export const NamesContext = createContext<Record<string, string>>({});
export function useNameOf() {
  const names = useContext(NamesContext);
  return (user: string) => names[user] || `사용자 ${user}`;
}
