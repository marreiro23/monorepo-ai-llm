export type ErrorResponseContract = {
  success: false;
  message: string;
  code?: string;
  correlationId?: string;
};