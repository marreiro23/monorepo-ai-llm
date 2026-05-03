export type PageContract<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};