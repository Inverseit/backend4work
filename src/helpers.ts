export const max = (a : number, b: number): number => a > b ? a : b;

export const createKey = (username: string, password: string ) => username + "//" + password;
