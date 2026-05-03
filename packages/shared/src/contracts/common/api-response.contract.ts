export type ApiResponseContract<T> = {
  success: boolean;
  data: T;
  correlationId?: string;
};