export const max = (a : number, b: number): number => a > b ? a : b;

export const createKeyUsernamePassword = (username: string, password: string ) => "USER:" + username + "-" + password;

export const createKeyHours = (job_id: string, user_id: string ) => "Hours:" + user_id + "-" + job_id;

export const createKeyJobs = (user_id: string ) => "Jobs:" + user_id;
